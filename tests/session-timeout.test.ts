import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_IDLE_TIME_SECONDS,
  parseIdleTimeSeconds,
  shouldIdleLogout,
  should401AttemptRefresh,
  isRootSlugPath,
  logoutDestination,
  classifySlugValidationResponse,
  validateFamilySlugWithRetry,
  refreshAuthToken,
  __resetRefreshStateForTests,
} from '@/src/utils/session-timeout';

// Issue #209: hosted iPhone PWA users were bounced to the marketing homepage.
// These helpers gate the three client-side paths that could do that:
// idle-timeout logout, the global 401 interceptor, and family-slug validation.

const NOW = 1_800_000_000_000; // fixed "current time" in ms

describe('parseIdleTimeSeconds', () => {
  it('parses a stored value', () => {
    expect(parseIdleTimeSeconds('600')).toBe(600);
  });

  it('falls back to the default for missing values', () => {
    expect(parseIdleTimeSeconds(null)).toBe(DEFAULT_IDLE_TIME_SECONDS);
    expect(parseIdleTimeSeconds(undefined)).toBe(DEFAULT_IDLE_TIME_SECONDS);
    expect(parseIdleTimeSeconds('')).toBe(DEFAULT_IDLE_TIME_SECONDS);
  });

  it('falls back to the default for garbage and non-positive values', () => {
    expect(parseIdleTimeSeconds('abc')).toBe(DEFAULT_IDLE_TIME_SECONDS);
    expect(parseIdleTimeSeconds('0')).toBe(DEFAULT_IDLE_TIME_SECONDS);
    expect(parseIdleTimeSeconds('-5')).toBe(DEFAULT_IDLE_TIME_SECONDS);
  });
});

describe('shouldIdleLogout', () => {
  const pinUser = { isAccountAuth: false, isSysAdmin: false };
  const wayPast = String(NOW - 10 * 24 * 60 * 60 * 1000); // 10 days ago

  it('never logs out account holders, even far past the idle window', () => {
    expect(
      shouldIdleLogout({
        isAccountAuth: true,
        isSysAdmin: false,
        unlockTime: wayPast,
        idleTimeSeconds: '1800',
        now: NOW,
      })
    ).toBe(false);
  });

  it('never logs out system administrators', () => {
    expect(
      shouldIdleLogout({
        isAccountAuth: false,
        isSysAdmin: true,
        unlockTime: wayPast,
        idleTimeSeconds: null,
        now: NOW,
      })
    ).toBe(false);
  });

  it('logs out PIN users past the idle window', () => {
    expect(
      shouldIdleLogout({
        ...pinUser,
        unlockTime: String(NOW - 601_000),
        idleTimeSeconds: '600',
        now: NOW,
      })
    ).toBe(true);
  });

  it('keeps PIN users within the idle window', () => {
    expect(
      shouldIdleLogout({
        ...pinUser,
        unlockTime: String(NOW - 599_000),
        idleTimeSeconds: '600',
        now: NOW,
      })
    ).toBe(false);
  });

  it('does not log out exactly at the boundary (strictly greater-than)', () => {
    expect(
      shouldIdleLogout({
        ...pinUser,
        unlockTime: String(NOW - 600_000),
        idleTimeSeconds: '600',
        now: NOW,
      })
    ).toBe(false);
    expect(
      shouldIdleLogout({
        ...pinUser,
        unlockTime: String(NOW - 600_001),
        idleTimeSeconds: '600',
        now: NOW,
      })
    ).toBe(true);
  });

  it('uses the 30-minute fallback when idleTimeSeconds is missing', () => {
    const base = { ...pinUser, idleTimeSeconds: null, now: NOW };
    expect(shouldIdleLogout({ ...base, unlockTime: String(NOW - 1800_000) })).toBe(false);
    expect(shouldIdleLogout({ ...base, unlockTime: String(NOW - 1800_001) })).toBe(true);
  });

  it('does nothing without an unlockTime or with a garbage unlockTime', () => {
    expect(
      shouldIdleLogout({ ...pinUser, unlockTime: null, idleTimeSeconds: '600', now: NOW })
    ).toBe(false);
    expect(
      shouldIdleLogout({ ...pinUser, unlockTime: 'not-a-number', idleTimeSeconds: '600', now: NOW })
    ).toBe(false);
  });
});

