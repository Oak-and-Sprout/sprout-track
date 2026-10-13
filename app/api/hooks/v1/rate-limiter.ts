import { NextResponse } from 'next/server';
import prisma from '../../db';

// BATCH is POST /activities/batch, limited separately from single writes
type HookMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'BATCH';

interface RateLimitEntry {
  timestamps: number[];
}

export const DEFAULT_READS_PER_MINUTE = 60;
export const DEFAULT_WRITES_PER_MINUTE = 30;
export const DEFAULT_BATCH_PER_MINUTE = 5;
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

export const MAX_RATE_LIMIT_PER_MINUTE = 10_000;
const CONFIG_TTL_MS = 60_000;

export interface RateLimitConfig {
  hooksReadsPerMinute: number;
  hooksWritesPerMinute: number;
  hooksBatchPerMinute: number;
}

/** A per-minute limit from the App Config form: an integer in 1..MAX, else null. */
export function parseRateLimitSetting(value: unknown): number | null {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_RATE_LIMIT_PER_MINUTE ? parsed : null;
}

/** Per-key, per-minute limit for a method: GET is a read, BATCH a batch, everything else a write. */
export function getRateLimit(method: HookMethod, config: Partial<RateLimitConfig> | null): number {
  if (method === 'GET') return parseRateLimitSetting(config?.hooksReadsPerMinute) ?? DEFAULT_READS_PER_MINUTE;
  if (method === 'BATCH') return parseRateLimitSetting(config?.hooksBatchPerMinute) ?? DEFAULT_BATCH_PER_MINUTE;
  return parseRateLimitSetting(config?.hooksWritesPerMinute) ?? DEFAULT_WRITES_PER_MINUTE;
}

// Limits are deployment-wide (AppConfig), cached so each request doesn't hit the
// database. Saving App Config clears the cache in this process; other processes
// pick the change up within CONFIG_TTL_MS.
let configCache: { value: RateLimitConfig | null; expiresAt: number } | null = null;

export function clearRateLimitConfigCache(): void {
  configCache = null;
}

async function loadRateLimitConfig(): Promise<RateLimitConfig | null> {
  if (configCache && configCache.expiresAt > Date.now()) return configCache.value;
  let value: RateLimitConfig | null = null;
  try {
    value = await prisma.appConfig.findFirst({ select: { hooksReadsPerMinute: true, hooksWritesPerMinute: true, hooksBatchPerMinute: true } });
  } catch (error) {
    console.error('Failed to load webhook rate limits; using defaults:', error);
  }
  configCache = { value, expiresAt: Date.now() + CONFIG_TTL_MS };
  return value;
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

export async function checkRateLimit(
  keyId: string,
  method: HookMethod
): Promise<{ allowed: boolean; response?: NextResponse; headers: Record<string, string> }> {
  const limit = getRateLimit(method, await loadRateLimitConfig());
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
        { success: false, error: { code: 'RATE_LIMITED', message: `Rate limit exceeded. Max ${limit} ${method === 'BATCH' ? 'batch' : method} requests per minute.` } },
        { status: 429, headers: { ...headers, 'Retry-After': String(result.retryAfterSeconds) } }
      ),
      headers,
    };
  }

  return { allowed: true, headers };
}
