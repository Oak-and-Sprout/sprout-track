# Stripe Payment Integration Setup Guide

This guide will help you set up Stripe payments for Sprout Track.

## Overview

The Stripe integration allows users to:
- Subscribe to monthly or annual plans
- Purchase lifetime access with a one-time payment
- Manage their subscriptions (view status, cancel)
- View payment methods and renewal dates

## Prerequisites

1. A Stripe account (sign up at [stripe.com](https://stripe.com))
2. Node.js and npm installed
3. Access to your `.env` file

## Setup Steps

### 1. Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on **Developers** in the left sidebar
3. Click on **API keys**
4. Copy your **Publishable key** and **Secret key**
   - For testing, use the test keys (they start with `pk_test_` and `sk_test_`)
   - For production, use live keys (they start with `pk_live_` and `sk_live_`)

### 2. Create Products and Prices in Stripe

1. In the Stripe Dashboard, go to **Products** → **Add product**
2. Create three products:

   **Monthly Subscription:**
   - Name: "Monthly Subscription"
   - Description: "Access to all Sprout Track features"
   - Pricing: Recurring, $4.99/month
   - Copy the Price ID (starts with `price_`)

   **Annual Subscription:**
   - Name: "Annual Subscription"
   - Description: "Best value - save 33%"
   - Pricing: Recurring, $39.99/year
   - Copy the Price ID (starts with `price_`)

   **Lifetime Access:**
   - Name: "Lifetime Access"
   - Description: "One-time payment for lifetime access"
   - Pricing: One-time, $99.99
   - Copy the Price ID (starts with `price_`)

### 3. Set Up Webhook

1. In the Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set the endpoint URL to: `https://yourdomain.com/api/accounts/payments/webhook`
   - For local testing: Use [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhooks
4. Select these events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy the **Signing secret** (starts with `whsec_`)

### 4. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY="sk_test_your_secret_key_here"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_your_publishable_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID="price_your_monthly_price_id"
NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID="price_your_annual_price_id"
NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID="price_your_lifetime_price_id"

# Application URL (for Stripe redirects)
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
# For local development:
# NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 5. Test the Integration

#### Local Testing with Stripe CLI

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli)
2. Log in to Stripe CLI:
   ```bash
   stripe login
   ```
3. Forward webhooks to your local server:
   ```bash
   stripe listen --forward-to localhost:3000/api/accounts/payments/webhook
   ```
4. Use the webhook signing secret provided by the CLI in your `.env` file

#### Test Cards

Use these test card numbers in Stripe Checkout:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires authentication:** 4000 0025 0000 3155

Use any future expiration date, any 3-digit CVC, and any zip code.

### 6. Verify the Integration

1. Start your Next.js application
2. Log in to your account
3. Navigate to Account Manager
4. Click "Upgrade Plan" or "Manage Subscription"
5. Select a plan and complete the checkout process
6. Verify:
   - Payment success page appears
   - Account status updates in the Account Manager
   - Subscription details are visible
   - Webhook events are received in Stripe Dashboard

## Features

### For Users

- **Payment Modal**: Clean, modern UI for selecting plans
- **Multiple Payment Options**:
  - Monthly subscription ($4.99/month)
  - Annual subscription ($39.99/year) - best value
  - Lifetime access ($99.99) - one-time payment
- **Subscription Management**:
  - View current plan and expiration date
  - See payment method details
  - Cancel subscription (access until period end)
- **Trial to Paid**: Seamless upgrade from trial accounts

### For Developers

- **Secure Payment Processing**: All payment data handled by Stripe
- **Webhook Integration**: Automatic subscription updates
- **Account Status Tracking**: Real-time subscription state
- **Error Handling**: Comprehensive error messages and retry logic
- **Type Safety**: Full TypeScript support

## API Endpoints

### Created Endpoints

1. **POST /api/accounts/payments/create-checkout-session**
   - Creates Stripe Checkout session
   - Requires: `priceId`, `planType`
   - Returns: `sessionId` for redirect

2. **POST /api/accounts/payments/webhook**
   - Handles Stripe webhook events
   - Updates account subscription status
   - No authentication (uses webhook signature)

3. **GET /api/accounts/payments/subscription-status**
   - Retrieves current subscription details
   - Returns: plan info, renewal date, payment method

4. **POST /api/accounts/payments/cancel-subscription**
   - Cancels active subscription
   - Maintains access until period end

## Database Schema

The integration uses existing Prisma schema fields:

```prisma
model Account {
  stripeCustomerId String?      // Stripe customer ID
  subscriptionId   String?      // Current subscription ID
  planType         String?      // 'sub' or 'full'
  planExpires      DateTime?    // Subscription end date
  trialEnds        DateTime?    // Trial end date
}
```

## Security Considerations

1. **Webhook Signature Verification**: All webhooks are verified using Stripe signatures
2. **Account Owner Authentication**: Payment endpoints require account owner access
3. **PCI Compliance**: No card data stored or handled by your application
4. **Environment Variables**: Sensitive keys stored in environment variables

## Troubleshooting

### Webhook Not Working

- Verify webhook URL is accessible publicly
- Check webhook signing secret is correct
- View webhook logs in Stripe Dashboard
- Use Stripe CLI for local testing

### Payment Not Updating Account

- Check webhook events are being received
- View webhook event details in Stripe Dashboard
- Check server logs for webhook handler errors
- Verify account ID is in session metadata

### Checkout Session Creation Fails

- Verify Price IDs are correct
- Check Stripe API keys are valid
- Ensure products are active in Stripe
- Check server logs for detailed error messages

## Going to Production

1. Switch from test keys to live keys in `.env`
2. Update webhook endpoint to production URL
3. Test with real payment methods
4. Set up proper error monitoring
5. Configure billing emails in Stripe
6. Set up customer portal for self-service management (optional)

## Support

For Stripe-specific issues:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

For application-specific issues:
- Check server logs
- Review webhook event logs in Stripe Dashboard
- Contact development team

## Future Enhancements

Potential improvements to consider:
- Customer portal integration for self-service
- Proration handling for plan changes
- Coupon/discount code support
- Multiple payment methods per customer
- Usage-based billing
- Team/family plan management
