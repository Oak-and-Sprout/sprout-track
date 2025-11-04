import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

/**
 * POST /api/accounts/payments/reactivate-subscription
 *
 * Reactivates a cancelled subscription that hasn't ended yet.
 * This removes the cancellation and allows the subscription to continue renewing.
 * Requires account owner authentication.
 *
 * Returns:
 * - success: boolean
 * - message: string
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  try {
    const accountId = authContext.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID not found' },
        { status: 400 }
      );
    }

    // Fetch account with subscription info
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        subscriptionId: true,
        planType: true,
      }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    if (account.planType !== 'sub') {
      return NextResponse.json(
        { success: false, error: 'Account does not have a subscription plan' },
        { status: 400 }
      );
    }

    // Update the subscription in Stripe to remove cancellation
    try {
      const subscription = await stripe.subscriptions.update(account.subscriptionId, {
        cancel_at_period_end: false,
      });

      return NextResponse.json({
        success: true,
        data: {
          message: 'Subscription reactivated successfully'
        }
      });

    } catch (stripeError) {
      console.error('Error reactivating subscription in Stripe:', stripeError);
      return NextResponse.json(
        {
          success: false,
          error: stripeError instanceof Error ? stripeError.message : 'Failed to reactivate subscription in Stripe'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error reactivating subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
      },
      { status: 500 }
    );
  }
}

export const POST = withAccountOwner(handler);
