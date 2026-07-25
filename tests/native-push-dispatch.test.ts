import { describe, it, expect, vi } from 'vitest';
import { sendToDeviceTokens } from '@/src/lib/notifications/nativePush';

const PAYLOAD = { title: 'T', body: 'B' };
const TARGET = { familyId: 'fam1', caretakerId: 'care1' };

function deps(overrides = {}) {
  return {
    sendFcm: vi.fn().mockResolvedValue({ success: true, unregistered: false }),
    sendApns: vi.fn().mockResolvedValue({ success: true, unregistered: false }),
    findTokens: vi.fn().mockResolvedValue([]),
    onSuccess: vi.fn().mockResolvedValue(undefined),
    onFailure: vi.fn().mockResolvedValue(undefined),
    onUnregistered: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('sendToDeviceTokens', () => {
  it('returns 0 without querying when no owner is given', async () => {
    const d = deps();
    expect(await sendToDeviceTokens({ familyId: 'fam1' }, PAYLOAD, d)).toBe(0);
    expect(d.findTokens).not.toHaveBeenCalled();
  });

  it('routes android tokens to FCM and ios tokens to APNs', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([
        { id: '1', token: 'a', platform: 'android' },
        { id: '2', token: 'b', platform: 'ios' },
      ]),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(2);
    expect(d.sendFcm).toHaveBeenCalledWith('a', PAYLOAD);
    expect(d.sendApns).toHaveBeenCalledWith('b', PAYLOAD);
  });

  it('stamps success for delivered tokens', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'a', platform: 'android' }]),
    });
    await sendToDeviceTokens(TARGET, PAYLOAD, d);
    expect(d.onSuccess).toHaveBeenCalledWith('1');
    expect(d.onFailure).not.toHaveBeenCalled();
  });

  it('deletes by token — not by id — so every family row for a dead token goes', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'dead', platform: 'ios' }]),
      sendApns: vi.fn().mockResolvedValue({ success: false, unregistered: true }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(0);
    expect(d.onUnregistered).toHaveBeenCalledWith('dead');
    expect(d.onFailure).not.toHaveBeenCalled();
  });

  it('increments failure count on a transient error without deleting', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([{ id: '1', token: 'a', platform: 'android' }]),
      sendFcm: vi.fn().mockResolvedValue({ success: false, unregistered: false }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(0);
    expect(d.onFailure).toHaveBeenCalledWith('1');
    expect(d.onUnregistered).not.toHaveBeenCalled();
  });

  it('keeps sending after one token throws', async () => {
    const d = deps({
      findTokens: vi.fn().mockResolvedValue([
        { id: '1', token: 'a', platform: 'android' },
        { id: '2', token: 'b', platform: 'android' },
      ]),
      sendFcm: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ success: true, unregistered: false }),
    });
    expect(await sendToDeviceTokens(TARGET, PAYLOAD, d)).toBe(1);
  });
});