describe('should401AttemptRefresh', () => {
  it('refreshes for ordinary API calls', () => {
    expect(should401AttemptRefresh('/api/baby')).toBe(true);
    expect(should401AttemptRefresh('/api/settings?familyId=1')).toBe(true);
    expect(should401AttemptRefresh('https://sprout-track.com/api/timeline')).toBe(true);
    expect(should401AttemptRefresh('/api/accounts/status')).toBe(true);
  });

  it('never refreshes for auth endpoints (avoids loops and login replays)', () => {
    expect(should401AttemptRefresh('/api/auth')).toBe(false);
    expect(should401AttemptRefresh('/api/auth/refresh-token')).toBe(false);
    expect(should401AttemptRefresh('/api/auth/logout')).toBe(false);
    expect(should401AttemptRefresh('/api/accounts/login')).toBe(false);
    expect(should401AttemptRefresh('/api/accounts/register')).toBe(false);
    expect(should401AttemptRefresh('/api/accounts/forgot-password')).toBe(false);
    expect(should401AttemptRefresh('/api/accounts/reset-password')).toBe(false);
  });

  it('does not treat /api/auth as a prefix of longer segments', () => {
    expect(should401AttemptRefresh('/api/authors')).toBe(true);
  });

  it('ignores non-API and missing URLs', () => {
    expect(should401AttemptRefresh('/some/page')).toBe(false);
    expect(should401AttemptRefresh('https://example.com/image.png')).toBe(false);
    expect(should401AttemptRefresh('')).toBe(false);
    expect(should401AttemptRefresh(null)).toBe(false);
    expect(should401AttemptRefresh(undefined)).toBe(false);
  });
});

describe('isRootSlugPath', () => {
  it('matches root slug (login) pages only', () => {
    expect(isRootSlugPath('/smith-family')).toBe(true);
    expect(isRootSlugPath('/smith-family/')).toBe(true);
    expect(isRootSlugPath('/smith-family/log-entry')).toBe(false);
    expect(isRootSlugPath('/')).toBe(false);
    expect(isRootSlugPath('')).toBe(false);
    expect(isRootSlugPath(null)).toBe(false);
  });
});

describe('logoutDestination', () => {
  it('sends account holders to the homepage with the login modal open and a reason code', () => {
    expect(
      logoutDestination({ isAccountAuth: true, familySlug: 'smith', reason: 'logout-idle' })
    ).toBe('/?login=true&src=logout-idle');
  });

  it('sends PIN users to their family login with a reason code', () => {
    expect(
      logoutDestination({ isAccountAuth: false, familySlug: 'smith', reason: 'logout-user' })
    ).toBe('/smith?src=logout-user');
  });

  it('falls back to /login without a family slug', () => {
    expect(logoutDestination({ isAccountAuth: false, familySlug: null, reason: 'logout-401' })).toBe(
      '/login'
    );
    expect(logoutDestination({ isAccountAuth: false, familySlug: '', reason: 'logout-401' })).toBe(
      '/login'
    );
  });
});

describe('classifySlugValidationResponse', () => {
  it('accepts a successful lookup', () => {
    expect(classifySlugValidationResponse(200, { success: true, data: { id: '1' } })).toBe('valid');
  });

  it('treats a definitive API answer as not-found', () => {
    // /api/family/by-slug returns 200 + success:false for a missing family
    expect(classifySlugValidationResponse(200, { success: false, data: null })).toBe('not-found');
    expect(classifySlugValidationResponse(200, { success: true, data: null })).toBe('not-found');
    expect(classifySlugValidationResponse(200, null)).toBe('not-found');
    expect(classifySlugValidationResponse(404, { success: false })).toBe('not-found');
    expect(classifySlugValidationResponse(400, { success: false })).toBe('not-found'); // invalid/reserved slug
  });

  it('treats server errors and rate limiting as transient, never not-found', () => {
    expect(classifySlugValidationResponse(500, null)).toBe('transient');
    expect(classifySlugValidationResponse(502, null)).toBe('transient');
    expect(classifySlugValidationResponse(503, { success: false })).toBe('transient');
    expect(classifySlugValidationResponse(429, null)).toBe('transient');
    expect(classifySlugValidationResponse(401, null)).toBe('transient');
  });
});

