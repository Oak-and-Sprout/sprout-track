import { describe, it, expect, vi, beforeEach } from 'vitest';

// initializeWebPush() sat OUTSIDE sendNotification's try/catch, so a missing or
// undecryptable VAPID config threw out of sendNotification instead of returning
// the {success:false} envelope every other failure returns. Callers that await
// it before dispatching native push were silenced permanently as a result
// (see tests/timer-push-dispatch.test.ts).
const { getDecryptedNotificationConfig, setVapidDetails, sendNotificationRaw } = vi.hoisted(() => ({
  getDecryptedNotificationConfig: vi.fn(),
  setVapidDetails: vi.fn(),
  sendNotificationRaw: vi.fn(),
}));

let initialized = false;

vi.mock('@/app/api/db', () => ({ default: {} }));

vi.mock('@/src/lib/notifications/config', () => ({
  getDecryptedNotificationConfig,
  isWebPushInitialized: () => initialized,
  setWebPushInitialized: (v: boolean) => {
    initialized = v;
  },
}));

vi.mock('web-push', () => ({
  setVapidDetails,
  sendNotification: sendNotificationRaw,
}));

import { sendNotification } from '@/src/lib/notifications/push';

const SUB = { endpoint: 'https://push.example/x', p256dh: 'p', auth: 'a' };
const PAYLOAD = { title: 'T', body: 'B' };

describe('sendNotification when web-push cannot be initialized', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: the malformed-keys case installs a
    // throwing setVapidDetails implementation that would otherwise leak.
    vi.resetAllMocks();
    initialized = false;
  });

  it('returns a failure envelope instead of throwing when VAPID keys are absent', async () => {
    getDecryptedNotificationConfig.mockResolvedValue({ vapidPublicKey: null, vapidPrivateKey: null });

    const result = await sendNotification(SUB, PAYLOAD);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/VAPID/i);
    expect(sendNotificationRaw).not.toHaveBeenCalled();
  });

  it('returns a failure envelope instead of throwing when the config will not decrypt', async () => {
    getDecryptedNotificationConfig.mockRejectedValue(new Error('decryption failed'));

    const result = await sendNotification(SUB, PAYLOAD);

    expect(result.success).toBe(false);
    expect(sendNotificationRaw).not.toHaveBeenCalled();
  });

  it('returns a failure envelope instead of throwing when the keys are malformed', async () => {
    getDecryptedNotificationConfig.mockResolvedValue({ vapidPublicKey: 'bad', vapidPrivateKey: 'bad' });
    setVapidDetails.mockImplementation(() => {
      throw new Error('Vapid public key should be 65 bytes long');
    });

    const result = await sendNotification(SUB, PAYLOAD);

    expect(result.success).toBe(false);
    expect(sendNotificationRaw).not.toHaveBeenCalled();
  });

  it('still sends normally once the config is valid', async () => {
    getDecryptedNotificationConfig.mockResolvedValue({
      vapidPublicKey: 'pub',
      vapidPrivateKey: 'priv',
      vapidSubject: 'mailto:a@b.c',
    });
    sendNotificationRaw.mockResolvedValue(undefined);

    const result = await sendNotification(SUB, PAYLOAD);

    expect(result.success).toBe(true);
    expect(sendNotificationRaw).toHaveBeenCalledOnce();
  });
});
