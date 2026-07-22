import { describe, it, expect } from 'vitest';
import {
  decideNativeRelock,
  readReauthMarker,
  writeReauthMarker,
  clearReauthMarker,
  REAUTH_LOOP_WINDOW_MS,
} from '@/src/utils/native-relock';

const base = { unlocked: false, native: true, slug: 'smith', marker: null, now: 1000 };

describe('decideNativeRelock', () => {
  it('renders the app when the session is unlocked', () => {
    expect(decideNativeRelock({ ...base, unlocked: true })).toBe('app');
  });

  it('shows the web login in a normal browser (not the native shell)', () => {
    expect(decideNativeRelock({ ...base, native: false })).toBe('show-login');
  });

  it('returns to the shell when locked in the app with no prior attempt', () => {
    expect(decideNativeRelock(base)).toBe('return-to-shell');
  });

  it('breaks the loop: shows the login if we just bounced for this slug and are still locked', () => {
    const marker = { slug: 'smith', at: 1000 };
    expect(decideNativeRelock({ ...base, marker, now: 1000 + REAUTH_LOOP_WINDOW_MS - 1 })).toBe('show-login');
  });

  it('bounces again once the loop window has elapsed', () => {
    const marker = { slug: 'smith', at: 1000 };
    expect(decideNativeRelock({ ...base, marker, now: 1000 + REAUTH_LOOP_WINDOW_MS + 1 })).toBe('return-to-shell');
  });

  it('bounces for a different family even within the window', () => {
    const marker = { slug: 'jones', at: 1000 };
    expect(decideNativeRelock({ ...base, marker, now: 1001 })).toBe('return-to-shell');
  });
});

describe('reauth marker storage', () => {
  function fakeStorage() {
    const store = new Map<string, string>();
    return {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    };
  }

  it('round-trips a marker and clears it', () => {
    const s = fakeStorage();
    expect(readReauthMarker(s)).toBeNull();
    writeReauthMarker(s, { slug: 'smith', at: 42 });
    expect(readReauthMarker(s)).toEqual({ slug: 'smith', at: 42 });
    clearReauthMarker(s);
    expect(readReauthMarker(s)).toBeNull();
  });

  it('returns null on malformed or partial data', () => {
    expect(readReauthMarker({ getItem: () => '{not json' })).toBeNull();
    expect(readReauthMarker({ getItem: () => JSON.stringify({ slug: 'x' }) })).toBeNull();
  });
});
