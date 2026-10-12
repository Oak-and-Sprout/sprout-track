import { NextResponse } from 'next/server';

type HookMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RateLimitEntry {
  timestamps: number[];
}

export const DEFAULT_READS_PER_MINUTE = 60;
export const DEFAULT_WRITES_PER_MINUTE = 30;
const WINDOW_MS = 60_000;

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  Array.from(store.entries()).forEach(([key, entry]) => {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  });
}, 5 * 60_000);

/** A positive integer from an env var, or `fallback` when unset/invalid. */
export function parseRateLimit(value: string | undefined, fallback: number): number {
  const parsed = value?.trim() ? Number(value) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per-key, per-minute limit for a method: GET is a read, everything else a write. */
export function getRateLimit(method: HookMethod, env: Record<string, string | undefined> = process.env): number {
  return method === 'GET'
    ? parseRateLimit(env.HOOKS_RATE_LIMIT_READS_PER_MINUTE, DEFAULT_READS_PER_MINUTE)
    : parseRateLimit(env.HOOKS_RATE_LIMIT_WRITES_PER_MINUTE, DEFAULT_WRITES_PER_MINUTE);
}

/**
 * Sliding-window decision for one request at `now`. `timestamps` are prior
 * request times, oldest first. A request recorded at t stops counting at
 * t + windowMs, so `resetAt` (ms) is when the window next frees a slot and,
 * on rejection, `retryAfterSeconds` is the wait until a retry would succeed.
 */
export function evaluateSlidingWindow(
  timestamps: readonly number[],
  now: number,
  limit: number,
  windowMs: number = WINDOW_MS
): { allowed: boolean; timestamps: number[]; remaining: number; resetAt: number; retryAfterSeconds?: number } {
  const active = timestamps.filter((t) => t > now - windowMs);
  if (active.length >= limit) {
    const resetAt = active[active.length - limit] + windowMs;
    return { allowed: false, timestamps: active, remaining: 0, resetAt, retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
  }
  const next = [...active, now];
  return { allowed: true, timestamps: next, remaining: limit - next.length, resetAt: next[0] + windowMs };
}

export function checkRateLimit(
  keyId: string,
  method: HookMethod
): { allowed: boolean; response?: NextResponse; headers: Record<string, string> } {
  const limit = getRateLimit(method);
  const storeKey = `${keyId}:${method}`;
  const result = evaluateSlidingWindow(store.get(storeKey)?.timestamps ?? [], Date.now(), limit);
  store.set(storeKey, { timestamps: result.timestamps });

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };

  if (!result.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: `Rate limit exceeded. Max ${limit} ${method} requests per minute.` } },
        { status: 429, headers: { ...headers, 'Retry-After': String(result.retryAfterSeconds) } }
      ),
      headers,
    };
  }

  return { allowed: true, headers };
}
