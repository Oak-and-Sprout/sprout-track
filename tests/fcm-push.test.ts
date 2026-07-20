import { describe, it, expect, vi } from 'vitest';

// fcmPush.ts imports the shared Prisma singleton at module scope; the real
// singleton construction throws without a configured DATABASE_URL. These
// tests only exercise the pure helpers, so mock the module the same way
// tests/activeBreastFeed.test.ts does for other notification-lib imports.
vi.mock('@/app/api/db', () => ({ default: {} }));

import { buildFcmMessage, loadFcmServiceAccount } from '@/src/lib/notifications/fcmPush';

const SA = {
  project_id: 'sprout-test',
  client_email: 'svc@sprout-test.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
};

describe('loadFcmServiceAccount', () => {
  it('parses inline JSON from FCM_SERVICE_ACCOUNT_JSON', () => {
    const env = { FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(SA) } as unknown as NodeJS.ProcessEnv;
    expect(loadFcmServiceAccount(env)).toEqual({
      projectId: 'sprout-test',
      clientEmail: 'svc@sprout-test.iam.gserviceaccount.com',
      privateKey: SA.private_key,
    });
  });

  it('returns null when unset, malformed, or missing fields', () => {
    expect(loadFcmServiceAccount({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(loadFcmServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: '{not json' } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(
      loadFcmServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'x' }) } as unknown as NodeJS.ProcessEnv)
    ).toBeNull();
  });
});

describe('buildFcmMessage', () => {
  const payload = {
    title: 'Feed timer',
    body: 'Aria — 3h since last feed',
    icon: '/sprout-128.png',
    badge: '/sprout-128.png',
    tag: 'timer-baby1-FEED_TIMER_EXPIRED',
    data: { eventType: 'FEED_TIMER_EXPIRED', babyId: 'baby1' },
  };

  it('maps payload to an FCM v1 message with string-only data', () => {
    const msg = buildFcmMessage('tok1', payload as never) as {
      message: {
        token: string;
        notification: { title: string; body: string };
        data: Record<string, string>;
        android: { collapse_key: string };
        apns: { headers: Record<string, string> };
      };
    };
    expect(msg.message.token).toBe('tok1');
    expect(msg.message.notification).toEqual({ title: 'Feed timer', body: 'Aria — 3h since last feed' });
    expect(msg.message.data).toEqual({ eventType: 'FEED_TIMER_EXPIRED', babyId: 'baby1' });
    expect(Object.values(msg.message.data).every((v) => typeof v === 'string')).toBe(true);
    expect(msg.message.android.collapse_key).toBe('timer-baby1-FEED_TIMER_EXPIRED');
    expect(msg.message.apns.headers['apns-collapse-id']).toBe('timer-baby1-FEED_TIMER_EXPIRED');
  });

  it('omits collapse fields when the payload has no tag', () => {
    const msg = buildFcmMessage('tok1', { ...payload, tag: undefined } as never) as {
      message: Record<string, unknown>;
    };
    expect(msg.message.android).toBeUndefined();
    expect(msg.message.apns).toBeUndefined();
  });
});
