import { randomBytes } from 'crypto';

// 32 characters with 0/O/1/I removed. 256 % 32 === 0, so byte % 32 is unbiased.
export const GIFT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const GROUP_LENGTH = 4;
const CODE_LENGTH = 16;

function formatGiftCode(raw: string): string {
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += GROUP_LENGTH) {
    groups.push(raw.slice(i, i + GROUP_LENGTH));
  }
  return groups.join('-');
}

export function generateGiftCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let raw = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    raw += GIFT_CODE_ALPHABET[bytes[i] % GIFT_CODE_ALPHABET.length];
  }
  return formatGiftCode(raw);
}

// Canonicalizes user input (case, spaces, dashes). Returns null when the
// cleaned input is not exactly 16 characters from the code alphabet.
export function normalizeGiftCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== CODE_LENGTH) return null;
  for (const ch of cleaned) {
    if (!GIFT_CODE_ALPHABET.includes(ch)) return null;
  }
  return formatGiftCode(cleaned);
}

export type GiftCodeStatus = 'active' | 'redeemed' | 'revoked';

export function giftCodeStatus(code: {
  redeemedAt: Date | string | null;
  revokedAt: Date | string | null;
}): GiftCodeStatus {
  if (code.revokedAt) return 'revoked';
  if (code.redeemedAt) return 'redeemed';
  return 'active';
}

export type RedemptionCheck =
  | { ok: true; cancelSubscription: boolean }
  | { ok: false; reason: 'invalid_code' | 'already_lifetime' };

export function checkRedemption(
  code: { redeemedAt: Date | null; revokedAt: Date | null } | null,
  account: { planType: string | null; subscriptionId: string | null },
): RedemptionCheck {
  if (account.planType === 'full') return { ok: false, reason: 'already_lifetime' };
  if (!code || giftCodeStatus(code) !== 'active') return { ok: false, reason: 'invalid_code' };
  return { ok: true, cancelSubscription: Boolean(account.subscriptionId) };
}

// Lifetime is terminal: once a gift code grants planType 'full', a later
// Stripe subscription.updated event (e.g. from the cancel_at_period_end call
// redemption issues) must not downgrade the account back to a subscription
// plan. Anything other than 'full' (including null) still applies normally.
export function shouldApplySubscriptionUpdate(account: { planType: string | null }): boolean {
  return account.planType !== 'full';
}

export function isGiftCheckoutSession(
  metadata: Record<string, string> | null | undefined,
): boolean {
  return metadata?.purchaseType === 'gift';
}

export function resolveGiftPriceId(env: {
  STRIPE_GIFT_PRICE_ID?: string;
  NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID?: string;
}): string | null {
  return env.STRIPE_GIFT_PRICE_ID || env.NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID || null;
}

// Classifies a Prisma P2002 unique-violation target from GiftCode.create:
// a stripeSessionId collision means the webhook already fulfilled this
// checkout session; anything else (the code column) means regenerate.
export function giftUniqueViolationAction(target: unknown): 'already-fulfilled' | 'retry-code' {
  const fields = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return fields.includes('stripeSessionId') ? 'already-fulfilled' : 'retry-code';
}

/**
 * Turn an email-provider failure into something an admin can act on.
 *
 * SendGrid buries the useful part in `response.body.errors[]` — most often
 * "The from address does not match a verified Sender Identity", which is what
 * you get when ACCOUNTS_EMAIL is unset and the fallback sender was never
 * verified. Surfacing that beats logging it server-side and reporting success.
 */
export function describeEmailFailure(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  const anyErr = error as any;
  const providerMessage = anyErr?.response?.body?.errors?.[0]?.message;
  if (typeof providerMessage === 'string' && providerMessage.trim()) return providerMessage;
  if (typeof anyErr?.message === 'string' && anyErr.message.trim()) return anyErr.message;
  return 'The gift codes were created, but the email could not be sent.';
}

// Same shape used by the account routes' isValidEmail. A bare `includes('@')`
// accepted "@" and "a@b", which would then be handed to sendGiftCodeEmail.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidGiftEmail(email: unknown): email is string {
  return typeof email === 'string' && EMAIL_RE.test(email);
}

export function parseGenerateGiftCodesRequest(
  body: unknown,
): { quantity: number; email: string | null; sendEmail: boolean } {
  const bodyAny = body as any;
  const quantity = Math.min(Math.max(Number(bodyAny?.quantity) || 1, 1), 20);
  const email = isValidGiftEmail(bodyAny?.email) ? bodyAny.email : null;
  const sendEmail = Boolean(bodyAny?.sendEmail) && email !== null;
  return { quantity, email, sendEmail };
}
