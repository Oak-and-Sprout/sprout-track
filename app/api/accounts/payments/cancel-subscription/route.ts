import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

/**
 * POST /api/accounts/payments/cancel-subscription
 *
 * Cancels the user's active subscription.
 * The subscription will remain active until the end of the current billing period.
 * Requires account owner authentication.
 *
 * Returns success status and updated subscription information.
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

    // Check if account has a subscription to cancel
    if (!account.subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Check if it's a lifetime plan (cannot be cancelled)
    if (account.planType === 'full') {
      return NextResponse.json(
        { success: false, error: 'Lifetime plans cannot be cancelled' },
        { status: 400 }
      );
    }

    // Cancel the subscription at period end (user keeps access until then)
    try {
      const subscription = await stripe.subscriptions.update(
        account.subscriptionId,
        {
          cancel_at_period_end: true,
        }
      ) as Stripe.Subscription;

      console.log(`Cancelled subscription ${account.subscriptionId} for account ${accountId}`);

      // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
      const periodEnd = subscription.items.data[0]?.current_period_end;
      const endDate = periodEnd ? new Date(periodEnd * 1000).toLocaleDateString() : 'the end of your billing period';

      return NextResponse.json({
        success: true,
        data: {
          message: `Subscription cancelled. You will have access until ${endDate}`
        }
      });

    } catch (stripeError) {
      console.error('Error cancelling subscription in Stripe:', stripeError);

      // If the subscription doesn't exist in Stripe anymore, clean up our database
      if (stripeError instanceof Stripe.errors.StripeError && stripeError.code === 'resource_missing') {
        await prisma.account.update({
          where: { id: accountId },
          data: {
            subscriptionId: null,
          }
        });

        return NextResponse.json(
          { success: false, error: 'Subscription not found in payment system' },
          { status: 404 }
        );
      }

      throw stripeError;
    }

  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      },
      { status: 500 }
    );
  }
}

export const POST = withAccountOwner(handler);
