import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
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
  const accountId = session.metadata?.accountId;
  const planType = session.metadata?.planType;

  if (!accountId) {
    console.error('No accountId in session metadata');
    return;
  }

  try {
    // For subscriptions, the subscription ID will be available
    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

      // Fetch subscription details
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await prisma.account.update({
        where: { id: accountId },
        data: {
          subscriptionId: subscriptionId,
          planType: 'sub',
          planExpires: new Date(subscription.current_period_end * 1000),
          trialEnds: null, // Clear trial when subscription starts
        }
      });

      console.log(`Updated account ${accountId} with subscription ${subscriptionId}`);
    }
    // For one-time payments (lifetime license)
    else if (session.mode === 'payment' && planType === 'full') {
      // Set planExpires to 100 years in the future for lifetime access
      const lifetimeExpires = new Date();
      lifetimeExpires.setFullYear(lifetimeExpires.getFullYear() + 100);

      await prisma.account.update({
        where: { id: accountId },
        data: {
          planType: 'full',
          planExpires: lifetimeExpires,
          subscriptionId: null,
          trialEnds: null, // Clear trial
        }
      });

      console.log(`Updated account ${accountId} with lifetime license`);
    }
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const accountId = subscription.metadata?.accountId;

  if (!accountId) {
    console.error('No accountId in subscription metadata');
    return;
  }

  try {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionId: subscription.id,
        planType: 'sub',
        planExpires: new Date(subscription.current_period_end * 1000),
        trialEnds: null,
      }
    });

    console.log(`Updated subscription for account ${accountId}`);
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const accountId = subscription.metadata?.accountId;

  if (!accountId) {
    console.error('No accountId in subscription metadata');
    return;
  }

  try {
    // When subscription is deleted, keep planExpires to maintain access until end date
    // but clear the subscription ID
    await prisma.account.update({
      where: { id: accountId },
      data: {
        subscriptionId: null,
        // Keep planType and planExpires - user still has access until expiration
      }
    });

    console.log(`Cleared subscription ID for account ${accountId} (access until planExpires)`);
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

/**
 * Handle successful invoice payment (recurring subscription payments)
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  try {
    // Fetch subscription to get metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const accountId = subscription.metadata?.accountId;

    if (!accountId) {
      console.error('No accountId in subscription metadata');
      return;
    }

    // Update the subscription period end date
    await prisma.account.update({
      where: { id: accountId },
      data: {
        planExpires: new Date(subscription.current_period_end * 1000),
      }
    });

    console.log(`Updated planExpires for account ${accountId} after successful payment`);
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  try {
    // Fetch subscription to get metadata
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const accountId = subscription.metadata?.accountId;

    if (!accountId) {
      console.error('No accountId in subscription metadata');
      return;
    }

    // Note: Stripe will automatically retry failed payments
    // We don't immediately disable the account, but could send a notification
    console.log(`Payment failed for account ${accountId} subscription ${subscriptionId}`);

    // Optionally: Send email notification to user about failed payment
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}
