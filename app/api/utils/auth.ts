import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import jwt from 'jsonwebtoken';

// Secret key for JWT signing - in production, use environment variable
// Using a getter function to always read the latest value from process.env
// This allows the secret to be updated when the .env file is reloaded after backup restore
function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'baby-tracker-jwt-secret';
}

// In-memory token blacklist (in a production app, this would be in Redis or similar)
// This is a simple Map that stores invalidated tokens with their expiry time
const tokenBlacklist = new Map<string, number>();

// Clean up expired tokens from the blacklist every hour
setInterval(() => {
  const now = Date.now();
  // Use Array.from to avoid TypeScript iterator issues
  Array.from(tokenBlacklist.entries()).forEach(([token, expiry]) => {
    if (now > expiry) {
      tokenBlacklist.delete(token);
    }
  });
}, 60 * 60 * 1000); // 1 hour

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Authentication result with caretaker information
 */
export interface AuthResult {
  authenticated: boolean;
  caretakerId?: string | null;
  caretakerType?: string | null;
  caretakerRole?: string;
  familyId?: string | null;
  familySlug?: string | null;
  isSysAdmin?: boolean;
  isSetupAuth?: boolean;
  setupToken?: string;
  authType?: string;        // Authentication type used for this session

  // New account fields
  isAccountAuth?: boolean;  // True if authenticated via account
  accountId?: string;       // Account ID
  accountEmail?: string;    // Account email
  isAccountOwner?: boolean; // True if account owns the family
  verified?: boolean;       // True if account email is verified
  betaparticipant?: boolean; // True if account is a beta participant

  // Expiration metadata (soft expiration)
  isExpired?: boolean;      // True if account has expired
  trialEnds?: string | null; // ISO date string when trial ends
  planExpires?: string | null; // ISO date string when plan expires
  planType?: string | null; // Current plan type

  error?: string;
}

/**
 * Verifies if the request is from an authenticated user by checking cookies
 * @param req The Next.js request object
 * @returns A boolean indicating if the user is authenticated
 */
export async function verifyAuthentication(req: NextRequest): Promise<boolean> {
  const authResult = await getAuthenticatedUser(req);
  return authResult.authenticated;
}

/**
 * Gets the authenticated user information from the request
 * @param req The Next.js request object
 * @returns Authentication result with caretaker information (includes expiration metadata)
 */
