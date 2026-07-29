import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ApiResponse } from '@/app/api/utils/auth';
import { isValidGiftEmail, resolveGiftPriceId } from '@/src/utils/giftCodeUtils';

// Unauthenticated by design: anyone may buy a gift from the marketing pages.
// The price is resolved server-side and the session carries no account
// context — fulfillment (webhook) only creates a GiftCode row.
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    })
  : ({} as unknown as Stripe);

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ sessionId: string; url: string | null }>>> {
  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    if (deploymentMode !== 'saas') {
      return NextResponse.json(
        { success: false, error: 'Gift purchases are disabled in self-hosted mode' },
        { status: 404 }
      );
    }

    if (!stripeKey) {
      console.error('[GIFT ERROR] STRIPE_SECRET_KEY is not configured');
      return NextResponse.json(
        { success: false, error: 'Payment system not configured' },
        { status: 500 }
      );
    }

    const priceId = resolveGiftPriceId({
      STRIPE_GIFT_PRICE_ID: process.env.STRIPE_GIFT_PRICE_ID,
      NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID: process.env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID,
    });
    if (!priceId) {
      console.error('[GIFT ERROR] No gift or lifetime price ID configured');
      return NextResponse.json(
        { success: false, error: 'Gift purchases are not configured' },
        { status: 500 }
      );
    }

    // Optional prefill email (e.g. from the account manager). Prefill only —
    // the authoritative purchaser email comes from Stripe at fulfillment.
    let email: string | undefined;
    try {
      const body = await req.json();
      if (isValidGiftEmail(body?.email)) {
        email = body.email;
      }
    } catch {
      // no body is fine
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(email ? { customer_email: email } : {}),
      success_url: `${appUrl}/gift-success`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { purchaseType: 'gift' },
      payment_intent_data: { metadata: { purchaseType: 'gift' } },
    });

    return NextResponse.json({
      success: true,
      data: { sessionId: session.id, url: session.url },
    });
  } catch (error) {
    console.error('[GIFT ERROR] Error creating gift checkout session:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
