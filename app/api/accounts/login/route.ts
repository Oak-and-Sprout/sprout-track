import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import jwt from 'jsonwebtoken';
import { verifyPassword } from '../../utils/password-utils';
import { checkIpLockout, recordFailedAttempt, resetFailedAttempts } from '../../utils/ip-lockout';
import { logApiCall, getClientInfo } from '../../utils/api-logger';

// Secret key for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';
// Token expiration time in seconds (default to 12 hours if not specified)
const TOKEN_EXPIRATION = parseInt(process.env.AUTH_LIFE || '43200', 10);

interface AccountLoginRequest {
  email: string;
  password: string;
}

interface AccountLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    verified: boolean;
    hasFamily: boolean;
    familyId?: string;
    familySlug?: string;
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AccountLoginResponse>>> {
  const startTime = Date.now();
  const { ip, userAgent } = getClientInfo(req);
  let requestBody: any;

  try {
    
    // Check if the IP is locked out
    const { locked, remainingTime } = checkIpLockout(ip);
    if (locked) {
      const errorMsg = `Too many failed attempts. Please try again in ${Math.ceil(remainingTime / 60000)} minutes.`;
      
      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 429,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 429 }
      );
    }

    requestBody = await req.json();
    const { email, password }: AccountLoginRequest = requestBody;

    // Validate input
    if (!email || !password) {
      recordFailedAttempt(ip);
      const errorMsg = 'Email and password are required';

      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 400,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
        requestBody: { email: email || undefined },
        responseBody: { success: false, error: errorMsg },
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      recordFailedAttempt(ip);
      const errorMsg = 'Please enter a valid email address';

      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 400,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
        requestBody: { email },
        responseBody: { success: false, error: errorMsg },
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 400 }
      );
    }

    // Find the account by email
    const account = await prisma.account.findUnique({
      where: { email: email.toLowerCase() },
      include: { 
        family: true,
        caretaker: true
      }
    });

    // Check if account exists
    if (!account) {
      recordFailedAttempt(ip);
      const errorMsg = 'Invalid email or password';

      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 401,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
        requestBody: { email, password: '[REDACTED]' },
        responseBody: { success: false, error: errorMsg },
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 401 }
      );
    }

    // Check if account is closed using the proper closed field
    if (account.closed) {
      recordFailedAttempt(ip);
      const errorMsg = 'This account has been closed';

      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 401,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
        requestBody: { email, password: '[REDACTED]' },
        responseBody: { success: false, error: errorMsg },
        familyId: account.familyId ?? undefined,
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, account.password);
    if (!passwordMatch) {
      recordFailedAttempt(ip);
      const errorMsg = 'Invalid email or password';

      logApiCall({
        method: req.method,
        path: '/api/accounts/login',
        status: 401,
        durationMs: Date.now() - startTime,
        ip,
        userAgent,
        error: errorMsg,
        requestBody: { email, password: '[REDACTED]' },
        responseBody: { success: false, error: errorMsg },
        familyId: account.familyId ?? undefined,
      }).catch(err => console.error('Failed to log API call:', err));

      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: errorMsg,
        },
        { status: 401 }
      );
    }

    // Reset failed attempts on successful authentication
    resetFailedAttempts(ip);

    // Generate JWT token for account holder
    const token = jwt.sign({
      id: account.id,
      name: account.firstName || 'User',
      type: 'ACCOUNT',
      role: 'OWNER',
      familyId: account.familyId,
      familySlug: account.family?.slug,
      isAccountAuth: true,
      accountId: account.id,
      accountEmail: account.email,
      verified: account.verified,
      betaparticipant: account.betaparticipant,
      trialEnds: account.trialEnds?.toISOString(),
      planExpires: account.planExpires?.toISOString(),
      planType: account.planType,
    }, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRATION}s` });

    const response: AccountLoginResponse = {
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: account.id,
        email: account.email,
        firstName: account.firstName || '',
        lastName: account.lastName || undefined,
        verified: account.verified,
        hasFamily: !!account.familyId,
        ...(account.familyId && { familyId: account.familyId }),
        ...(account.family?.slug && { familySlug: account.family.slug }),
      }
    };

    // Log successful account authentication
    logApiCall({
      method: req.method,
      path: '/api/accounts/login',
      status: 200,
      durationMs: Date.now() - startTime,
      ip,
      userAgent,
      caretakerId: account.caretakerId ?? undefined,
      familyId: account.familyId ?? undefined,
      requestBody: { email, password: '[REDACTED]' },
      responseBody: { 
        success: true, 
        data: { 
          id: account.id, 
          email: account.email, 
          firstName: account.firstName,
          familySlug: account.family?.slug 
        } 
      },
    }).catch(err => console.error('Failed to log API call:', err));

    return NextResponse.json<ApiResponse<AccountLoginResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Account login error:', error);
    
    const errorMsg = 'Internal server error. Please try again later.';

    logApiCall({
      method: req.method,
      path: '/api/accounts/login',
      status: 500,
      durationMs: Date.now() - startTime,
      ip,
      userAgent,
      error: errorMsg,
      requestBody: requestBody ? { email: requestBody.email, password: '[REDACTED]' } : undefined,
      responseBody: { success: false, error: errorMsg },
    }).catch(err => console.error('Failed to log API call:', err));
    
    return NextResponse.json<ApiResponse<AccountLoginResponse>>(
      {
        success: false,
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
