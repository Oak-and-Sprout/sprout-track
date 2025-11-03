import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

interface SubscriptionStatusData {
  isActive: boolean;
  planType: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: {
    brand: string;
    last4: string;
  };
}

/**
 * GET /api/accounts/payments/subscription-status
 *
 * Retrieves current subscription status from Stripe.
 * Requires account owner authentication.
 *
 * Returns detailed subscription information including:
 * - Active status
 * - Plan type
 * - Current period end date
 * - Cancellation status
 * - Payment method details
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<SubscriptionStatusData>>> {
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
        planExpires: true,
        stripeCustomerId: true,
      }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // If no subscription ID, return basic status
    if (!account.subscriptionId) {
      return NextResponse.json({
        success: true,
        data: {
          isActive: account.planType === 'full',
          planType: account.planType,
          currentPeriodEnd: account.planExpires?.toISOString() || null,
          cancelAtPeriodEnd: false,
        }
      });
    }

    // Fetch subscription details from Stripe
    try {
      const subscription = await stripe.subscriptions.retrieve(account.subscriptionId, {
        expand: ['default_payment_method']
      });

      // Get payment method details if available
      let paymentMethod: { brand: string; last4: string } | undefined;

      if (subscription.default_payment_method) {
        const pm = subscription.default_payment_method as Stripe.PaymentMethod;
        if (pm.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
          };
        }
      }

      // Get billing period from the first subscription item
      const periodEnd = subscription.items.data[0]?.current_period_end;

      return NextResponse.json({
        success: true,
        data: {
          isActive: subscription.status === 'active' || subscription.status === 'trialing',
          planType: 'sub',
          currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          paymentMethod,
        }
      });

    } catch (stripeError) {
      console.error('Error fetching subscription from Stripe:', stripeError);

      // If Stripe fetch fails, return data from database
      return NextResponse.json({
        success: true,
        data: {
          isActive: account.planType === 'sub',
          planType: account.planType,
          currentPeriodEnd: account.planExpires?.toISOString() || null,
          cancelAtPeriodEnd: false,
        }
      });
    }

  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscription status'
      },
      { status: 500 }
    );
  }
}

export const GET = withAccountOwner(handler);
