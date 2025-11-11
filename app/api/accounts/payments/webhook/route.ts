import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';

// Runtime configuration - ensure this route is always executed dynamically
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-10-29.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

/**
 * GET /api/accounts/payments/webhook
 *
 * Health check endpoint for webhook URL verification.
 * Returns 405 Method Not Allowed to indicate POST is required.
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. This endpoint only accepts POST requests.' },
    { status: 405 }
  );
}

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
  const startTime = Date.now();
  console.log('[WEBHOOK] Received webhook request');
  
  try {
    // Validate webhook secret is configured
    if (!webhookSecret) {
      console.error('[WEBHOOK ERROR] STRIPE_WEBHOOK_SECRET is not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Get the raw body first (before any parsing) - critical for signature verification
    const body = await req.text();
    console.log('[WEBHOOK DEBUG] Body length:', body.length);

    // Log all headers for debugging
    const allHeaders: Record<string, string> = {};
    const headerNames: string[] = [];
    req.headers.forEach((value, key) => {
      headerNames.push(key);
      // Log header names and first 50 chars of values for debugging
      allHeaders[key] = value.length > 50 ? value.substring(0, 50) + '...' : value;
    });
    console.log('[WEBHOOK DEBUG] All headers received:', JSON.stringify(allHeaders, null, 2));
    console.log('[WEBHOOK DEBUG] Header names:', headerNames.join(', '));
    
    // Get the signature from headers (matching Stripe's Express example)
    // Try multiple header name variations (case-insensitive, with/without hyphens)
    const signature = 
      req.headers.get('stripe-signature') ||
      req.headers.get('Stripe-Signature') ||
      req.headers.get('STRIPE-SIGNATURE') ||
      req.headers.get('stripe_signature');

    if (!signature) {
      console.error('[WEBHOOK ERROR] No Stripe signature found in headers', {
        availableHeaders: Object.keys(allHeaders),
        userAgent: req.headers.get('user-agent'),
        contentType: req.headers.get('content-type'),
      });
      return NextResponse.json(
        { error: 'No signature' },
        { status: 400 }
      );
    }

    console.log('[WEBHOOK DEBUG] Signature found, length:', signature.length);

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      console.log(`[WEBHOOK] Signature verified successfully for event: ${event.type}`);
    } catch (err: any) {
      console.error('[WEBHOOK ERROR] Webhook signature verification failed:', {
        error: err.message,
        type: err.type,
      });
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[WEBHOOK] Processing webhook event: ${event.type} (ID: ${event.id})`);

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

    const processingTime = Date.now() - startTime;
    console.log(`[WEBHOOK SUCCESS] Processed event ${event.type} in ${processingTime}ms`);
    
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('[WEBHOOK ERROR] Webhook handler error:', {
      error: error?.message || error,
      stack: error?.stack,
      processingTime: `${processingTime}ms`,
    });
    
    // Return 500 to allow Stripe to retry transient failures
    // Stripe will retry webhooks that return 5xx status codes
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
  console.log('[WEBHOOK DEBUG] Session customer:', session.customer);

  let accountId = session.metadata?.accountId;
  const planType = session.metadata?.planType;

  // Fallback: Check customer metadata if session metadata is missing (important for Link/Amazon Pay)
  if (!accountId && session.customer) {
    try {
      const customerId = typeof session.customer === 'string' 
        ? session.customer 
        : session.customer.id;
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer && !customer.deleted && customer.metadata?.accountId) {
        accountId = customer.metadata.accountId;
        console.log('[WEBHOOK DEBUG] Found accountId in customer metadata:', accountId);
      }
    } catch (error) {
      console.error('[WEBHOOK ERROR] Error retrieving customer for metadata fallback:', error);
    }
  }

  if (!accountId) {
    console.error('[WEBHOOK ERROR] No accountId in session metadata or customer metadata', {
      sessionId: session.id,
      sessionMetadata: session.metadata,
      customerId: session.customer
    });
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

      // Ensure subscription metadata has accountId (important for Link/Amazon Pay scenarios)
      const subscriptionAccountId = subscription.metadata?.accountId;
      if (!subscriptionAccountId || subscriptionAccountId !== accountId) {
        try {
          await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...subscription.metadata,
              accountId: accountId
            }
          });
          console.log('[WEBHOOK DEBUG] Updated subscription metadata with accountId');
        } catch (error) {
          console.error('[WEBHOOK ERROR] Error updating subscription metadata:', error);
          // Continue with account update even if subscription metadata update fails
        }
      }

      // Ensure customer metadata has accountId (important for Link/Amazon Pay scenarios)
      if (session.customer) {
        try {
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id;
          const customer = await stripe.customers.retrieve(customerId);
          
          if (customer && !customer.deleted && !customer.metadata?.accountId) {
            await stripe.customers.update(customerId, {
              metadata: {
                ...customer.metadata,
                accountId: accountId
              }
            });
            console.log('[WEBHOOK DEBUG] Updated customer metadata with accountId');
          }
        } catch (error) {
          console.error('[WEBHOOK ERROR] Error updating customer metadata:', error);
          // Continue with account update even if customer metadata update fails
        }
      }

      // Get billing period end date from subscription item (API v2025-10-29+ uses item-level periods)
      const periodEnd = subscription.items.data[0]?.current_period_end;

      // Extract customer ID for account update
      const customerId = typeof session.customer === 'string' 
        ? session.customer 
        : session.customer?.id;

      console.log('[WEBHOOK DEBUG] Subscription details:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        items_count: subscription.items.data.length,
        first_item_id: subscription.items.data[0]?.id,
        current_period_end: periodEnd,
        current_period_end_date: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        metadata: subscription.metadata,
        customerId,
      });

      const updateData: any = {
        subscriptionId: subscriptionId,
        planType: 'sub',
        planExpires: periodEnd ? new Date(periodEnd * 1000) : null,
        trialEnds: null, // Clear trial when subscription starts
      };

      // Update customer ID if available
      if (customerId) {
        updateData.stripeCustomerId = customerId;
      }

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

      // Check if user has an active subscription to cancel
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { subscriptionId: true }
      });

      if (account?.subscriptionId) {
        console.log('[WEBHOOK DEBUG] Cancelling existing subscription:', account.subscriptionId);
        try {
          // Cancel the existing subscription immediately
          await stripe.subscriptions.cancel(account.subscriptionId);
          console.log('[WEBHOOK DEBUG] Subscription cancelled successfully');
        } catch (error) {
          console.error('[WEBHOOK ERROR] Failed to cancel subscription:', error);
          // Continue with upgrade even if cancellation fails
        }
      }

      // Ensure customer metadata has accountId (important for Link/Amazon Pay scenarios)
      if (session.customer) {
        try {
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer.id;
          const customer = await stripe.customers.retrieve(customerId);
          
          if (customer && !customer.deleted && !customer.metadata?.accountId) {
            await stripe.customers.update(customerId, {
              metadata: {
                ...customer.metadata,
                accountId: accountId
              }
            });
            console.log('[WEBHOOK DEBUG] Updated customer metadata with accountId for lifetime payment');
          }
        } catch (error) {
          console.error('[WEBHOOK ERROR] Error updating customer metadata:', error);
          // Continue with account update even if customer metadata update fails
        }
      }

      // Set planExpires to 100 years in the future for lifetime access
      const lifetimeExpires = new Date();
      lifetimeExpires.setFullYear(lifetimeExpires.getFullYear() + 100);

      // Extract customer ID for account update
      const customerId = typeof session.customer === 'string' 
        ? session.customer 
        : session.customer?.id;

      const updateData: any = {
        planType: 'full',
        planExpires: lifetimeExpires,
        subscriptionId: null,
        trialEnds: null, // Clear trial
      };

      // Update customer ID if available
      if (customerId) {
        updateData.stripeCustomerId = customerId;
      }

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
