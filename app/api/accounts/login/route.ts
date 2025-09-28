import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import jwt from 'jsonwebtoken';
import { verifyPassword } from '../../utils/password-utils';
import { checkIpLockout, recordFailedAttempt, resetFailedAttempts } from '../../utils/ip-lockout';

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

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }
  
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a default value
  return 'unknown';
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<AccountLoginResponse>>> {
  try {
    // Get the client IP for rate limiting
    const ip = getClientIP(req);
    
    // Check if the IP is locked out
    const { locked, remainingTime } = checkIpLockout(ip);
    if (locked) {
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: `Too many failed attempts. Please try again in ${Math.ceil(remainingTime / 60000)} minutes.`,
        },
        { status: 429 }
      );
    }

    const { email, password }: AccountLoginRequest = await req.json();

    // Validate input
    if (!email || !password) {
      recordFailedAttempt(ip);
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: 'Email and password are required',
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      recordFailedAttempt(ip);
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: 'Please enter a valid email address',
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
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: 'Invalid email or password',
        },
        { status: 401 }
      );
    }

    // Check if account is closed using the proper closed field
    if (account.closed) {
      recordFailedAttempt(ip);
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: 'This account has been closed',
        },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, account.password);
    if (!passwordMatch) {
      recordFailedAttempt(ip);
      return NextResponse.json<ApiResponse<AccountLoginResponse>>(
        {
          success: false,
          error: 'Invalid email or password',
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

    return NextResponse.json<ApiResponse<AccountLoginResponse>>(
      {
        success: true,
        data: response,
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Account login error:', error);
    
    return NextResponse.json<ApiResponse<AccountLoginResponse>>(
      {
        success: false,
        error: 'Internal server error. Please try again later.',
      },
      { status: 500 }
    );
  }
}
