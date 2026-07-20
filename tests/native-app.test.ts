import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  detectNativeApp,
  isNativeApp,
  getCapacitorPlugin,
  shellOrigin,
  chooseWakeLockMechanism,
  shouldRegisterServiceWorker,
} from '@/src/utils/native-app';

describe('detectNativeApp', () => {
  it('detects the iOS shell user agent', () => {
    const ua = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 SproutTrackApp/0.1.0 (ios)';
    expect(detectNativeApp(ua)).toEqual({ isNative: true, platform: 'ios' });
  });

  it('detects the Android shell user agent', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/126 SproutTrackApp/0.1.0 (android)';
    expect(detectNativeApp(ua)).toEqual({ isNative: true, platform: 'android' });
  });

  it('returns non-native for a normal browser UA', () => {
    expect(detectNativeApp('Mozilla/5.0 (Macintosh) Safari/605.1.15')).toEqual({
      isNative: false,
      platform: null,
    });
  });
});

describe('shellOrigin', () => {
  it('maps platforms to Capacitor origins', () => {
    expect(shellOrigin('ios')).toBe('capacitor://localhost');
    expect(shellOrigin('android')).toBe('https://localhost');
  });
});

describe('chooseWakeLockMechanism', () => {
  it('prefers the KeepAwake plugin when present', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: true, hasWakeLockApi: true })).toBe('plugin');
  });
  it('falls back to the browser API', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: false, hasWakeLockApi: true })).toBe('browser');
  });
  it('returns none when neither exists', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: false, hasWakeLockApi: false })).toBe('none');
  });
});

describe('shouldRegisterServiceWorker', () => {
  it('refuses inside the native app', () => {
    expect(shouldRegisterServiceWorker({ isNative: true, hasServiceWorker: true, isSecureContext: true })).toBe(false);
  });
  it('requires serviceWorker support and a secure context', () => {
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: true, isSecureContext: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: false, isSecureContext: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: true, isSecureContext: false })).toBe(false);
  });
});

describe('isNativeApp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false in node environment without navigator', () => {
    expect(isNativeApp()).toBe(false);
  });

  it('returns true when navigator is stubbed with iOS UA', () => {
    vi.stubGlobal('navigator', { userAgent: 'X SproutTrackApp/0.1.0 (ios)' });
    expect(isNativeApp()).toBe(true);
  });

  it('returns false when navigator is stubbed with non-native UA', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh) Safari/605.1.15' });
    expect(isNativeApp()).toBe(false);
  });
});

describe('getCapacitorPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when Capacitor is absent', () => {
    expect(getCapacitorPlugin('KeepAwake')).toBe(null);
  });

  it('returns null when Capacitor.Plugins is absent', () => {
    vi.stubGlobal('Capacitor', {});
    expect(getCapacitorPlugin('KeepAwake')).toBe(null);
  });

  it('returns the plugin object when stubbed', () => {
    const mockPlugin = { keepAwake: () => {} };
    vi.stubGlobal('Capacitor', { Plugins: { KeepAwake: mockPlugin } });
    expect(getCapacitorPlugin('KeepAwake')).toBe(mockPlugin);
  });

  it('returns null for missing plugins', () => {
    vi.stubGlobal('Capacitor', { Plugins: {} });
    expect(getCapacitorPlugin('NonExistent')).toBe(null);
  });
});
