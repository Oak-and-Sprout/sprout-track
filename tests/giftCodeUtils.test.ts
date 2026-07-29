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
  parseGenerateGiftCodesRequest,
  describeEmailFailure,
  shouldApplySubscriptionUpdate,
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

describe('shouldApplySubscriptionUpdate', () => {
  it('is terminal: a lifetime plan rejects further subscription updates', () => {
    expect(shouldApplySubscriptionUpdate({ planType: 'full' })).toBe(false);
  });

  it('allows subscription updates for a plain subscription plan', () => {
    expect(shouldApplySubscriptionUpdate({ planType: 'sub' })).toBe(true);
  });

  it('allows subscription updates when there is no existing plan', () => {
    expect(shouldApplySubscriptionUpdate({ planType: null })).toBe(true);
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

describe('parseGenerateGiftCodesRequest', () => {
  it('applies defaults for empty body', () => {
    const result = parseGenerateGiftCodesRequest({});
    expect(result).toEqual({ quantity: 1, email: null, sendEmail: false });
  });

  it('rejects malformed emails rather than trusting a bare @', () => {
    // An "@"-contains check accepted "@" and "a@b", which would then be handed
    // to sendGiftCodeEmail when sendEmail was set.
    for (const bad of ['@', 'a@b', 'no-at-sign', 'x@y.', '@example.com', 'a b@example.com', '']) {
      const result = parseGenerateGiftCodesRequest({ email: bad, sendEmail: true });
      expect(result.email, `should reject ${JSON.stringify(bad)}`).toBeNull();
      expect(result.sendEmail, `should not send to ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('accepts a well-formed email and allows sending to it', () => {
    const result = parseGenerateGiftCodesRequest({ email: 'gift@example.com', sendEmail: true });
    expect(result.email).toBe('gift@example.com');
    expect(result.sendEmail).toBe(true);
  });

  it('clamps quantity to 1..20 range', () => {
    expect(parseGenerateGiftCodesRequest({ quantity: 0 }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: 1 }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: 5 }).quantity).toBe(5);
    expect(parseGenerateGiftCodesRequest({ quantity: 20 }).quantity).toBe(20);
    expect(parseGenerateGiftCodesRequest({ quantity: 25 }).quantity).toBe(20);
    expect(parseGenerateGiftCodesRequest({ quantity: 100 }).quantity).toBe(20);
  });

  it('parses numeric quantity strings correctly', () => {
    expect(parseGenerateGiftCodesRequest({ quantity: '5' }).quantity).toBe(5);
    expect(parseGenerateGiftCodesRequest({ quantity: '0' }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: '999' }).quantity).toBe(20);
  });

  it('defaults non-numeric quantity to 1', () => {
    expect(parseGenerateGiftCodesRequest({ quantity: 'abc' }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: null }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: undefined }).quantity).toBe(1);
    expect(parseGenerateGiftCodesRequest({ quantity: NaN }).quantity).toBe(1);
  });

  it('validates email must contain @', () => {
    expect(parseGenerateGiftCodesRequest({ email: 'test@example.com' }).email).toBe('test@example.com');
    expect(parseGenerateGiftCodesRequest({ email: 'a@b.c' }).email).toBe('a@b.c');
    expect(parseGenerateGiftCodesRequest({ email: 'invalid' }).email).toBeNull();
    expect(parseGenerateGiftCodesRequest({ email: 'x' }).email).toBeNull();
    expect(parseGenerateGiftCodesRequest({ email: '' }).email).toBeNull();
  });

  it('rejects non-string email values', () => {
    expect(parseGenerateGiftCodesRequest({ email: 123 }).email).toBeNull();
    expect(parseGenerateGiftCodesRequest({ email: null }).email).toBeNull();
    expect(parseGenerateGiftCodesRequest({ email: undefined }).email).toBeNull();
  });

  it('gates sendEmail: only true when email is valid', () => {
    expect(parseGenerateGiftCodesRequest({ sendEmail: true, email: 'test@example.com' }).sendEmail).toBe(true);
    expect(parseGenerateGiftCodesRequest({ sendEmail: true, email: 'invalid' }).sendEmail).toBe(false);
    expect(parseGenerateGiftCodesRequest({ sendEmail: false, email: 'test@example.com' }).sendEmail).toBe(false);
    expect(parseGenerateGiftCodesRequest({ sendEmail: true }).sendEmail).toBe(false);
  });
});

describe('describeEmailFailure', () => {
  it('surfaces a SendGrid unverified-sender rejection in plain terms', () => {
    const sgError = {
      code: 403,
      response: {
        body: {
          errors: [{ message: 'The from address does not match a verified Sender Identity.' }],
        },
      },
    };
    expect(describeEmailFailure(sgError)).toContain('verified Sender Identity');
  });

  it('falls back to a message string', () => {
    expect(describeEmailFailure(new Error('connect ECONNREFUSED'))).toContain('ECONNREFUSED');
  });

  it('handles a plain string and an unknown shape', () => {
    expect(describeEmailFailure('SendGrid API key is not configured.')).toBe(
      'SendGrid API key is not configured.'
    );
    expect(describeEmailFailure(undefined)).toBeTruthy();
    expect(describeEmailFailure({})).toBeTruthy();
  });
});
