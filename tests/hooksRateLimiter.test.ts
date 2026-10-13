import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('../app/api/db', () => ({ default: { appConfig: { findFirst: mocks.findFirst } } }));

import {
  DEFAULT_BATCH_PER_MINUTE,
  DEFAULT_READS_PER_MINUTE,
  DEFAULT_WRITES_PER_MINUTE,
  MAX_RATE_LIMIT_PER_MINUTE,
  checkRateLimit,
  clearRateLimitConfigCache,
  evaluateSlidingWindow,
  getRateLimit,
  parseRateLimitSetting,
} from '../app/api/hooks/v1/rate-limiter';

const T0 = new Date('2026-10-12T12:00:00.000Z').getTime();

describe('parseRateLimitSetting', () => {
  it.each([undefined, null, '', '   ', 'abc', '0', 0, '-5', -5, '1.5', 1.5, '10req', 'Infinity', Infinity, NaN, true, MAX_RATE_LIMIT_PER_MINUTE + 1])(
    'rejects %j',
    (value) => {
      expect(parseRateLimitSetting(value)).toBeNull();
    }
  );

  it('accepts whole numbers from 1 to the maximum, as numbers or form strings', () => {
    expect(parseRateLimitSetting(120)).toBe(120);
    expect(parseRateLimitSetting(' 90 ')).toBe(90);
    expect(parseRateLimitSetting(1)).toBe(1);
    expect(parseRateLimitSetting(String(MAX_RATE_LIMIT_PER_MINUTE))).toBe(MAX_RATE_LIMIT_PER_MINUTE);
  });
});

describe('getRateLimit', () => {
  it('defaults to 60 reads and 30 writes per minute without a config', () => {
    expect(DEFAULT_READS_PER_MINUTE).toBe(60);
    expect(DEFAULT_WRITES_PER_MINUTE).toBe(30);
    expect(getRateLimit('GET', null)).toBe(60);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      expect(getRateLimit(method, null)).toBe(30);
    }
  });

  it('limits batch requests separately, defaulting to 5 per minute', () => {
    expect(DEFAULT_BATCH_PER_MINUTE).toBe(5);
    expect(getRateLimit('BATCH', null)).toBe(5);
    expect(getRateLimit('BATCH', { hooksBatchPerMinute: 12, hooksWritesPerMinute: 100 })).toBe(12);
    expect(getRateLimit('BATCH', { hooksBatchPerMinute: 0 })).toBe(5);
  });

  it('reads GET from hooksReadsPerMinute and writes from hooksWritesPerMinute', () => {
    const config = { hooksReadsPerMinute: 200, hooksWritesPerMinute: 100 };
    expect(getRateLimit('GET', config)).toBe(200);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      expect(getRateLimit(method, config)).toBe(100);
    }
  });

  it('falls back per field when a stored value is out of range', () => {
    const config = { hooksReadsPerMinute: 0, hooksWritesPerMinute: -1 };
    expect(getRateLimit('GET', config)).toBe(60);
    expect(getRateLimit('POST', config)).toBe(30);
  });
});

