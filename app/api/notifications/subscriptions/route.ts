import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';

/**
 * GET handler for listing push subscriptions
 * Returns all subscriptions for the authenticated user
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        familyId,
        OR: [
          accountId ? { accountId } : {},
          caretakerId ? { caretakerId } : {},
        ],
      },
      select: {
        id: true,
        endpoint: true,
        deviceLabel: true,
        userAgent: true,
        failureCount: true,
        lastFailureAt: true,
        lastSuccessAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json<ApiResponse<typeof subscriptions>>({
      success: true,
      data: subscriptions,
    });
  } catch (error: any) {
    console.error('Error fetching push subscriptions:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch push subscriptions',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
