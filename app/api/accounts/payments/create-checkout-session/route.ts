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
 * POST /api/accounts/payments/create-checkout-session
 *
 * Creates a Stripe Checkout session for subscription or one-time purchase.
 * Requires account owner authentication.
 *
 * Request body:
 * - priceId: string - Stripe price ID
 * - planType: 'sub' | 'full' - Type of plan (subscription or full license)
 *
 * Returns:
 * - sessionId: string - Stripe Checkout session ID for redirect
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<{ sessionId: string; url: string | null }>>> {
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
    const { priceId, planType } = body;

    if (!priceId || !planType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: priceId, planType' },
        { status: 400 }
      );
    }

    if (!['sub', 'full'].includes(planType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid planType. Must be "sub" or "full"' },
        { status: 400 }
      );
    }

    // Fetch account to get or create Stripe customer
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        stripeCustomerId: true,
      }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    // Get or create Stripe customer
    let customerId = account.stripeCustomerId;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: account.email,
        name: `${account.firstName} ${account.lastName || ''}`.trim(),
        metadata: {
          accountId: account.id,
        }
      });

      customerId = customer.id;

      // Update account with Stripe customer ID
      await prisma.account.update({
        where: { id: accountId },
        data: { stripeCustomerId: customerId }
      });
    }

    // Get the app URL for success/cancel redirects
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create Stripe Checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: planType === 'sub' ? 'subscription' : 'payment',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      success_url: `${appUrl}/account/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/account/payment-cancelled`,
      metadata: {
        accountId: account.id,
        planType: planType,
      }
    };

    // Add subscription-specific parameters
    if (planType === 'sub') {
      sessionParams.subscription_data = {
        metadata: {
          accountId: account.id,
        }
      };
    } else {
      // For one-time payments, add payment metadata
      sessionParams.payment_intent_data = {
        metadata: {
          accountId: account.id,
          planType: 'full',
        }
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url
      }
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      },
      { status: 500 }
    );
  }
}

export const POST = withAccountOwner(handler);
