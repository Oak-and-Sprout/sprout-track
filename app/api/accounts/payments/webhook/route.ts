import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * POST /api/accounts/payments/webhook
 *
 * Handles Stripe webhook events.
 * Updates account records based on payment events.
 *
 * This endpoint does not require authentication as it receives
 * signed events from Stripe's servers.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('No Stripe signature found');
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`Processing webhook event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout session completion
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('[WEBHOOK DEBUG] handleCheckoutSessionCompleted called');
  console.log('[WEBHOOK DEBUG] Session mode:', session.mode);
  console.log('[WEBHOOK DEBUG] Session metadata:', session.metadata);
  console.log('[WEBHOOK DEBUG] Session subscription:', session.subscription);

  const accountId = session.metadata?.accountId;
  const planType = session.metadata?.planType;

  if (!accountId) {
    console.error('[WEBHOOK ERROR] No accountId in session metadata');
    return;
  }

  try {
    // For subscriptions, the subscription ID will be available
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

      console.log('[WEBHOOK DEBUG] Processing subscription:', subscriptionId);

      // Fetch subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;

      // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
      const periodEnd = subscription.items.data[0]?.current_period_end;

      console.log('[WEBHOOK DEBUG] Subscription details:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        items_count: subscription.items.data.length,
        first_item_id: subscription.items.data[0]?.id,
        current_period_end: periodEnd,
        current_period_end_date: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
      });

      const updateData = {
        subscriptionId: subscriptionId,
        planType: 'sub',
        planExpires: periodEnd ? new Date(periodEnd * 1000) : null,
        trialEnds: null, // Clear trial when subscription starts
      };

      console.log('[WEBHOOK DEBUG] Updating account with data:', updateData);

      await prisma.account.update({
        where: { id: accountId },
        data: updateData
      });

      console.log(`[WEBHOOK SUCCESS] Updated account ${accountId} with subscription ${subscriptionId}`);
    }
    // For one-time payments (lifetime license)
    else if (session.mode === 'payment' && planType === 'full') {
      console.log('[WEBHOOK DEBUG] Processing lifetime payment for account:', accountId);

      // Set planExpires to 100 years in the future for lifetime access
      const lifetimeExpires = new Date();
      lifetimeExpires.setFullYear(lifetimeExpires.getFullYear() + 100);

      const updateData = {
        planType: 'full',
        planExpires: lifetimeExpires,
        subscriptionId: null,
        trialEnds: null, // Clear trial
      };

      console.log('[WEBHOOK DEBUG] Updating account with lifetime data:', updateData);

      await prisma.account.update({
        where: { id: accountId },
        data: updateData
      });

      console.log(`[WEBHOOK SUCCESS] Updated account ${accountId} with lifetime license`);
    } else {
      console.log('[WEBHOOK WARNING] Unhandled checkout session mode/type:', {
        mode: session.mode,
        planType,
        hasSubscription: !!session.subscription
      });
    }
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling checkout session completed:', error);
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log('[WEBHOOK DEBUG] handleSubscriptionUpdate called');
  console.log('[WEBHOOK DEBUG] Subscription ID:', subscription.id);
  console.log('[WEBHOOK DEBUG] Subscription status:', subscription.status);
  console.log('[WEBHOOK DEBUG] Subscription metadata:', subscription.metadata);

  const accountId = subscription.metadata?.accountId;

  if (!accountId) {
    console.error('[WEBHOOK ERROR] No accountId in subscription metadata');
    return;
  }

  try {
    // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
    const periodEnd = subscription.items.data[0]?.current_period_end;

    console.log('[WEBHOOK DEBUG] Subscription item details:', {
      items_count: subscription.items.data.length,
      first_item_id: subscription.items.data[0]?.id,
      current_period_end: periodEnd,
      current_period_end_date: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });

    const updateData = {
      subscriptionId: subscription.id,
      planType: 'sub',
      planExpires: periodEnd ? new Date(periodEnd * 1000) : null,
      trialEnds: null,
    };

    console.log('[WEBHOOK DEBUG] Updating account with data:', updateData);

    await prisma.account.update({
      where: { id: accountId },
      data: updateData
    });

    console.log(`[WEBHOOK SUCCESS] Updated subscription for account ${accountId}`);
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling subscription update:', error);
  }
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[WEBHOOK DEBUG] handleSubscriptionDeleted called');
  console.log('[WEBHOOK DEBUG] Subscription ID:', subscription.id);
  console.log('[WEBHOOK DEBUG] Subscription metadata:', subscription.metadata);

  const accountId = subscription.metadata?.accountId;

  if (!accountId) {
    console.error('[WEBHOOK ERROR] No accountId in subscription metadata');
    return;
  }

  try {
    // Get current account data to log what we're preserving
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { planType: true, planExpires: true }
    });

    console.log('[WEBHOOK DEBUG] Current account data:', {
      planType: account?.planType,
      planExpires: account?.planExpires?.toISOString(),
    });

    // When subscription is deleted, keep planExpires to maintain access until end date
    // but clear the subscription ID
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionId: null,
        // Keep planType and planExpires - user still has access until expiration
      }
    });

    console.log(`[WEBHOOK SUCCESS] Cleared subscription ID for account ${accountId} (access until planExpires: ${account?.planExpires?.toISOString()})`);
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling subscription deletion:', error);
  }
}

/**
 * Handle successful invoice payment (recurring subscription payments)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[WEBHOOK DEBUG] handleInvoicePaymentSucceeded called');
  console.log('[WEBHOOK DEBUG] Invoice ID:', invoice.id);
  console.log('[WEBHOOK DEBUG] Invoice billing_reason:', invoice.billing_reason);
  console.log('[WEBHOOK DEBUG] Invoice parent:', invoice.parent);

  // Get subscription from parent.subscription_details (API v2025-10-29+)
  const subscriptionId = (invoice.parent as any)?.subscription_details?.subscription
    ? (typeof (invoice.parent as any).subscription_details.subscription === 'string'
        ? (invoice.parent as any).subscription_details.subscription
        : (invoice.parent as any).subscription_details.subscription.id)
    : null;

  if (!subscriptionId) {
    console.log('[WEBHOOK DEBUG] No subscription ID in invoice parent.subscription_details, skipping');
    return;
  }

  console.log('[WEBHOOK DEBUG] Processing payment for subscription:', subscriptionId);

  try {
    // Fetch subscription to get metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
    const accountId = subscription.metadata?.accountId;

    if (!accountId) {
      console.error('[WEBHOOK ERROR] No accountId in subscription metadata');
      return;
    }

    // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
    const periodEnd = subscription.items.data[0]?.current_period_end;

    console.log('[WEBHOOK DEBUG] Invoice payment details:', {
      subscriptionId: subscription.id,
      accountId,
      items_count: subscription.items.data.length,
      current_period_end: periodEnd,
      current_period_end_date: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    });

    // Update the subscription period end date
    await prisma.account.update({
      where: { id: accountId },
      data: {
        planExpires: periodEnd ? new Date(periodEnd * 1000) : null,
      }
    });

    console.log(`[WEBHOOK SUCCESS] Updated planExpires for account ${accountId} after successful payment to ${periodEnd ? new Date(periodEnd * 1000).toISOString() : null}`);
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[WEBHOOK DEBUG] handleInvoicePaymentFailed called');
  console.log('[WEBHOOK DEBUG] Invoice ID:', invoice.id);
  console.log('[WEBHOOK DEBUG] Invoice billing_reason:', invoice.billing_reason);
  console.log('[WEBHOOK DEBUG] Invoice parent:', invoice.parent);

  // Get subscription from parent.subscription_details (API v2025-10-29+)
  const subscriptionId = (invoice.parent as any)?.subscription_details?.subscription
    ? (typeof (invoice.parent as any).subscription_details.subscription === 'string'
        ? (invoice.parent as any).subscription_details.subscription
        : (invoice.parent as any).subscription_details.subscription.id)
    : null;

  if (!subscriptionId) {
    console.log('[WEBHOOK DEBUG] No subscription ID in invoice parent.subscription_details, skipping');
    return;
  }

  console.log('[WEBHOOK DEBUG] Processing failed payment for subscription:', subscriptionId);

  try {
    // Fetch subscription to get metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId) as Stripe.Subscription;
    const accountId = subscription.metadata?.accountId;

    if (!accountId) {
      console.error('[WEBHOOK ERROR] No accountId in subscription metadata');
      return;
    }

    console.log('[WEBHOOK DEBUG] Failed payment details:', {
      subscriptionId: subscription.id,
      accountId,
      status: subscription.status,
      invoice_id: invoice.id,
    });

    // Note: Stripe will automatically retry failed payments
    // We don't immediately disable the account, but could send a notification
    console.log(`[WEBHOOK WARNING] Payment failed for account ${accountId} subscription ${subscriptionId}`);

    // Optionally: Send email notification to user about failed payment
    // TODO: Implement email notification for failed payments
  } catch (error) {
    console.error('[WEBHOOK ERROR] Error handling invoice payment failed:', error);
  }
}
