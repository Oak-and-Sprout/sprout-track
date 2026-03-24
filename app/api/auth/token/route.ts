import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { ApiResponse } from '@/app/api/utils/auth';
import jwt from 'jsonwebtoken';

interface TokenAuthRequest {
  token: string;
  password: string;
}

interface TokenAuthResponse {
  success: boolean;
  token: string;
  expiresAt: number;
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse<TokenAuthResponse>>> {
  try {
    const { token, password }: TokenAuthRequest = await req.json();

    if (!token || !password) {
      return NextResponse.json({
        success: false,
        error: 'Token and password are required',
      }, { status: 400 });
    }

    // Find the setup token
    const setupToken = await prisma.familySetup.findUnique({
      where: { token },
    });

    if (!setupToken) {
      return NextResponse.json({
        success: false,
        error: 'Invalid setup token',
      }, { status: 404 });
    }

    // Check if token is expired
    if (setupToken.expiresAt < new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Setup token has expired',
      }, { status: 410 });
    }

    // Check if token has already been used
    if (setupToken.familyId) {
      return NextResponse.json({
        success: false,
        error: 'Setup token has already been used',
      }, { status: 409 });
    }

    // Verify password
    if (setupToken.password !== password) {
      return NextResponse.json({
        success: false,
        error: 'Invalid password',
      }, { status: 401 });
    }

    // Create JWT token for setup session
    const jwtSecret = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';

    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    const authToken = jwt.sign(
      {
        setupToken: token,
        isSetupAuth: true,
        exp: Math.floor(expiresAt / 1000),
      },
      jwtSecret
    );

    return NextResponse.json({
      success: true,
      data: {
        success: true,
        token: authToken,
        expiresAt,
      },
    });
  } catch (error) {
    console.error('Token authentication error:', error);
    return NextResponse.json({
      success: false,
      error: 'Authentication failed',
    }, { status: 500 });
  }
} 