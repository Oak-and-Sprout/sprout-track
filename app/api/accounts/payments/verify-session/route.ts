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

/**
 * POST /api/accounts/payments/verify-session
 *
 * Verifies a Stripe Checkout session and updates account status immediately.
 * This is called from the payment success page to ensure the account is updated
 * before the user returns to the app, rather than waiting for the webhook.
 *
 * Request body:
 * - sessionId: string - Stripe Checkout session ID
 *
 * Returns:
 * - success: boolean
 * - planType: string - The activated plan type
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<{ planType: string; subscriptionId?: string }>>> {
  try {
    // Check deployment mode - payments are only available in SaaS mode
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    if (deploymentMode !== 'saas') {
      return NextResponse.json(
        { success: false, error: 'Payments are disabled in self-hosted mode' },
        { status: 404 }
      );
    }

    // Check if Stripe is properly configured
    if (!stripeKey) {
      console.error('[PAYMENT ERROR] STRIPE_SECRET_KEY is not configured');
      return NextResponse.json(
        { success: false, error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const accountId = authContext.accountId;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID not found' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId' },
        { status: 400 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'payment_intent']
    });

    // Verify the session belongs to this account
    if (session.metadata?.accountId !== accountId) {
      return NextResponse.json(
        { success: false, error: 'Session does not belong to this account' },
        { status: 403 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment not completed' },
        { status: 400 }
      );
    }

    const planType = session.metadata?.planType as 'sub' | 'full';

    if (!planType || !['sub', 'full'].includes(planType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid plan type in session' },
        { status: 400 }
      );
    }

    // Update account based on plan type
    if (planType === 'sub') {
      // Subscription
      const subscription = session.subscription as Stripe.Subscription;

      if (!subscription) {
        return NextResponse.json(
          { success: false, error: 'Subscription not found' },
          { status: 400 }
        );
      }

      // Get the subscription item's current period end
      const periodEnd = subscription.items.data[0]?.current_period_end;

      await prisma.account.update({
        where: { id: accountId },
        data: {
          planType: 'sub',
          subscriptionId: subscription.id,
          planExpires: periodEnd ? new Date(periodEnd * 1000) : null,
          stripeCustomerId: session.customer as string,
          trialEnds: null, // Clear trial when subscription starts
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          planType: 'sub',
          subscriptionId: subscription.id,
        }
      });

    } else {
      // One-time payment (lifetime)

      // Check if user has an active subscription to cancel
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { subscriptionId: true }
      });

      if (account?.subscriptionId) {
        try {
          // Cancel the existing subscription immediately
          await stripe.subscriptions.cancel(account.subscriptionId);
          console.log('Cancelled existing subscription:', account.subscriptionId);
        } catch (error) {
          console.error('Failed to cancel subscription:', error);
          // Continue with upgrade even if cancellation fails
        }
      }

      // Set planExpires to 100 years in the future for lifetime access
      const lifetimeExpires = new Date();
      lifetimeExpires.setFullYear(lifetimeExpires.getFullYear() + 100);

      await prisma.account.update({
        where: { id: accountId },
        data: {
          planType: 'full',
          planExpires: lifetimeExpires, // Lifetime access (100 years)
          stripeCustomerId: session.customer as string,
          trialEnds: null, // Clear trial
          subscriptionId: null, // Clear subscription ID
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          planType: 'full',
        }
      });
    }

  } catch (error) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to verify session'
      },
      { status: 500 }
    );
  }
}

export const POST = withAccountOwner(handler);
