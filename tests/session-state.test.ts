import { describe, it, expect } from 'vitest';
import { isSessionUnlocked } from '@/src/utils/session-state';

/** Builds a token whose payload segment decodes the way `atob` expects. */
function tokenWith(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
}

const PIN_TOKEN = tokenWith({ name: 'Jo' });
const ACCOUNT_TOKEN = tokenWith({ name: 'Jo', isAccountAuth: true });
const SYSADMIN_TOKEN = tokenWith({ name: 'Jo', isSysAdmin: true });

const HOUR_AGO = (Date.now() - 60 * 60 * 1000).toString();

describe('isSessionUnlocked', () => {
  it('is locked with no auth token', () => {
    expect(isSessionUnlocked({ authToken: null, unlockTime: Date.now().toString() })).toBe(false);
  });

  // The bug this function exists to fix: unlockTime is a last-activity stamp
  // refreshed on every click/keydown/mousemove/touchstart and deleted on
  // logout, so its *presence* means unlocked. Its age means nothing.
  it('is unlocked for a PIN session whose unlockTime is an hour old', () => {
    expect(isSessionUnlocked({ authToken: PIN_TOKEN, unlockTime: HOUR_AGO })).toBe(true);
  });

  it('is locked for a PIN session with no unlockTime', () => {
    expect(isSessionUnlocked({ authToken: PIN_TOKEN, unlockTime: null })).toBe(false);
  });

  it('is unlocked for an account session with no unlockTime at all', () => {
    expect(isSessionUnlocked({ authToken: ACCOUNT_TOKEN, unlockTime: null })).toBe(true);
  });

  it('is unlocked for a system administrator with no unlockTime at all', () => {
    expect(isSessionUnlocked({ authToken: SYSADMIN_TOKEN, unlockTime: null })).toBe(true);
  });

  // Matches the try/catch at client-layout.tsx:749-758: an undecodable payload
  // leaves both flags false rather than throwing, so the unlockTime path still
  // decides. Diverging here would put the relock gate and the app back out of
  // step, which is the whole defect.
  it('falls back to unlockTime when the token payload will not decode', () => {
    expect(isSessionUnlocked({ authToken: 'not.a.jwt', unlockTime: HOUR_AGO })).toBe(true);
    expect(isSessionUnlocked({ authToken: 'not.a.jwt', unlockTime: null })).toBe(false);
  });

  it('is locked for an empty-string auth token', () => {
    expect(isSessionUnlocked({ authToken: '', unlockTime: HOUR_AGO })).toBe(false);
  });
});
