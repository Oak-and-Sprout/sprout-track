import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';
import { toPaymentHistoryItem, findInvoiceForPaymentIntent, PaymentHistoryItem } from '../payment-history-utils';

// Initialize Stripe
// Use a safe initialization pattern to prevent build errors in self-hosted mode where Stripe keys are missing
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2026-07-29.dahlia',
    })
  : ({} as unknown as Stripe);

interface PaymentHistoryData {
  transactions: PaymentHistoryItem[];
  hasMore: boolean;
}

/**
 * GET /api/accounts/payments/payment-history
 *
 * Retrieves payment history for the authenticated account from Stripe.
 * Includes both one-time payments and subscription charges.
 * Requires account owner authentication.
 *
 * Query parameters:
 * - limit: Number of transactions to return (default: 10, max: 100)
 * - starting_after: ID of the last transaction from previous page (for pagination)
 *
 * Returns:
 * - transactions: Array of payment history items
 * - hasMore: Whether there are more transactions available
 */
async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<PaymentHistoryData>>> {
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

    // Fetch account with Stripe customer ID
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        stripeCustomerId: true,
      }
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 404 }
      );
    }

    if (!account.stripeCustomerId) {
      // No Stripe customer ID means no payment history
      return NextResponse.json({
        success: true,
        data: {
          transactions: [],
          hasMore: false,
        }
      });
    }

    // Get pagination parameters from query
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const startingAfter = searchParams.get('starting_after') || undefined;

    // Fetch payment intents for this customer with the latest charge expanded
    const paymentIntents = await stripe.paymentIntents.list({
      customer: account.stripeCustomerId,
      limit,
      starting_after: startingAfter,
      expand: ['data.latest_charge'],
    });

    // Subscription charges link to an invoice only via InvoicePayments (one lookup each)
    const transactions: PaymentHistoryItem[] = await Promise.all(
      paymentIntents.data.map(async (pi) => toPaymentHistoryItem(pi, await findInvoiceForPaymentIntent(stripe, pi.id)))
    );

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        hasMore: paymentIntents.has_more,
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch payment history'
      },
      { status: 500 }
    );
  }
}

export const GET = withAccountOwner(handler);
