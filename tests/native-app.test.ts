import { describe, it, expect } from 'vitest';
import {
  detectNativeApp,
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
