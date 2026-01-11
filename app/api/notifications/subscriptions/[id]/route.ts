import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';

/**
 * DELETE handler for removing a specific push subscription
 * Removes subscription by ID
 */
async function handleDelete(
  req: NextRequest,
  authContext: AuthResult
) {
  try {
    const { familyId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    // Extract subscription ID from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const subscriptionId = pathParts[pathParts.length - 1];

    // Find subscription and verify it belongs to user's family
    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Subscription not found',
        },
        { status: 404 }
      );
    }

    if (subscription.familyId !== familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Access denied',
        },
        { status: 403 }
      );
    }

    // Delete subscription (cascades to NotificationPreference records)
    await prisma.pushSubscription.delete({
      where: { id: subscriptionId },
    });

    return NextResponse.json<ApiResponse<null>>({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to delete push subscription',
      },
      { status: 500 }
    );
  }
}

export const DELETE = withAuthContext(handleDelete);
