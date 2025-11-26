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

interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  receiptUrl?: string;
  invoiceUrl?: string;
}

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

    // Fetch payment intents for this customer with charges expanded
    const paymentIntents = await stripe.paymentIntents.list({
      customer: account.stripeCustomerId,
      limit,
      starting_after: startingAfter,
      expand: ['data.charges'],
    });

    // Transform payment intents into our format
    const transactions: PaymentHistoryItem[] = paymentIntents.data.map((pi) => {
      // Get charge for receipt URL - charges are expanded
      // Use type assertion since charges are expanded but not typed in the PaymentIntent type
      const piWithCharges = pi as Stripe.PaymentIntent & {
        charges?: Stripe.ApiList<Stripe.Charge>;
      };
      const charge = piWithCharges.charges?.data?.[0];

      return {
        id: pi.id,
        date: new Date(pi.created * 1000).toISOString(),
        amount: pi.amount / 100, // Convert from cents
        currency: pi.currency.toUpperCase(),
        status: pi.status,
        description: pi.description || 'Sprout Track Payment',
        receiptUrl: charge?.receipt_url || undefined,
        invoiceUrl: charge && typeof (charge as any).invoice === 'string'
          ? `https://invoice.stripe.com/i/${((charge as any).invoice as string).split('_secret_')[0]}`
          : undefined,
      };
    });

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
