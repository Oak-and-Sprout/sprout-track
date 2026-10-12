import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_READS_PER_MINUTE,
  DEFAULT_WRITES_PER_MINUTE,
  checkRateLimit,
  evaluateSlidingWindow,
  getRateLimit,
  parseRateLimit,
} from '../app/api/hooks/v1/rate-limiter';

const T0 = new Date('2026-10-12T12:00:00.000Z').getTime();

describe('parseRateLimit', () => {
  it.each([undefined, '', '   ', 'abc', '0', '-5', '1.5', '10req', 'Infinity'])(
    'falls back to the default for %j',
    (value) => {
      expect(parseRateLimit(value, 42)).toBe(42);
    }
  );

  it('accepts a positive integer, ignoring surrounding whitespace', () => {
    expect(parseRateLimit('120', 42)).toBe(120);
    expect(parseRateLimit(' 90 ', 42)).toBe(90);
    expect(parseRateLimit('1', 42)).toBe(1);
  });
});

describe('getRateLimit', () => {
  it('defaults to 60 reads and 30 writes per minute', () => {
    expect(DEFAULT_READS_PER_MINUTE).toBe(60);
    expect(DEFAULT_WRITES_PER_MINUTE).toBe(30);
    expect(getRateLimit('GET', {})).toBe(60);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      expect(getRateLimit(method, {})).toBe(30);
    }
  });

  it('reads GET from HOOKS_RATE_LIMIT_READS_PER_MINUTE and writes from HOOKS_RATE_LIMIT_WRITES_PER_MINUTE', () => {
    const env = { HOOKS_RATE_LIMIT_READS_PER_MINUTE: '200', HOOKS_RATE_LIMIT_WRITES_PER_MINUTE: '100' };
    expect(getRateLimit('GET', env)).toBe(200);
    for (const method of ['POST', 'PUT', 'DELETE'] as const) {
      expect(getRateLimit(method, env)).toBe(100);
    }
  });

  it('ignores invalid values per variable', () => {
    const env = { HOOKS_RATE_LIMIT_READS_PER_MINUTE: '0', HOOKS_RATE_LIMIT_WRITES_PER_MINUTE: 'lots' };
    expect(getRateLimit('GET', env)).toBe(60);
    expect(getRateLimit('POST', env)).toBe(30);
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('applies the configured write limit and sends an accurate Retry-After on 429', async () => {
    vi.stubEnv('HOOKS_RATE_LIMIT_WRITES_PER_MINUTE', '2');
    const key = `key-${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 'POST').allowed).toBe(true);
    vi.advanceTimersByTime(10_000);
    const second = checkRateLimit(key, 'POST');
    expect(second.allowed).toBe(true);
    expect(second.headers['X-RateLimit-Remaining']).toBe('0');
    vi.advanceTimersByTime(10_000);

    const limited = checkRateLimit(key, 'POST');
    expect(limited.allowed).toBe(false);
    expect(limited.response!.status).toBe(429);
    expect(limited.response!.headers.get('Retry-After')).toBe('40');
    expect(limited.response!.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(limited.response!.headers.get('X-RateLimit-Reset')).toBe(String((T0 + 60_000) / 1000));
    const body = await limited.response!.json();
    expect(body.error.code).toBe('RATE_LIMITED');

    vi.advanceTimersByTime(40_000);
    expect(checkRateLimit(key, 'POST').allowed).toBe(true);
  });

  it('keeps reads and writes in separate windows with their own limits', () => {
    vi.stubEnv('HOOKS_RATE_LIMIT_READS_PER_MINUTE', '3');
    vi.stubEnv('HOOKS_RATE_LIMIT_WRITES_PER_MINUTE', '1');
    const key = `key-${crypto.randomUUID()}`;

    expect(checkRateLimit(key, 'POST').allowed).toBe(true);
    expect(checkRateLimit(key, 'POST').allowed).toBe(false);
    const read = checkRateLimit(key, 'GET');
    expect(read.allowed).toBe(true);
    expect(read.headers['X-RateLimit-Limit']).toBe('3');
    expect(read.headers['X-RateLimit-Remaining']).toBe('2');
  });

  it('limits per key', () => {
    vi.stubEnv('HOOKS_RATE_LIMIT_WRITES_PER_MINUTE', '1');
    const a = `key-${crypto.randomUUID()}`;
    const b = `key-${crypto.randomUUID()}`;
    expect(checkRateLimit(a, 'PUT').allowed).toBe(true);
    expect(checkRateLimit(a, 'PUT').allowed).toBe(false);
    expect(checkRateLimit(b, 'PUT').allowed).toBe(true);
  });
});