export async function getAuthenticatedUser(req: NextRequest): Promise<AuthResult> {
  try {
    // First try to get the JWT token from the Authorization header
    const authHeader = req.headers.get('Authorization');
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // If no token in header, try to get caretakerId from cookies (backward compatibility)
    const caretakerId = req.cookies.get('caretakerId')?.value;

    // If we have a JWT token, verify it
    if (token) {
      // Check if token is blacklisted
      if (tokenBlacklist.has(token)) {
        return { authenticated: false, error: 'Token has been invalidated' };
      }

      try {
        // Verify and decode the token
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        
        // Handle setup authentication tokens
        if (decoded.isSetupAuth && decoded.setupToken) {
          return {
            authenticated: true,
            caretakerId: null,
            caretakerType: 'Setup',
            caretakerRole: 'ADMIN', // Setup auth tokens have admin privileges for family creation
            familyId: null,
            familySlug: null,
            isSysAdmin: false,
            isSetupAuth: true,
            setupToken: decoded.setupToken,
          };
        }
        
        // Handle account authentication tokens
        if (decoded.isAccountAuth) {
          // For account authentication, always fetch fresh family info from database
          // since family association can change after JWT was issued (e.g., after family setup)
          try {
            const account = await prisma.account.findUnique({
              where: { id: decoded.accountId },
              include: { 
                family: { select: { id: true, slug: true } },
                caretaker: { select: { id: true, role: true, type: true, loginId: true } }
              }
            });

            if (!account) {
              console.log('Account authentication failed: Account not found for ID:', decoded.accountId);
              return { authenticated: false, error: 'Account not found' };
            }

            // Check if account is closed
            if (account.closed) {
              console.log('Account authentication failed: Account is closed for ID:', decoded.accountId);
              return { authenticated: false, error: 'Account is closed' };
            }

            // Calculate expiration status in SAAS mode
            // Only check if account has a family (no point checking expiration during setup)
            const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';
            let isExpired = false;

            if (isSaasMode && account.family && !account.betaparticipant) {
              const now = new Date();

              // Check trial expiration
              if (account.trialEnds) {
                const trialEndDate = new Date(account.trialEnds);
                isExpired = now > trialEndDate;
              }
              // Check plan expiration (if no trial)
              else if (account.planExpires) {
                const planEndDate = new Date(account.planExpires);
                isExpired = now > planEndDate;
              }
              // No trial and no plan = expired
              else if (!account.planType) {
                isExpired = true;
              }
            }

            // If account has a linked caretaker, use that caretaker's permissions
            if (account.caretaker) {
              return {
                authenticated: true,
                caretakerId: account.caretaker.id,
                caretakerType: account.caretaker.type || 'Account Owner',
                caretakerRole: account.caretaker.role,
                familyId: account.family?.id || null,
                familySlug: account.family?.slug || null,
                isAccountAuth: true,
                accountId: decoded.accountId,
                accountEmail: decoded.accountEmail,
                isAccountOwner: true,
                verified: account.verified,
                betaparticipant: account.betaparticipant,
                isExpired,
                trialEnds: account.trialEnds?.toISOString() || null,
                planExpires: account.planExpires?.toISOString() || null,
                planType: account.planType,
              };
            } else {
              // Account without linked caretaker - limited permissions (during setup)
              console.log('Account has no linked caretaker - setup may be incomplete');
              
              // If account has no family AND no caretaker, they're in initial setup phase
              if (!account.family) {
                console.log('Account has no family - redirect to setup needed');
                return {
                  authenticated: true,
                  caretakerId: decoded.accountId, // Use account ID as fallback
                  caretakerType: 'ACCOUNT',
                  caretakerRole: 'OWNER',
                  familyId: null,
                  familySlug: null,
                  isAccountAuth: true,
                  accountId: decoded.accountId,
                  accountEmail: decoded.accountEmail,
                  isAccountOwner: true,
                  verified: account.verified,
                  betaparticipant: account.betaparticipant,
                  isExpired,
                  trialEnds: account.trialEnds?.toISOString() || null,
                  planExpires: account.planExpires?.toISOString() || null,
                  planType: account.planType,
                };
              } else {
                // Account has family but no caretaker - this shouldn't happen after proper setup
                console.log('WARNING: Account has family but no linked caretaker - data inconsistency!');
                return {
                  authenticated: true,
                  caretakerId: decoded.accountId, // Use account ID as fallback
                  caretakerType: 'ACCOUNT',
                  caretakerRole: 'OWNER',
                  familyId: account.family.id,
                  familySlug: account.family.slug,
                  isAccountAuth: true,
                  accountId: decoded.accountId,
                  accountEmail: decoded.accountEmail,
                  isAccountOwner: true,
                  verified: account.verified,
                  betaparticipant: account.betaparticipant,
                  isExpired,
                  trialEnds: account.trialEnds?.toISOString() || null,
                  planExpires: account.planExpires?.toISOString() || null,
                  planType: account.planType,
                };
              }
            }
          } catch (error) {
            console.error('Error fetching account family info:', error);
            return { authenticated: false, error: 'Failed to verify account status' };
          }
        }
        
        // Handle regular user/admin tokens (PIN-based JWT tokens)
        const regularDecoded = decoded as {
          id: string;
          name: string;
          type: string | null;
          role: string;
          familyId: string | null;
          familySlug: string | null;
          isSysAdmin?: boolean;
        };

        // Check account expiration for regular tokens (if family has an account)
        let isExpired = false;
        let trialEnds: string | null = null;
        let planExpires: string | null = null;
        let planType: string | null = null;
        let betaparticipant = false;

        if (regularDecoded.familyId && !regularDecoded.isSysAdmin) {
          try {
            const family = await prisma.family.findUnique({
              where: { id: regularDecoded.familyId },
              include: {
                account: {
                  select: {
                    id: true,
                    betaparticipant: true,
                    trialEnds: true,
                    planType: true,
                    planExpires: true,
                    closed: true,
                  }
                }
              }
            });

            if (family?.account) {
              const account = family.account;
              const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';

              // Check account closure
              if (account.closed) {
                return { authenticated: false, error: 'Family account is closed' };
              }

              // Store account metadata
              betaparticipant = account.betaparticipant || false;
              trialEnds = account.trialEnds?.toISOString() || null;
              planExpires = account.planExpires?.toISOString() || null;
              planType = account.planType;

              // Calculate expiration status in SAAS mode for non-beta accounts
              if (isSaasMode && !account.betaparticipant) {
                const now = new Date();

                // Check trial expiration
                if (account.trialEnds) {
                  const trialEndDate = new Date(account.trialEnds);
                  isExpired = now > trialEndDate;
                }
                // Check plan expiration (if no trial)
                else if (account.planExpires) {
                  const planEndDate = new Date(account.planExpires);
                  isExpired = now > planEndDate;
                }
                // No trial and no plan = expired
                else if (!account.planType) {
                  isExpired = true;
                }
              }
            }
          } catch (error) {
            console.error('Error checking account expiration for regular token:', error);
            // Don't fail auth if we can't check expiration - allow the request through
          }
        }

        // Return authenticated user info from token with expiration metadata
        return {
          authenticated: true,
          caretakerId: regularDecoded.isSysAdmin ? null : regularDecoded.id,
          caretakerType: regularDecoded.type,
          caretakerRole: regularDecoded.role,
          familyId: regularDecoded.familyId,
          familySlug: regularDecoded.familySlug,
          isSysAdmin: regularDecoded.isSysAdmin || false,
          authType: (regularDecoded as any).authType || 'CARETAKER',
          betaparticipant,
          isExpired,
          trialEnds,
          planExpires,
          planType,
        };
      } catch (jwtError) {
        console.error('JWT verification error:', jwtError);
        return { authenticated: false, error: 'Invalid or expired token' };
      }
    }
    
    // If no token but we have a caretakerId cookie, use the old method (backward compatibility)
    if (caretakerId) {
      // Verify caretaker exists in database
      const caretaker = await prisma.caretaker.findFirst({
        where: {
          id: caretakerId,
          deletedAt: null,
        },
        include: {
          family: {
            include: {
              account: {
                select: {
                  id: true,
                  betaparticipant: true,
                  trialEnds: true,
                  planType: true,
                  planExpires: true,
                  closed: true,
                }
              }
            }
          },
        },
      });

      if (caretaker) {
        // Calculate expiration status if family has an account (only in SAAS mode)
        let isExpired = false;
        let trialEnds: string | null = null;
        let planExpires: string | null = null;
        let planType: string | null = null;
        let betaparticipant = false;

        if (caretaker.family?.account) {
          const account = caretaker.family.account;
          const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';

          // Check account closure
          if (account.closed) {
            return { authenticated: false, error: 'Family account is closed' };
          }

          // Store account metadata
          betaparticipant = account.betaparticipant || false;
          trialEnds = account.trialEnds?.toISOString() || null;
          planExpires = account.planExpires?.toISOString() || null;
          planType = account.planType;

          // Calculate expiration status in SAAS mode for non-beta accounts
          if (isSaasMode && !account.betaparticipant) {
            const now = new Date();

            // Check trial expiration
            if (account.trialEnds) {
              const trialEndDate = new Date(account.trialEnds);
              isExpired = now > trialEndDate;
            }
            // Check plan expiration (if no trial)
            else if (account.planExpires) {
              const planEndDate = new Date(account.planExpires);
              isExpired = now > planEndDate;
            }
            // No trial and no plan = expired
            else if (!account.planType) {
              isExpired = true;
            }
          }
        }

        return {
          authenticated: true,
          caretakerId: caretaker.id,
          caretakerType: caretaker.type,
          // Use type assertion for role until Prisma types are updated
          caretakerRole: (caretaker as any).role || 'USER',
          familyId: caretaker.familyId,
          familySlug: caretaker.family?.slug,
          isSysAdmin: false,
          authType: 'CARETAKER',
          betaparticipant,
          isExpired,
          trialEnds,
          planExpires,
          planType,
        };
      }
    }

    return { authenticated: false, error: 'No valid authentication found' };
  } catch (error) {
    console.error('Authentication verification error:', error);
    return { authenticated: false, error: 'Authentication verification failed' };
  }
}

