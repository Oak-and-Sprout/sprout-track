import type Stripe from 'stripe';

export interface PaymentHistoryItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  description: string;
  receiptUrl?: string;
  invoiceUrl?: string;
}

/**
 * Resolve the invoice a PaymentIntent paid, if any. Since API 2025-03-31
 * (basil) neither the PaymentIntent nor its Charge links back to an invoice;
 * the InvoicePayments list is the supported lookup. One-time payments have no
 * invoice payment and resolve to null; lookup failures also resolve to null so
 * a single bad record can't break the whole history page.
 */
export async function findInvoiceForPaymentIntent(stripe: Stripe, paymentIntentId: string): Promise<Stripe.Invoice | null> {
  try {
    const { data } = await stripe.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: paymentIntentId },
      limit: 1,
      expand: ['data.invoice'],
    });
    const invoice = data[0]?.invoice;
    if (!invoice || typeof invoice !== 'object' || 'deleted' in invoice) return null;
    return invoice;
  } catch (error) {
    console.error(`Failed to resolve invoice for ${paymentIntentId}:`, error);
    return null;
  }
}

/**
 * Shape one PaymentIntent (listed with `expand: ['data.latest_charge']`) for
 * the payment history UI. `latest_charge` is the only charge reference on a
 * PaymentIntent since API 2022-11-15; when it isn't expanded it's a bare id
 * and the receipt link is simply omitted.
 */
export function toPaymentHistoryItem(pi: Stripe.PaymentIntent, invoice: Stripe.Invoice | null): PaymentHistoryItem {
  const charge = pi.latest_charge && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  return {
    id: pi.id,
    date: new Date(pi.created * 1000).toISOString(),
    amount: pi.amount / 100, // Convert from cents
    currency: pi.currency.toUpperCase(),
    status: pi.status,
    description: pi.description || 'Sprout Track Payment',
    receiptUrl: charge?.receipt_url || undefined,
    invoiceUrl: invoice?.hosted_invoice_url || undefined,
  };
}
