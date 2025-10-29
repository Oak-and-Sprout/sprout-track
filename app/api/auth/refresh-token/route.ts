import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '../../utils/auth';
import { ApiResponse } from '../../types';
import jwt from 'jsonwebtoken';
import prisma from '../../db';

// Secret key for JWT signing - in production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';
// Token expiration time in seconds (default to 12 hours if not specified)
const TOKEN_EXPIRATION = parseInt(process.env.AUTH_LIFE || '1800', 10);

/**
 * Refresh JWT token for account users to include updated family information
 */
export async function POST(req: NextRequest) {
  try {
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

    // Only refresh tokens for account authentication
    if (!authResult.isAccountAuth || !authResult.accountId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Token refresh only available for account authentication',
        },
        { status: 400 }
      );
    }

    // Fetch fresh account data with family info
    const account = await prisma.account.findUnique({
      where: { id: authResult.accountId },
      include: {
        family: { select: { id: true, slug: true } },
        caretaker: { select: { id: true, role: true, type: true } }
      }
    });

    if (!account) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Account not found',
        },
        { status: 404 }
      );
    }

    // Create new token with updated family information
    const tokenData = {
      accountId: account.id,
      accountEmail: account.email,
      isAccountAuth: true,
      familyId: account.family?.id || null,
      familySlug: account.family?.slug || null,
      betaparticipant: account.betaparticipant,
      trialEnds: account.trialEnds?.toISOString(),
      planExpires: account.planExpires?.toISOString(),
      planType: account.planType,
      verified: account.verified,
      // Include caretaker info if linked
      ...(account.caretaker && {
        caretakerId: account.caretaker.id,
        caretakerRole: account.caretaker.role,
        caretakerType: account.caretaker.type,
      })
    };

    const newToken = jwt.sign(tokenData, JWT_SECRET, { expiresIn: `${TOKEN_EXPIRATION}s` });

    return NextResponse.json<ApiResponse<{ token: string; familySlug: string | null }>>(
      {
        success: true,
        data: {
          token: newToken,
          familySlug: account.family?.slug || null
        }
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Token refresh failed',
      },
      { status: 500 }
    );
  }
}