/**
 * Middleware function to require authentication for API routes
 * @param handler The API route handler function
 * @returns A wrapped handler that checks authentication before proceeding
 */
export function withAuth<T>(
  handler: (req: NextRequest) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    return handler(req);
  };
}

/**
 * Middleware function to require admin authentication for API routes
 * @param handler The API route handler function
 * @returns A wrapped handler that checks admin authentication before proceeding
 */
export function withAdminAuth<T>(
  handler: (req: NextRequest) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // Check if user is an admin by role, system admin, or system caretaker
    let isSystemCaretaker = false;
    if (authResult.caretakerId) {
      try {
        const caretaker = await prisma.caretaker.findFirst({
          where: {
            id: authResult.caretakerId,
            loginId: '00', // System caretakers have loginId '00'
            deletedAt: null,
          },
        });
        isSystemCaretaker = !!caretaker;
      } catch (error) {
        console.error('Error checking system caretaker:', error);
      }
    }
    
    // Allow access for: ADMIN role, system caretakers, or system administrators
    if (authResult.caretakerRole !== 'ADMIN' && !isSystemCaretaker && !authResult.isSysAdmin) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Admin access required',
        },
        { status: 403 }
      );
    }
    
    return handler(req);
  };
}

/**
 * Middleware function to require system admin authentication for API routes
 * @param handler The API route handler function
 * @returns A wrapped handler that checks system admin authentication before proceeding
 */
