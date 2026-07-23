import { describe, it, expect, afterEach, vi } from 'vitest';
import { openExternal, MANAGE_SUBSCRIPTION_URL } from '@/src/utils/external-link';

const NATIVE_UA = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 SproutTrackApp/0.1.0 (ios)';
const WEB_UA = 'Mozilla/5.0 (Macintosh) Safari/605.1.15';

describe('MANAGE_SUBSCRIPTION_URL', () => {
  it('points at the account page', () => {
    expect(MANAGE_SUBSCRIPTION_URL).toBe('https://sprout-track.com/account');
  });
});

describe('openExternal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the Capacitor Browser plugin when present in the native shell', () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const windowOpen = vi.fn();
    vi.stubGlobal('navigator', { userAgent: NATIVE_UA });
    vi.stubGlobal('window', { open: windowOpen });
    vi.stubGlobal('Capacitor', { Plugins: { Browser: { open } } });

    openExternal('https://sprout-track.com/account');

    expect(open).toHaveBeenCalledWith({ url: 'https://sprout-track.com/account' });
    expect(windowOpen).not.toHaveBeenCalled();
  });

  it('falls back to window.open when native but the Browser plugin is missing', () => {
    const windowOpen = vi.fn();
    vi.stubGlobal('navigator', { userAgent: NATIVE_UA });
    vi.stubGlobal('window', { open: windowOpen });
    vi.stubGlobal('Capacitor', { Plugins: {} });

    openExternal('https://sprout-track.com/account');

    expect(windowOpen).toHaveBeenCalledWith('https://sprout-track.com/account', '_blank', 'noopener');
  });

  it('uses window.open directly outside the native shell', () => {
    const windowOpen = vi.fn();
    vi.stubGlobal('navigator', { userAgent: WEB_UA });
    vi.stubGlobal('window', { open: windowOpen });

    openExternal('https://sprout-track.com/account');

    expect(windowOpen).toHaveBeenCalledWith('https://sprout-track.com/account', '_blank', 'noopener');
  });
});
