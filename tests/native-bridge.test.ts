import { describe, it, expect } from 'vitest';
import { shellReturnUrl } from '@/src/utils/native-bridge';
import { decodeMessage } from '@/src/utils/bridge-contract';

const IOS_UA = 'Mozilla/5.0 (iPhone) SproutTrackApp/0.1.0 (ios)';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) SproutTrackApp/0.1.0 (android)';

describe('shellReturnUrl', () => {
  it('builds a capacitor origin URL with the encoded event for iOS', () => {
    const url = shellReturnUrl(IOS_UA, { type: 'loggedOut', reason: 'switch-family' });
    expect(url).toMatch(/^capacitor:\/\/localhost\/\?bridge-event=/);
    const encoded = decodeURIComponent(url!.split('bridge-event=')[1]);
    expect(decodeMessage(encoded)).toEqual({
      v: 1,
      msg: { type: 'loggedOut', reason: 'switch-family' },
    });
  });

  it('uses the https origin for Android', () => {
    const url = shellReturnUrl(ANDROID_UA, { type: 'loggedOut', reason: 'logout-401' });
    expect(url).toMatch(/^https:\/\/localhost\/\?bridge-event=/);
  });

  it('returns null for a normal browser UA', () => {
    expect(shellReturnUrl('Mozilla/5.0 Safari', { type: 'sessionExpired' })).toBeNull();
  });
});
