import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pins the two review-caught regressions in notifyActivityCreated:
// - I2: resolvePreferenceOwner must prefer a live subscription over the
//   preference row's own (possibly stale) owner columns, for both the send
//   target and the language lookup.
// - I3: sendToDeviceTokens must fire once per distinct owner per
//   notification, not once per preference row — a user with both a web
//   preference and a native preference for the same baby+eventType (the
//   browser-to-app upgrade path this feature targets) must not get the
//   same push twice on the same device.
const {
  findManyPreferences,
  findUniqueBaby,
  findUniqueAccount,
  findUniqueCaretaker,
  sendNotificationWithLogging,
  sendToDeviceTokens,
} = vi.hoisted(() => ({
  findManyPreferences: vi.fn(),
  findUniqueBaby: vi.fn(),
  findUniqueAccount: vi.fn(),
  findUniqueCaretaker: vi.fn(),
  sendNotificationWithLogging: vi.fn().mockResolvedValue(undefined),
  sendToDeviceTokens: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/app/api/db', () => ({
  default: {
    baby: { findUnique: findUniqueBaby },
    notificationPreference: { findMany: findManyPreferences },
    account: { findUnique: findUniqueAccount },
    caretaker: { findUnique: findUniqueCaretaker },
  },
}));

vi.mock('@/src/lib/notifications/config', () => ({
  isNotificationsEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/src/lib/notifications/push', () => ({
  sendNotificationWithLogging,
}));

vi.mock('@/src/lib/notifications/nativePush', () => ({
  sendToDeviceTokens,
}));

import { notifyActivityCreated } from '@/src/lib/notifications/activityHook';

describe('notifyActivityCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueBaby.mockResolvedValue({
      firstName: 'Baby',
      familyId: 'fam1',
      family: { slug: 'fam-slug' },
    });
    findUniqueCaretaker.mockResolvedValue({ language: 'en' });
    findUniqueAccount.mockResolvedValue({ language: 'en' });
  });

  it('reads the owner from the live subscription, not the preference row\'s own (stale) columns', async () => {
    findManyPreferences.mockResolvedValue([
      {
        id: 'pref1',
        activityTypes: null,
        // Stale snapshot — would have been correct when this row was
        // created, but the subscription's ownership has since changed
        // (shared tablet, PIN switch).
        caretakerId: 'stale-caretaker',
        accountId: null,
        familyId: 'stale-fam',
        subscription: {
          id: 'sub1',
          endpoint: 'https://example.com/endpoint',
          p256dh: 'p256dh',
          auth: 'auth',
          accountId: null,
          caretakerId: 'live-caretaker',
        },
      },
    ]);

    await notifyActivityCreated('baby1', 'feed', undefined, {});

    // Web push still fires for the subscription-backed row — byte-identical.
    expect(sendNotificationWithLogging).toHaveBeenCalledTimes(1);
    expect(sendNotificationWithLogging).toHaveBeenCalledWith(
      'sub1',
      expect.objectContaining({ endpoint: 'https://example.com/endpoint' }),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'baby1'
    );

    // Language lookup and native send target must use the subscription's
    // live owner, not the preference row's stale snapshot.
    expect(findUniqueCaretaker).toHaveBeenCalledWith({
      where: { id: 'live-caretaker' },
      select: { language: true },
    });
    expect(sendToDeviceTokens).toHaveBeenCalledTimes(1);
    expect(sendToDeviceTokens).toHaveBeenCalledWith(
      { familyId: 'fam1', caretakerId: 'live-caretaker', accountId: null },
      expect.anything()
    );
  });

  it('sends native push once per distinct owner, even with a web row and a native row for the same owner', async () => {
    findManyPreferences.mockResolvedValue([
      {
        id: 'pref-web',
        activityTypes: null,
        caretakerId: null,
        accountId: null,
        familyId: null,
        subscription: {
          id: 'sub1',
          endpoint: 'https://example.com/endpoint',
          p256dh: 'p256dh',
          auth: 'auth',
          accountId: null,
          caretakerId: 'care1',
        },
      },
      {
        id: 'pref-native',
        activityTypes: null,
        caretakerId: 'care1',
        accountId: null,
        familyId: 'fam1',
        subscription: null,
      },
    ]);

    await notifyActivityCreated('baby1', 'feed', undefined, {});

    // Each subscription is a distinct device — web push still fires once
    // for the one (and only) subscription-backed row.
    expect(sendNotificationWithLogging).toHaveBeenCalledTimes(1);

    // Both rows resolve to the same owner (care1) — native push must fire
    // exactly once, not once per preference row.
    expect(sendToDeviceTokens).toHaveBeenCalledTimes(1);
    expect(sendToDeviceTokens).toHaveBeenCalledWith(
      { familyId: 'fam1', caretakerId: 'care1', accountId: null },
      expect.anything()
    );
  });

  it('does not send native push at all when no preference row has an owner', async () => {
    findManyPreferences.mockResolvedValue([
      {
        id: 'pref-ownerless',
        activityTypes: null,
        caretakerId: null,
        accountId: null,
        familyId: null,
        subscription: null,
      },
    ]);

    await notifyActivityCreated('baby1', 'feed', undefined, {});

    expect(sendNotificationWithLogging).not.toHaveBeenCalled();
    expect(sendToDeviceTokens).not.toHaveBeenCalled();
  });
});
