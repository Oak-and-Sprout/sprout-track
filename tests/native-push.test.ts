import { describe, it, expect } from 'vitest';
import { shouldAttemptNativePush } from '@/src/utils/native-push';

describe('shouldAttemptNativePush', () => {
  it('requires native, plugin, and server support', () => {
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: true, nativePushEnabled: true })).toBe(true);
    expect(shouldAttemptNativePush({ isNative: false, hasPlugin: true, nativePushEnabled: true })).toBe(false);
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: false, nativePushEnabled: true })).toBe(false);
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: true, nativePushEnabled: false })).toBe(false);
  });
});