export function withSysAdminAuth<T>(
  handler: (req: NextRequest) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // Check if user is a system administrator
    if (!authResult.isSysAdmin) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'System administrator access required',
        },
        { status: 403 }
      );
    }
    
    return handler(req);
  };
}

/**
 * Middleware function to require account owner authentication for API routes
 * @param handler The API route handler function
 * @returns A wrapped handler that checks account owner authentication before proceeding
 */
export function withAccountOwner<T>(
  handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    
    if (!authResult.isAccountOwner && !authResult.isSysAdmin) {
      return NextResponse.json({ success: false, error: 'Account owner access required' }, { status: 403 });
    }
    
    return handler(req, authResult);
  };
}

/**
 * Middleware function to attach authenticated user info to the request context
 * This allows handlers to access the authenticated user's information
 * @param handler The API route handler function that receives auth context
 * @returns A wrapped handler with authentication check
 */
export function withAuthContext<T>(
  handler: (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (req: NextRequest): Promise<NextResponse<ApiResponse<T | null>>> => {
    const authResult = await getAuthenticatedUser(req);
    
    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }
    
    // Setup authentication: extract family context from query params during family setup
    if (authResult.isSetupAuth && authResult.setupToken) {
      // Try to get familyId from query parameter
      const { searchParams } = new URL(req.url);
      let familyId = searchParams.get('familyId');
      
      // If familyId is provided, validate that the setup token is authorized for this family
      if (familyId) {
        try {
          const setupToken = await prisma.familySetup.findUnique({
            where: { token: authResult.setupToken }
          });
          
          // Validate that the setup token exists and is associated with this family
          // For active setup processes, the familyId might be set in the token
          if (setupToken && (setupToken.familyId === familyId || !setupToken.familyId)) {
            // Create modified auth result with the family context
            const modifiedAuthResult = {
              ...authResult,
              familyId: familyId
            };
            
            return handler(req, modifiedAuthResult);
          } else {
            return NextResponse.json<ApiResponse<null>>(
              {
                success: false,
                error: 'Setup token is not authorized for this family',
              },
              { status: 403 }
            );
          }
        } catch (error) {
          console.error('Error validating setup token for family context:', error);
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Failed to validate setup authorization',
            },
            { status: 500 }
          );
        }
      }
      
      // If no familyId provided, continue with original auth result
      return handler(req, authResult);
    }

    // System administrators: extract family context from URL, query params, or referer
    if (authResult.isSysAdmin) {
      // Try to get familyId from query parameter first
      const { searchParams } = new URL(req.url);
      let familyId = searchParams.get('familyId');
      
      // If no familyId in query params, try to extract from URL path (for family-specific routes like /[slug]/...)
      if (!familyId) {
        const url = new URL(req.url);
        const pathSegments = url.pathname.split('/').filter(Boolean);
        
        // Check if this looks like a family route (not api, family-manager, etc.)
        if (pathSegments.length > 0 && 
            !pathSegments[0].startsWith('api') && 
            !pathSegments[0].startsWith('family-manager') &&
            !pathSegments[0].startsWith('setup')) {
          
          const familySlug = pathSegments[0];
          
          // Look up family by slug to get familyId
          try {
            const family = await prisma.family.findUnique({
              where: { slug: familySlug }
            });
            
            if (family) {
              familyId = family.id;
            }
          } catch (error) {
            console.error('Error looking up family by slug for sysadmin:', error);
          }
        }
      }
      
      // If still no familyId, try to extract from referer header (for API calls from family pages)
      if (!familyId) {
        const referer = req.headers.get('referer');
        if (referer) {
          try {
            const refererUrl = new URL(referer);
            const refererPathSegments = refererUrl.pathname.split('/').filter(Boolean);
            
            // Check if referer is a family route
            if (refererPathSegments.length > 0 && 
                !refererPathSegments[0].startsWith('api') && 
                !refererPathSegments[0].startsWith('family-manager') &&
                !refererPathSegments[0].startsWith('setup')) {
              
              const familySlug = refererPathSegments[0];
              
              // Look up family by slug to get familyId
              const family = await prisma.family.findUnique({
                where: { slug: familySlug }
              });
              
              if (family) {
                familyId = family.id;
              }
            }
          } catch (error) {
            console.error('Error parsing referer for sysadmin family context:', error);
          }
        }
      }
      
      // Create modified auth result with the family context
      const modifiedAuthResult = {
        ...authResult,
        familyId: familyId || authResult.familyId
      };
      
      return handler(req, modifiedAuthResult);
    }
    
    // Note: We no longer need to set caretakerId to null for system caretakers
    // All caretakers (including system ones) should maintain their ID for proper authorization
    
    return handler(req, authResult);
  };
}

/**
 * Invalidates a JWT token by adding it to the blacklist
 * @param token The JWT token to invalidate
 * @returns True if the token was successfully invalidated
 */
export function invalidateToken(token: string): boolean {
  try {
    // Decode the token without verification to get expiry
    const decoded = jwt.decode(token) as { exp?: number };
    
    if (decoded && decoded.exp) {
      // Store the token in the blacklist until its original expiry time
      const expiryMs = decoded.exp * 1000; // Convert seconds to milliseconds
      tokenBlacklist.set(token, expiryMs);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error invalidating token:', error);
    return false;
  }
}
