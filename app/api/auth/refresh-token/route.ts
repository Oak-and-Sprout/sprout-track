import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';
import {
  verifyRefreshToken,
  createRefreshToken,
  setRefreshTokenCookie,
  ACCESS_TOKEN_LIFE,
} from '../../utils/auth';
import jwt from 'jsonwebtoken';
import prisma from '../../db';

const JWT_SECRET = process.env.JWT_SECRET || 'baby-tracker-jwt-secret';

/**
 * Refresh access token using the HTTP-only refresh token cookie.
 * Works for all auth types: CARETAKER, SYSTEM, ACCOUNT, SYSADMIN.
 * Issues a new access token and rotates the refresh token cookie (sliding window).
 */
export async function POST(req: NextRequest) {
  try {
    // Read refresh token from HTTP-only cookie
    const refreshTokenCookie = req.cookies.get('refreshToken')?.value;

    if (!refreshTokenCookie) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'No refresh token' },
        { status: 401 }
      );
    }

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshTokenCookie);
    if (!payload) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    let accessTokenData: Record<string, any>;
    let familySlug: string | null = null;

    switch (payload.authType) {
      case 'SYSADMIN': {
        accessTokenData = {
          id: 'sysadmin',
          name: 'System Administrator',
          type: 'SYSADMIN',
          role: 'SYSADMIN',
          familyId: null,
          familySlug: null,
          isSysAdmin: true,
        };
        break;
      }

      case 'ACCOUNT': {
        if (!payload.accountId) {
          return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Invalid refresh token payload' },
            { status: 401 }
          );
        }

        const account = await prisma.account.findUnique({
          where: { id: payload.accountId },
          include: {
            family: { select: { id: true, slug: true } },
            caretaker: { select: { id: true, role: true, type: true } },
          },
        });

        if (!account || account.closed) {
          return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Account not found or closed' },
            { status: 401 }
          );
        }

        familySlug = account.family?.slug || null;

        accessTokenData = {
          id: account.id,
          name: account.firstName || 'User',
          type: 'ACCOUNT',
          role: 'OWNER',
          familyId: account.family?.id || null,
          familySlug,
          isAccountAuth: true,
          accountId: account.id,
          accountEmail: account.email,
          verified: account.verified,
          betaparticipant: account.betaparticipant,
          trialEnds: account.trialEnds?.toISOString(),
          planExpires: account.planExpires?.toISOString(),
          planType: account.planType,
          ...(account.caretaker && {
            caretakerId: account.caretaker.id,
            caretakerRole: account.caretaker.role,
            caretakerType: account.caretaker.type,
          }),
        };
        break;
      }

      case 'CARETAKER':
      case 'SYSTEM': {
        const caretaker = await prisma.caretaker.findFirst({
          where: {
            id: payload.userId,
            deletedAt: null,
            inactive: false,
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
                  },
                },
              },
            },
          },
        });

        if (!caretaker) {
          return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'Caretaker not found or inactive' },
            { status: 401 }
          );
        }

        familySlug = caretaker.family?.slug || null;

        accessTokenData = {
          id: caretaker.id,
          name: caretaker.name,
          type: caretaker.type,
          role: (caretaker as any).role || (payload.authType === 'SYSTEM' ? 'ADMIN' : 'USER'),
          familyId: caretaker.familyId,
          familySlug,
          authType: payload.authType,
          isAccountAuth: false,
        };

        // Add subscription data if family has an account (for SAAS mode)
        if (caretaker.family?.account) {
          accessTokenData.betaparticipant = caretaker.family.account.betaparticipant;
          accessTokenData.trialEnds = caretaker.family.account.trialEnds?.toISOString();
          accessTokenData.planExpires = caretaker.family.account.planExpires?.toISOString();
          accessTokenData.planType = caretaker.family.account.planType;
        }
        break;
      }

      default:
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Unknown auth type' },
          { status: 401 }
        );
    }

    // Sign new access token
    const newAccessToken = jwt.sign(accessTokenData, JWT_SECRET, {
      expiresIn: `${ACCESS_TOKEN_LIFE}s`,
    });

    // Create response
    const response = NextResponse.json<ApiResponse<{ token: string; familySlug: string | null }>>(
      {
        success: true,
        data: {
          token: newAccessToken,
          familySlug,
        },
      }
    );

    // Sliding window: issue a new refresh token cookie with fresh expiry
    const newRefreshToken = createRefreshToken({
      userId: payload.userId,
      authType: payload.authType,
      familyId: payload.familyId,
      accountId: payload.accountId,
    });
    setRefreshTokenCookie(response, newRefreshToken);

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Token refresh failed' },
      { status: 500 }
    );
  }
}
