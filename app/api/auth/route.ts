import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import jwt from 'jsonwebtoken';
import { checkIpLockout, recordFailedAttempt, resetFailedAttempts } from '../utils/ip-lockout';
import { decrypt, isEncrypted } from '../utils/encryption';
import { randomUUID } from 'crypto';
import { logApiCall, getClientInfo } from '../utils/api-logger';

// Secret key for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';
// Token expiration time in seconds (default to 12 hours if not specified)
const TOKEN_EXPIRATION = parseInt(process.env.AUTH_LIFE || '1800', 10);

// Authentication endpoint for caretakers or system PIN
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const { ip, userAgent } = getClientInfo(req);
  let requestBody: any;

  try {

    // Check if the IP is locked out
    const { locked, remainingTime } = checkIpLockout(ip);
    if (locked) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: `You have been locked out due to too many failed attempts. Please try again in ${Math.ceil(remainingTime / 60000)} minutes.`,
        },
        { status: 429 }
      );
    }

    requestBody = await req.json();
    const { loginId, securityPin, familySlug, adminPassword } = requestBody;

    if (!securityPin && !adminPassword) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Security PIN or admin password is required',
        },
        { status: 400 }
      );
    }

    // Check for system admin authentication first
    if (adminPassword) {
      try {
        const appConfig = await prisma.appConfig.findFirst();
        
        if (!appConfig) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'System configuration not found',
            },
            { status: 500 }
          );
        }

        // Decrypt the stored admin password and compare
        const decryptedAdminPass = isEncrypted(appConfig.adminPass) 
          ? decrypt(appConfig.adminPass) 
          : appConfig.adminPass;

        if (adminPassword === decryptedAdminPass) {
          // Create system admin JWT token
          const token = jwt.sign(
            {
              id: 'sysadmin',
              name: 'System Administrator',
              type: 'SYSADMIN',
              role: 'SYSADMIN',
              familyId: null,
              familySlug: null,
              isSysAdmin: true,
            },
            JWT_SECRET,
            { expiresIn: `${TOKEN_EXPIRATION}s` }
          );

          // Reset failed attempts on successful login
          resetFailedAttempts(ip);

          // Create response with system admin token
          const response = NextResponse.json<ApiResponse<{
            id: string;
            name: string;
            type: string;
            role: string;
            token: string;
            familyId: string | null;
            familySlug: string | null;
            isSysAdmin: boolean;
          }>>({
            success: true,
            data: {
              id: 'sysadmin',
              name: 'System Administrator',
              type: 'SYSADMIN',
              role: 'SYSADMIN',
              token: token,
              familyId: null,
              familySlug: null,
              isSysAdmin: true,
            },
          });

          // Log successful admin authentication
          logApiCall({
            method: req.method,
            path: '/api/auth',
            status: 200,
            durationMs: Date.now() - startTime,
            ip,
            userAgent,
            caretakerId: 'sysadmin',
            familyId: undefined,
            requestBody: { ...requestBody, adminPassword: '[REDACTED]' },
            responseBody: { success: true, data: { id: 'sysadmin', name: 'System Administrator', type: 'SYSADMIN' } },
          }).catch(err => console.error('Failed to log API call:', err));

          return response;
        } else {
          // Record failed attempt for invalid admin password
          recordFailedAttempt(ip);
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Invalid admin password',
            },
            { status: 401 }
          );
        }
      } catch (error) {
        console.error('System admin authentication error:', error);
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'System admin authentication failed',
          },
          { status: 500 }
        );
      }
    }

    // Validate family slug if provided and check subscription status in SAAS mode
    let targetFamily = null;
    if (familySlug) {
      targetFamily = await prisma.family.findFirst({
        where: {
          slug: familySlug,
          isActive: true,
        },
        include: {
          account: {
            select: {
              id: true,
              betaparticipant: true,
              trialEnds: true,
              planType: true,
              planExpires: true
            }
          }
        }
      });

      if (!targetFamily) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Invalid family',
          },
          { status: 404 }
        );
      }

      // Check subscription status in SAAS mode
      const deploymentMode = process.env.DEPLOYMENT_MODE;
      if (deploymentMode === 'saas' && targetFamily.account) {
        const account = targetFamily.account;

        // Skip check for beta participants
        if (!account.betaparticipant) {
          const now = new Date();
          let isExpired = false;

          if (account.trialEnds) {
            const trialEndDate = new Date(account.trialEnds);
            isExpired = now > trialEndDate;
          } else if (account.planExpires) {
            const planEndDate = new Date(account.planExpires);
            isExpired = now > planEndDate;
          } else if (!account.planType) {
            // No trial, no plan, and not beta - expired
            isExpired = true;
          }

          if (isExpired) {
            // Record failed attempt to prevent brute force on expired families
            recordFailedAttempt(ip);
            return NextResponse.json<ApiResponse<null>>(
              {
                success: false,
                error: 'Family access has expired. Please renew your subscription.',
              },
              { status: 403 }
            );
          }
        }
      }
    }

    // Get settings to check authentication type
    let settings = targetFamily
      ? await prisma.settings.findFirst({ where: { familyId: targetFamily.id } })
      : await prisma.settings.findFirst();

    // If no settings exist, fail authentication
    if (!settings) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Family settings not found. Please contact administrator.',
        },
        { status: 500 }
      );
    }

    // Count active caretakers (excluding system caretaker)
    const caretakerCount = await prisma.caretaker.count({
      where: {
        deletedAt: null,
        loginId: { not: '00' }, // Exclude system caretaker
        ...(targetFamily ? { familyId: targetFamily.id } : {}),
      },
    });

    // Auto-detect authentication type if not set
    let authType = settings.authType;
    if (!authType) {
      // Auto-detect based on caretaker existence
      authType = caretakerCount > 1 ? 'CARETAKER' : 'SYSTEM';
    }

    // Handle SYSTEM authentication type
    if (authType === 'SYSTEM') {
      if (settings.securityPin === securityPin) {
        // Find the system caretaker to get family information
        let systemCaretaker = await prisma.caretaker.findFirst({
          where: {
            loginId: '00',
            deletedAt: null,
            // If family slug is provided, ensure system caretaker belongs to that family
            ...(targetFamily ? { familyId: targetFamily.id } : {}),
          },
          include: {
            family: true,
          },
        });
        
        // If no system caretaker exists, create one
        if (!systemCaretaker && targetFamily) {
          systemCaretaker = await prisma.caretaker.create({
            data: {
              id: randomUUID(),
              loginId: '00',
              name: 'system',
              type: 'System Administrator',
              role: 'ADMIN',
              securityPin: settings.securityPin,
              familyId: targetFamily.id,
              inactive: false,
            },
            include: {
              family: true,
            },
          });
          console.log(`Created system caretaker for family ${targetFamily.name}`);
        }
        
        if (systemCaretaker) {
          // Create JWT token for system caretaker with actual caretaker data
          // Include subscription data for family context checking
          let tokenData: any = {
            id: systemCaretaker.id,
            name: systemCaretaker.name,
            type: systemCaretaker.type,
            role: (systemCaretaker as any).role || 'ADMIN',
            familyId: systemCaretaker.familyId,
            familySlug: systemCaretaker.family?.slug,
            authType: 'SYSTEM',
            isAccountAuth: false,
          };

          // Add subscription data if family has an account (for SAAS mode)
          if (targetFamily?.account) {
            tokenData.betaparticipant = targetFamily.account.betaparticipant;
            tokenData.trialEnds = targetFamily.account.trialEnds?.toISOString();
            tokenData.planExpires = targetFamily.account.planExpires?.toISOString();
            tokenData.planType = targetFamily.account.planType;
          }

          const token = jwt.sign(tokenData, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRATION}s` });
          
          // Create response with token
          const response = NextResponse.json<ApiResponse<{ 
            id: string; 
            name: string; 
            type: string | null; 
            role: string;
            token: string;
            familyId: string | null;
            familySlug: string | null;
          }>>(
            {
              success: true,
              data: {
                id: systemCaretaker.id,
                name: systemCaretaker.name,
                type: systemCaretaker.type,
                role: (systemCaretaker as any).role || 'ADMIN',
                token: token,
                familyId: systemCaretaker.familyId,
                familySlug: systemCaretaker.family?.slug || null,
              },
            }
          );
          
          // Also set the caretakerId cookie for backward compatibility
          response.cookies.set('caretakerId', systemCaretaker.id, {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: 'strict',
            maxAge: TOKEN_EXPIRATION, // Use AUTH_LIFE env variable
            path: '/',
          });
          
          // Update settings with detected authType if it was auto-detected
          if (!settings.authType) {
            try {
              await prisma.settings.update({
                where: { id: settings.id },
                data: { authType: authType }
              });
            } catch (error) {
              console.error('Error updating authType in settings:', error);
            }
          }

          // Reset failed attempts on successful login
          resetFailedAttempts(ip);

          // Log successful system caretaker authentication
          logApiCall({
            method: req.method,
            path: '/api/auth',
            status: 200,
            durationMs: Date.now() - startTime,
            ip,
            userAgent,
            caretakerId: systemCaretaker.id,
            familyId: systemCaretaker.familyId ?? undefined,
            requestBody: { ...requestBody, securityPin: '[REDACTED]' },
            responseBody: { success: true, data: { id: systemCaretaker.id, name: systemCaretaker.name, familySlug: systemCaretaker.family?.slug } },
          }).catch(err => console.error('Failed to log API call:', err));

          return response;
        } else {
          // This should not happen now since we create system caretakers on-demand
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'System caretaker could not be created. Please contact administrator.',
            },
            { status: 500 }
          );
        }
      }
    } else if (authType === 'CARETAKER') {
      // If authType is CARETAKER, block system PIN authentication
      if (!loginId) {
        recordFailedAttempt(ip);
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Login ID is required for caretaker authentication.',
          },
          { status: 401 }
        );
      }
    }

    // Handle caretaker authentication (when loginId is provided)
    if (loginId) {
      // If caretakers exist, require loginId and check caretaker credentials
      const caretaker = await prisma.caretaker.findFirst({
        where: {
          loginId: loginId,
          inactive: false,
          deletedAt: null,
          // If family slug is provided, ensure caretaker belongs to that family
          ...(targetFamily ? { familyId: targetFamily.id } : {}),
        } as any, // Type assertion for loginId field
        include: {
          family: true, // Include family information
        },
      });

      // Security check: If authType is CARETAKER and this is a system caretaker (loginId '00'), deny access
      if (caretaker && caretaker.loginId === '00' && authType === 'CARETAKER') {
        recordFailedAttempt(ip);
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'System account access is disabled in caretaker authentication mode',
          },
          { status: 403 }
        );
      }

      // Legacy security check: If this is a system caretaker (loginId '00') and regular caretakers exist,
      // deny access to prevent unauthorized use of the default system account
      if (caretaker && caretaker.loginId === '00') {
        const regularCaretakerCount = await prisma.caretaker.count({
          where: {
            deletedAt: null,
            loginId: { not: '00' }, // Exclude system caretaker
            // If family is specified, only count caretakers in that family
            ...(targetFamily ? { familyId: targetFamily.id } : {}),
          },
        });

        if (regularCaretakerCount > 0) {
          // Record failed attempt for security
          recordFailedAttempt(ip);
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'System account access is disabled when caretakers are configured',
            },
            { status: 403 }
          );
        }
      }

      if (caretaker && caretaker.securityPin === securityPin) {
        // Create JWT token for caretaker
        // Include subscription data for family context checking
        let tokenData: any = {
          id: caretaker.id,
          name: caretaker.name,
          type: caretaker.type,
          role: (caretaker as any).role || 'USER',
          familyId: caretaker.familyId,
          familySlug: caretaker.family?.slug,
          authType: authType,
          isAccountAuth: false,
        };

        // Add subscription data if family has an account (for SAAS mode)
        if (targetFamily?.account) {
          tokenData.betaparticipant = targetFamily.account.betaparticipant;
          tokenData.trialEnds = targetFamily.account.trialEnds?.toISOString();
          tokenData.planExpires = targetFamily.account.planExpires?.toISOString();
          tokenData.planType = targetFamily.account.planType;
        }

        const token = jwt.sign(tokenData, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRATION}s` });
        
        // Create response with token
        const response = NextResponse.json<ApiResponse<{ 
          id: string; 
          name: string; 
          type: string | null; 
          role: string;
          token: string;
          familyId: string | null;
          familySlug: string | null;
        }>>(
          {
            success: true,
            data: {
              id: caretaker.id,
              name: caretaker.name,
              type: caretaker.type,
              // Use type assertion for role until Prisma types are updated
              role: (caretaker as any).role || 'USER',
              token: token,
              familyId: caretaker.familyId,
              familySlug: caretaker.family?.slug || null,
            },
          }
        );
        
        // Also set the caretakerId cookie for backward compatibility
        response.cookies.set('caretakerId', caretaker.id, {
          httpOnly: true,
          secure: process.env.COOKIE_SECURE === 'true',
          sameSite: 'strict',
          maxAge: TOKEN_EXPIRATION, // Use AUTH_LIFE env variable
          path: '/',
        });
        
        // Update settings with detected authType if it was auto-detected
        if (!settings.authType) {
          try {
            await prisma.settings.update({
              where: { id: settings.id },
              data: { authType: authType }
            });
          } catch (error) {
            console.error('Error updating authType in settings:', error);
          }
        }

        // Reset failed attempts on successful login
        resetFailedAttempts(ip);

        // Log successful caretaker authentication
        logApiCall({
          method: req.method,
          path: '/api/auth',
          status: 200,
          durationMs: Date.now() - startTime,
          ip,
          userAgent,
          caretakerId: caretaker.id,
          familyId: caretaker.familyId ?? undefined,
          requestBody: { ...requestBody, securityPin: '[REDACTED]' },
          responseBody: { success: true, data: { id: caretaker.id, name: caretaker.name, familySlug: caretaker.family?.slug } },
        }).catch(err => console.error('Failed to log API call:', err));

        return response;
      }
    }
    
    // If we get here, authentication failed
    // Record the failed attempt
    recordFailedAttempt(ip);

    // Provide a more specific error message if family validation failed
    const errorMessage = targetFamily
      ? 'Invalid credentials or user does not have access to this family'
      : 'Invalid credentials';

    // Log failed authentication attempt
    logApiCall({
      method: req.method,
      path: '/api/auth',
      status: 401,
      durationMs: Date.now() - startTime,
      ip,
      userAgent,
      familyId: targetFamily?.id,
      error: errorMessage,
      requestBody: {
        ...requestBody,
        securityPin: requestBody?.securityPin ? '[REDACTED]' : undefined,
        adminPassword: requestBody?.adminPassword ? '[REDACTED]' : undefined
      },
      responseBody: { success: false, error: errorMessage },
    }).catch(err => console.error('Failed to log API call:', err));

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: errorMessage,
      },
      { status: 401 }
    );
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Authentication failed',
      },
      { status: 500 }
    );
  }
}
