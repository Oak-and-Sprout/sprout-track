import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { ApiResponse } from '@/app/api/utils/auth';

interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  requiresPassword?: boolean;
}

async function handler(req: NextRequest): Promise<NextResponse<ApiResponse<ValidateTokenResponse>>> {
  try {
    const { token }: ValidateTokenRequest = await req.json();

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 });
    }

    // Check if the token exists and is valid
    const setupToken = await prisma.familySetup.findUnique({
      where: { token },
    });

    if (!setupToken) {
      return NextResponse.json({ success: false, error: 'Invalid setup token' }, { status: 404 });
    }

    if (setupToken.expiresAt < new Date()) {
      return NextResponse.json({ success: false, error: 'Setup token has expired' }, { status: 410 });
    }

    if (setupToken.familyId) {
      return NextResponse.json({ success: false, error: 'Setup token has already been used' }, { status: 409 });
    }

    return NextResponse.json({ 
      success: true, 
      data: { 
        valid: true,
        requiresPassword: true, // Always require password for new token system
      } 
    });
  } catch (error) {
    console.error('Error validating setup token:', error);
    return NextResponse.json({ success: false, error: 'Error validating setup token' }, { status: 500 });
  }
}

export const POST = handler; 