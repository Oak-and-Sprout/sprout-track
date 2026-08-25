import { describe, it, expect, vi } from 'vitest';
import { toPaymentHistoryItem, findInvoiceForPaymentIntent } from '@/app/api/accounts/payments/payment-history-utils';

const base = {
  id: 'pi_1',
  created: 1_700_000_000,
  amount: 1999,
  currency: 'usd',
  status: 'succeeded',
  description: null,
  latest_charge: null,
};

describe('toPaymentHistoryItem', () => {
  it('maps a payment intent with an expanded latest_charge and its invoice', () => {
    const item = toPaymentHistoryItem(
      { ...base, description: 'Monthly plan', latest_charge: { id: 'ch_1', receipt_url: 'https://r/1' } } as any,
      { id: 'in_1', hosted_invoice_url: 'https://invoice.stripe.com/i/in_1' } as any
    );
    expect(item).toEqual({
      id: 'pi_1',
      date: new Date(1_700_000_000 * 1000).toISOString(),
      amount: 19.99,
      currency: 'USD',
      status: 'succeeded',
      description: 'Monthly plan',
      receiptUrl: 'https://r/1',
      invoiceUrl: 'https://invoice.stripe.com/i/in_1',
    });
  });
  it('omits the receipt url when latest_charge is null or an unexpanded id', () => {
    expect(toPaymentHistoryItem(base as any, null).receiptUrl).toBeUndefined();
    expect(toPaymentHistoryItem({ ...base, latest_charge: 'ch_1' } as any, null).receiptUrl).toBeUndefined();
  });
  it('omits invoiceUrl for one-time payments (no invoice) and defaults the description', () => {
    const item = toPaymentHistoryItem({ ...base, latest_charge: { id: 'ch_1', receipt_url: null } } as any, null);
    expect(item.invoiceUrl).toBeUndefined();
    expect(item.receiptUrl).toBeUndefined();
    expect(item.description).toBe('Sprout Track Payment');
  });
  it('omits invoiceUrl when the invoice has no hosted url', () => {
    expect(toPaymentHistoryItem(base as any, { id: 'in_1', hosted_invoice_url: null } as any).invoiceUrl).toBeUndefined();
  });
});

describe('findInvoiceForPaymentIntent', () => {
  const stripeWith = (data: unknown[]) => {
    const list = vi.fn().mockResolvedValue({ data });
    return { stripe: { invoicePayments: { list } } as any, list };
  };
  it('queries invoice payments by payment intent with the invoice expanded', async () => {
    const invoice = { id: 'in_1', hosted_invoice_url: 'https://i/1' };
    const { stripe, list } = stripeWith([{ invoice }]);
    await expect(findInvoiceForPaymentIntent(stripe, 'pi_1')).resolves.toBe(invoice);
    expect(list).toHaveBeenCalledWith({
      payment: { type: 'payment_intent', payment_intent: 'pi_1' },
      limit: 1,
      expand: ['data.invoice'],
    });
  });
  it('returns null for one-time payments with no invoice payment', async () => {
    await expect(findInvoiceForPaymentIntent(stripeWith([]).stripe, 'pi_1')).resolves.toBeNull();
  });
  it('returns null when the invoice is an unexpanded id or deleted', async () => {
    await expect(findInvoiceForPaymentIntent(stripeWith([{ invoice: 'in_1' }]).stripe, 'pi_1')).resolves.toBeNull();
    await expect(findInvoiceForPaymentIntent(stripeWith([{ invoice: { id: 'in_1', deleted: true } }]).stripe, 'pi_1')).resolves.toBeNull();
  });
  it('swallows Stripe errors so one bad lookup does not fail the whole page', async () => {
    const stripe = { invoicePayments: { list: vi.fn().mockRejectedValue(new Error('boom')) } } as any;
    await expect(findInvoiceForPaymentIntent(stripe, 'pi_1')).resolves.toBeNull();
  });
});
