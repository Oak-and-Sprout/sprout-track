import { describe, it, expect } from 'vitest';
import { deviceTokenRoutesEnabled, upsertWhere } from '@/app/api/notifications/device-tokens/route';

describe('deviceTokenRoutesEnabled', () => {
  it('routes are unavailable when neither transport is configured', () => {
    expect(deviceTokenRoutesEnabled({ fcm: false, apns: false })).toBe(false);
  });

  it('routes are available when either transport is configured', () => {
    expect(deviceTokenRoutesEnabled({ fcm: true, apns: false })).toBe(true);
    expect(deviceTokenRoutesEnabled({ fcm: false, apns: true })).toBe(true);
  });
});

describe('upsertWhere', () => {
  it('POST upserts on the composite key so one token can serve two families', () => {
    expect(upsertWhere({ token: 'tok', familyId: 'fam1' })).toEqual({
      token_familyId: { token: 'tok', familyId: 'fam1' },
    });
  });
});
