import { describe, it, expect, afterEach } from 'vitest';
import { paymentsFrom } from '@/app/api/utils/account-emails';

const original = process.env.PAYMENTS_EMAIL;
afterEach(() => {
  if (original === undefined) delete process.env.PAYMENTS_EMAIL;
  else process.env.PAYMENTS_EMAIL = original;
});

describe('paymentsFrom', () => {
  it('defaults to the verified payments sender with a display name', () => {
    delete process.env.PAYMENTS_EMAIL;
    expect(paymentsFrom()).toBe('Sprout Track <payments@sprout-track.com>');
  });

  it('wraps a bare override address with the display name', () => {
    process.env.PAYMENTS_EMAIL = 'billing@example.com';
    expect(paymentsFrom()).toBe('Sprout Track <billing@example.com>');
  });

  it('leaves a full mailbox override untouched', () => {
    process.env.PAYMENTS_EMAIL = 'Billing Team <billing@example.com>';
    expect(paymentsFrom()).toBe('Billing Team <billing@example.com>');
  });
});
