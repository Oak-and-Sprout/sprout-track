import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/app/api/db';
import { withAccountOwner, ApiResponse, AuthResult } from '@/app/api/utils/auth';
import { checkIpLockout, recordFailedAttempt, resetFailedAttempts } from '@/app/api/utils/ip-lockout';
import { getClientInfo } from '@/app/api/utils/api-logger';
import { normalizeGiftCode, checkRedemption } from '@/src/utils/giftCodeUtils';

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey
  ? new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    })
  : ({} as unknown as Stripe);

async function handler(
  req: NextRequest,
  authContext: AuthResult
): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  try {
    const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
    if (deploymentMode !== 'saas') {
      return NextResponse.json(
        { success: false, error: 'Gift codes are disabled in self-hosted mode' },
        { status: 404 }
      );
    }

    const accountId = authContext.accountId;
    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'Account ID not found in token' },
        { status: 400 }
      );
    }

    // Brute-force protection on top of the code entropy.
    const { ip } = getClientInfo(req);
    const { locked, remainingTime } = checkIpLockout(ip);
    if (locked) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Please try again in ${Math.ceil(remainingTime / 60000)} minutes.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const normalized = normalizeGiftCode(typeof body?.code === 'string' ? body.code : '');
    if (!normalized) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'Invalid or already used code' },
        { status: 400 }
      );
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { planType: true, subscriptionId: true },
    });
    if (!account) {
      return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    }

    const giftCode = await prisma.giftCode.findUnique({ where: { code: normalized } });
    const check = checkRedemption(giftCode, account);

    if (!check.ok) {
      if (check.reason === 'already_lifetime') {
        return NextResponse.json(
          { success: false, error: 'Your account already has lifetime access' },
          { status: 400 }
        );
      }
      recordFailedAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'Invalid or already used code' },
        { status: 400 }
      );
    }

    resetFailedAttempts(ip);

    // Atomically claim the code (guards concurrent redemption) and grant
    // lifetime access. Mirrors the webhook's lifetime purchase branch.
    const claimed = await prisma.$transaction(async (tx) => {
      const claim = await tx.giftCode.updateMany({
        where: { id: giftCode!.id, redeemedAt: null, revokedAt: null },
        data: { redeemedAt: new Date(), redeemedByAccountId: accountId },
      });
      if (claim.count === 0) return false;

      await tx.account.update({
        where: { id: accountId },
        data: {
          planType: 'full',
          planExpires: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000),
          trialEnds: null,
        },
      });
      return true;
    });

    if (!claimed) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { success: false, error: 'Invalid or already used code' },
        { status: 400 }
      );
    }

    // Stop future billing; the user keeps what they already paid for.
    let message = 'Gift code redeemed — you now have lifetime access!';
    if (check.cancelSubscription && account.subscriptionId && stripeKey) {
      try {
        await stripe.subscriptions.update(account.subscriptionId, {
          cancel_at_period_end: true,
        });
        message = 'Gift code redeemed — you now have lifetime access! Your subscription will not renew.';
      } catch (stripeError) {
        console.error('[GIFT ERROR] Failed to cancel subscription after redemption:', stripeError);
        message =
          'Gift code redeemed — you now have lifetime access! We could not cancel your subscription automatically; please cancel it from the subscription settings.';
      }
    }

    return NextResponse.json({ success: true, data: { message } });
  } catch (error) {
    console.error('[GIFT ERROR] Error redeeming gift code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to redeem gift code' },
      { status: 500 }
    );
  }
}

export const POST = withAccountOwner(handler);
