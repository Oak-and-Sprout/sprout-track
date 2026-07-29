import { describe, it, expect } from 'vitest';
import { parseDeviceTokenBody } from '@/app/api/notifications/device-tokens/validation';

describe('parseDeviceTokenBody', () => {
  it('accepts a valid ios body', () => {
    expect(parseDeviceTokenBody({ token: 'abc123', platform: 'ios' })).toEqual({
      token: 'abc123',
      platform: 'ios',
    });
  });

  it('accepts android and trims the token', () => {
    expect(parseDeviceTokenBody({ token: '  t1  ', platform: 'android' })).toEqual({
      token: 't1',
      platform: 'android',
    });
  });

  it('rejects unknown platforms, empty/oversized tokens, and non-objects', () => {
    expect(parseDeviceTokenBody({ token: 't', platform: 'web' })).toBeNull();
    expect(parseDeviceTokenBody({ token: '', platform: 'ios' })).toBeNull();
    expect(parseDeviceTokenBody({ token: 'x'.repeat(4097), platform: 'ios' })).toBeNull();
    expect(parseDeviceTokenBody(null)).toBeNull();
    expect(parseDeviceTokenBody('token')).toBeNull();
  });
});
