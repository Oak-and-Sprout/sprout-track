import { describe, it, expect } from 'vitest';
import {
  GIFT_CODE_ALPHABET,
  generateGiftCode,
  normalizeGiftCode,
  giftCodeStatus,
  checkRedemption,
  isGiftCheckoutSession,
  resolveGiftPriceId,
  giftUniqueViolationAction,
} from '@/src/utils/giftCodeUtils';

describe('generateGiftCode', () => {
  it('produces XXXX-XXXX-XXXX-XXXX from the unambiguous alphabet', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateGiftCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      for (const ch of code.replace(/-/g, '')) {
        expect(GIFT_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('excludes ambiguous characters from the alphabet', () => {
    expect(GIFT_CODE_ALPHABET).toHaveLength(32);
    for (const ch of '0O1I') expect(GIFT_CODE_ALPHABET).not.toContain(ch);
  });

  it('does not repeat across a small sample', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generateGiftCode()));
    expect(seen.size).toBe(50);
  });
});

describe('normalizeGiftCode', () => {
  it('canonicalizes lowercase, spaces, and missing dashes', () => {
    expect(normalizeGiftCode('abcd efgh jklm npqr')).toBe('ABCD-EFGH-JKLM-NPQR');
    expect(normalizeGiftCode('ABCDEFGHJKLMNPQR')).toBe('ABCD-EFGH-JKLM-NPQR');
    expect(normalizeGiftCode(' abcd-EFGH-jklm-NPQR ')).toBe('ABCD-EFGH-JKLM-NPQR');
  });

  it('rejects wrong length and characters outside the alphabet', () => {
    expect(normalizeGiftCode('')).toBeNull();
    expect(normalizeGiftCode('ABCD-EFGH-JKLM')).toBeNull();
    expect(normalizeGiftCode('ABCD-EFGH-JKLM-NPQ0')).toBeNull(); // 0 not in alphabet
    expect(normalizeGiftCode('OOOO-EFGH-JKLM-NPQR')).toBeNull(); // O not in alphabet
  });
});

describe('giftCodeStatus', () => {
  it('derives status with revoked taking precedence', () => {
    expect(giftCodeStatus({ redeemedAt: null, revokedAt: null })).toBe('active');
    expect(giftCodeStatus({ redeemedAt: new Date(), revokedAt: null })).toBe('redeemed');
    expect(giftCodeStatus({ redeemedAt: null, revokedAt: new Date() })).toBe('revoked');
    expect(giftCodeStatus({ redeemedAt: new Date(), revokedAt: new Date() })).toBe('revoked');
  });
});

describe('checkRedemption', () => {
  const active = { redeemedAt: null, revokedAt: null };

  it('rejects when the account already has lifetime access', () => {
    expect(checkRedemption(active, { planType: 'full', subscriptionId: null }))
      .toEqual({ ok: false, reason: 'already_lifetime' });
  });

  it('rejects missing, redeemed, and revoked codes with a generic reason', () => {
    expect(checkRedemption(null, { planType: null, subscriptionId: null }))
      .toEqual({ ok: false, reason: 'invalid_code' });
    expect(checkRedemption({ redeemedAt: new Date(), revokedAt: null }, { planType: null, subscriptionId: null }))
      .toEqual({ ok: false, reason: 'invalid_code' });
    expect(checkRedemption({ redeemedAt: null, revokedAt: new Date() }, { planType: 'sub', subscriptionId: 'sub_1' }))
      .toEqual({ ok: false, reason: 'invalid_code' });
  });

  it('allows redemption and flags subscription cancellation', () => {
    expect(checkRedemption(active, { planType: null, subscriptionId: null }))
      .toEqual({ ok: true, cancelSubscription: false });
    expect(checkRedemption(active, { planType: 'sub', subscriptionId: 'sub_1' }))
      .toEqual({ ok: true, cancelSubscription: true });
  });
});

describe('isGiftCheckoutSession', () => {
  it('matches only purchaseType gift', () => {
    expect(isGiftCheckoutSession({ purchaseType: 'gift' })).toBe(true);
    expect(isGiftCheckoutSession({ accountId: 'a1', planType: 'full' })).toBe(false);
    expect(isGiftCheckoutSession(null)).toBe(false);
    expect(isGiftCheckoutSession(undefined)).toBe(false);
  });
});

describe('resolveGiftPriceId', () => {
  it('prefers the gift price and falls back to the lifetime price', () => {
    expect(resolveGiftPriceId({ STRIPE_GIFT_PRICE_ID: 'price_g', NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID: 'price_l' })).toBe('price_g');
    expect(resolveGiftPriceId({ NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID: 'price_l' })).toBe('price_l');
    expect(resolveGiftPriceId({})).toBeNull();
    expect(resolveGiftPriceId({ STRIPE_GIFT_PRICE_ID: '' })).toBeNull();
  });
});

describe('giftUniqueViolationAction', () => {
  it('treats a stripeSessionId collision as already fulfilled, anything else as retry', () => {
    expect(giftUniqueViolationAction(['stripeSessionId'])).toBe('already-fulfilled');
    expect(giftUniqueViolationAction(['code'])).toBe('retry-code');
    expect(giftUniqueViolationAction('GiftCode_stripeSessionId_key')).toBe('already-fulfilled');
    expect(giftUniqueViolationAction(undefined)).toBe('retry-code');
  });
});
