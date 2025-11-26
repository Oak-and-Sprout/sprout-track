import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';

// Initialize Stripe
// Use a safe initialization pattern to prevent build errors in self-hosted mode where Stripe keys are missing
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    })
  : ({} as unknown as Stripe);

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

    // In self-hosted mode or if Stripe is not configured, return basic status from DB
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    if (deploymentMode !== 'saas' || !stripeKey) {
      return NextResponse.json({
        success: true,
        data: {
          isActive: account.planType === 'full', // Simple logic: full plan is always active, subs might depend
          planType: account.planType,
          currentPeriodEnd: account.planExpires?.toISOString() || null,
          cancelAtPeriodEnd: false,
        }
      });
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
      }) as Stripe.Subscription;

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

      // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
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