describe('evaluateSlidingWindow', () => {
  it('records an allowed request and counts it against remaining', () => {
    const result = evaluateSlidingWindow([], T0, 3);
    expect(result).toMatchObject({ allowed: true, timestamps: [T0], remaining: 2, resetAt: T0 + 60_000 });
    expect(result.retryAfterSeconds).toBeUndefined();
  });

  it('reports reset as the moment the oldest request in the window expires', () => {
    const result = evaluateSlidingWindow([T0, T0 + 10_000], T0 + 20_000, 5);
    expect(result.resetAt).toBe(T0 + 60_000);
    expect(result.remaining).toBe(2);
  });

  it('drops expired timestamps (a request exactly one window old has expired)', () => {
    const result = evaluateSlidingWindow([T0, T0 + 30_000], T0 + 60_000, 2);
    expect(result.allowed).toBe(true);
    expect(result.timestamps).toEqual([T0 + 30_000, T0 + 60_000]);
    expect(result.resetAt).toBe(T0 + 90_000);
  });

  it('rejects at the limit with Retry-After counted to the oldest request expiring', () => {
    const result = evaluateSlidingWindow([T0, T0 + 10_000], T0 + 20_000, 2);
    expect(result).toMatchObject({ allowed: false, remaining: 0, resetAt: T0 + 60_000, retryAfterSeconds: 40 });
    expect(result.timestamps).toEqual([T0, T0 + 10_000]);
  });

  it('rounds Retry-After up to whole seconds and never below 1', () => {
    expect(evaluateSlidingWindow([T0], T0 + 59_999, 1).retryAfterSeconds).toBe(1);
    expect(evaluateSlidingWindow([T0], T0 + 20_500, 1).retryAfterSeconds).toBe(40);
  });

  it('waits for enough requests to expire when the window holds more than a lowered limit', () => {
    const window = [T0, T0 + 10_000, T0 + 20_000, T0 + 30_000];
    const result = evaluateSlidingWindow(window, T0 + 40_000, 2);
    // 4 in window, limit 2: three must expire (through T0+20s) before one more fits
    expect(result.resetAt).toBe(T0 + 80_000);
    expect(result.retryAfterSeconds).toBe(40);
  });
});

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    mocks.findFirst.mockReset().mockResolvedValue({ hooksReadsPerMinute: 60, hooksWritesPerMinute: 30 });
    clearRateLimitConfigCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const limits = (hooksReadsPerMinute: number, hooksWritesPerMinute: number) =>
    mocks.findFirst.mockResolvedValue({ hooksReadsPerMinute, hooksWritesPerMinute });

  it('applies the configured write limit and sends an accurate Retry-After on 429', async () => {
    limits(60, 2);
    const key = `key-${crypto.randomUUID()}`;

    expect((await checkRateLimit(key, 'POST')).allowed).toBe(true);
    vi.advanceTimersByTime(10_000);
    const second = await checkRateLimit(key, 'POST');
    expect(second.allowed).toBe(true);
    expect(second.headers['X-RateLimit-Remaining']).toBe('0');
    vi.advanceTimersByTime(10_000);

    const limited = await checkRateLimit(key, 'POST');
    expect(limited.allowed).toBe(false);
    expect(limited.response!.status).toBe(429);
    expect(limited.response!.headers.get('Retry-After')).toBe('40');
    expect(limited.response!.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(limited.response!.headers.get('X-RateLimit-Reset')).toBe(String((T0 + 60_000) / 1000));
    const body = await limited.response!.json();
    expect(body.error.code).toBe('RATE_LIMITED');

    vi.advanceTimersByTime(40_000);
    expect((await checkRateLimit(key, 'POST')).allowed).toBe(true);
  });

  it('keeps reads and writes in separate windows with their own limits', async () => {
    limits(3, 1);
    const key = `key-${crypto.randomUUID()}`;

    expect((await checkRateLimit(key, 'POST')).allowed).toBe(true);
    expect((await checkRateLimit(key, 'POST')).allowed).toBe(false);
    const read = await checkRateLimit(key, 'GET');
    expect(read.allowed).toBe(true);
    expect(read.headers['X-RateLimit-Limit']).toBe('3');
    expect(read.headers['X-RateLimit-Remaining']).toBe('2');
  });

  it('limits per key', async () => {
    limits(60, 1);
    const a = `key-${crypto.randomUUID()}`;
    const b = `key-${crypto.randomUUID()}`;
    expect((await checkRateLimit(a, 'PUT')).allowed).toBe(true);
    expect((await checkRateLimit(a, 'PUT')).allowed).toBe(false);
    expect((await checkRateLimit(b, 'PUT')).allowed).toBe(true);
  });

  it('caches the config for a minute instead of querying on every request', async () => {
    const key = `key-${crypto.randomUUID()}`;
    await checkRateLimit(key, 'GET');
    await checkRateLimit(key, 'GET');
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);

    limits(5, 5);
    vi.advanceTimersByTime(59_000);
    expect((await checkRateLimit(key, 'GET')).headers['X-RateLimit-Limit']).toBe('60');
    vi.advanceTimersByTime(2_000);
    expect((await checkRateLimit(key, 'GET')).headers['X-RateLimit-Limit']).toBe('5');
    expect(mocks.findFirst).toHaveBeenCalledTimes(2);
  });

  it('picks up a saved change immediately once the cache is cleared', async () => {
    const key = `key-${crypto.randomUUID()}`;
    expect((await checkRateLimit(key, 'POST')).headers['X-RateLimit-Limit']).toBe('30');
    limits(60, 500);
    clearRateLimitConfigCache();
    expect((await checkRateLimit(key, 'POST')).headers['X-RateLimit-Limit']).toBe('500');
  });

  it('falls back to the defaults when there is no AppConfig row or the query fails', async () => {
    mocks.findFirst.mockResolvedValue(null);
    expect((await checkRateLimit(`key-${crypto.randomUUID()}`, 'GET')).headers['X-RateLimit-Limit']).toBe('60');

    clearRateLimitConfigCache();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.findFirst.mockRejectedValue(new Error('db down'));
    expect((await checkRateLimit(`key-${crypto.randomUUID()}`, 'POST')).headers['X-RateLimit-Limit']).toBe('30');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
