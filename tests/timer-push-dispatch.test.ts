import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/app/api/db', () => ({ default: {} }));

import { dispatchTimerPush } from '@/src/lib/notifications/timerDispatch';
import { NotificationEventType } from '@prisma/client';

const PAYLOAD = { title: 'T', body: 'B' };
const SUBSCRIPTION = { id: 'sub1', endpoint: 'https://push.example/x', p256dh: 'p', auth: 'a' };
const OWNER = { caretakerId: 'care1', accountId: null, familyId: 'fam1' };

function args(overrides: Record<string, unknown> = {}) {
  return {
    subscription: SUBSCRIPTION,
    payload: PAYLOAD,
    eventType: NotificationEventType.FEED_TIMER_EXPIRED,
    activityType: null,
    babyId: 'baby1',
    familyId: 'fam1',
    owner: OWNER,
    nativeSent: new Set<string>(),
    ...overrides,
  };
}

function deps(overrides: Record<string, unknown> = {}) {
  return {
    sendWeb: vi.fn().mockResolvedValue({ success: true }),
    sendNative: vi.fn().mockResolvedValue(1),
    ...overrides,
  };
}

describe('dispatchTimerPush', () => {
  beforeEach(() => vi.clearAllMocks());

  // The defect: the native dispatch sat below an unguarded `await` on web push,
  // so a rejected web send (VAPID keys absent/undecryptable) skipped it. The
  // caller then rolled lastTimerNotifiedAt back, so every cron pass retried and
  // failed identically - the app never received a timer notification again.
  it('still sends the native push when the web push rejects', async () => {
    const d = deps({ sendWeb: vi.fn().mockRejectedValue(new Error('VAPID keys are not configured')) });

    await dispatchTimerPush(args(), d);

    expect(d.sendNative).toHaveBeenCalledOnce();
  });

  it('does not propagate a web push rejection to the caller', async () => {
    const d = deps({ sendWeb: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(dispatchTimerPush(args(), d)).resolves.toBeUndefined();
  });

  it('does not propagate a native push rejection to the caller', async () => {
    const d = deps({ sendNative: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(dispatchTimerPush(args(), d)).resolves.toBeUndefined();
    expect(d.sendWeb).toHaveBeenCalledOnce();
  });

  it('sends web push through the subscription when one is attached', async () => {
    const d = deps();

    await dispatchTimerPush(args(), d);

    expect(d.sendWeb).toHaveBeenCalledWith(
      'sub1',
      { endpoint: SUBSCRIPTION.endpoint, p256dh: 'p', auth: 'a' },
      PAYLOAD,
      NotificationEventType.FEED_TIMER_EXPIRED,
      null,
      'baby1'
    );
  });

  // A WebView cannot create a PushSubscription, so an app-only preference row
  // has none. That path must reach the native transport untouched.
  it('skips web push entirely for a preference with no subscription', async () => {
    const d = deps();

    await dispatchTimerPush(args({ subscription: null }), d);

    expect(d.sendWeb).not.toHaveBeenCalled();
    expect(d.sendNative).toHaveBeenCalledOnce();
  });

  it('sends the native push once per owner across preference rows', async () => {
    const d = deps();
    const nativeSent = new Set<string>();

    await dispatchTimerPush(args({ nativeSent }), d);
    await dispatchTimerPush(args({ nativeSent }), d);

    expect(d.sendNative).toHaveBeenCalledOnce();
  });

  it('targets the native send at the family and owner', async () => {
    const d = deps();

    await dispatchTimerPush(args({ owner: { caretakerId: null, accountId: 'acct1', familyId: 'fam1' } }), d);

    expect(d.sendNative).toHaveBeenCalledWith(
      { familyId: 'fam1', caretakerId: null, accountId: 'acct1' },
      PAYLOAD
    );
  });

  it('skips the native send when the baby has no family', async () => {
    const d = deps();

    await dispatchTimerPush(args({ familyId: null }), d);

    expect(d.sendNative).not.toHaveBeenCalled();
    expect(d.sendWeb).toHaveBeenCalledOnce();
  });

  it('skips the native send for an owner with neither caretaker nor account', async () => {
    const d = deps();

    await dispatchTimerPush(args({ owner: { caretakerId: null, accountId: null, familyId: null } }), d);

    expect(d.sendNative).not.toHaveBeenCalled();
  });
});