describe('validateFamilySlugWithRetry', () => {
  const jsonResponse = (status: number, body: unknown) =>
    ({ status, json: async () => body } as unknown as Response);
  const noSleep = async () => {};

  it('returns valid on the first successful attempt without retrying', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { success: true, data: { id: '1' } }));
    const outcome = await validateFamilySlugWithRetry('smith', { fetchFn, sleep: noSleep });
    expect(outcome).toBe('valid');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/api/family/by-slug/smith');
  });

  it('returns not-found immediately on a definitive answer (no retry)', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { success: false, data: null }));
    const outcome = await validateFamilySlugWithRetry('gone-family', { fetchFn, sleep: noSleep });
    expect(outcome).toBe('not-found');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries network errors and succeeds when the network comes back', async () => {
    const fetchFn = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockRejectedValueOnce(new TypeError('Load failed'))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '1' } }));
    const outcome = await validateFamilySlugWithRetry('smith', { fetchFn, sleep: noSleep });
    expect(outcome).toBe('valid');
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('retries 5xx responses', async () => {
    const fetchFn = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse(503, null))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: '1' } }));
    const outcome = await validateFamilySlugWithRetry('smith', { fetchFn, sleep: noSleep });
    expect(outcome).toBe('valid');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns transient (not not-found) after exhausting retries', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Load failed');
    });
    const outcome = await validateFamilySlugWithRetry('smith', {
      fetchFn,
      retries: 2,
      sleep: noSleep,
    });
    expect(outcome).toBe('transient');
    expect(fetchFn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('waits with increasing backoff between attempts', async () => {
    const waits: number[] = [];
    const fetchFn = vi.fn(async () => jsonResponse(500, null));
    await validateFamilySlugWithRetry('smith', {
      fetchFn,
      retries: 2,
      backoffMs: 250,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    expect(waits).toEqual([250, 500]);
  });

  it('encodes the slug in the request URL', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { success: true, data: { id: '1' } }));
    await validateFamilySlugWithRetry('smith family', { fetchFn, sleep: noSleep });
    expect(fetchFn).toHaveBeenCalledWith('/api/family/by-slug/smith%20family');
  });
});

describe('refreshAuthToken', () => {
  // Minimal localStorage stub for the node test environment
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    (globalThis as any).localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, String(value)),
      removeItem: (key: string) => store.delete(key),
    };
    __resetRefreshStateForTests();
  });

  const okRefresh = (token: string) =>
    ({
      ok: true,
      json: async () => ({ success: true, data: { token } }),
    } as unknown as Response);

  it('stores the new token on success', async () => {
    const fetchFn = vi.fn(async () => okRefresh('new-token'));
    await expect(refreshAuthToken(fetchFn as unknown as typeof fetch)).resolves.toBe(true);
    expect(store.get('authToken')).toBe('new-token');
    expect(fetchFn).toHaveBeenCalledWith('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('resets unlockTime only for PIN users (when one is already stored)', async () => {
    store.set('unlockTime', '12345');
    const fetchFn = vi.fn(async () => okRefresh('new-token'));
    await refreshAuthToken(fetchFn as unknown as typeof fetch);
    expect(Number(store.get('unlockTime'))).toBeGreaterThan(12345);

    store.delete('unlockTime');
    __resetRefreshStateForTests();
    await refreshAuthToken(fetchFn as unknown as typeof fetch);
    expect(store.has('unlockTime')).toBe(false);
  });

  it('shares a single in-flight refresh between concurrent callers', async () => {
    let resolveResponse!: (value: Response) => void;
    const fetchFn = vi.fn(
      () => new Promise<Response>((resolve) => (resolveResponse = resolve))
    );

    const first = refreshAuthToken(fetchFn as unknown as typeof fetch);
    const second = refreshAuthToken(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    resolveResponse(okRefresh('shared-token'));
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    expect(store.get('authToken')).toBe('shared-token');
  });

  it('allows a fresh refresh after the previous one settles', async () => {
    const fetchFn = vi.fn(async () => okRefresh('token'));
    await refreshAuthToken(fetchFn as unknown as typeof fetch);
    await refreshAuthToken(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns false without storing anything when the refresh is rejected', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, json: async () => ({}) } as unknown as Response));
    await expect(refreshAuthToken(fetchFn as unknown as typeof fetch)).resolves.toBe(false);
    expect(store.has('authToken')).toBe(false);
  });

  it('returns false when the response has no token payload', async () => {
    const fetchFn = vi.fn(
      async () => ({ ok: true, json: async () => ({ success: true, data: {} }) } as unknown as Response)
    );
    await expect(refreshAuthToken(fetchFn as unknown as typeof fetch)).resolves.toBe(false);
    expect(store.has('authToken')).toBe(false);
  });

  it('returns false on network errors instead of throwing', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Load failed');
    });
    await expect(refreshAuthToken(fetchFn as unknown as typeof fetch)).resolves.toBe(false);
  });
});
