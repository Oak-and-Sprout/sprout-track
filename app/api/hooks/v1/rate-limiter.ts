import { NextResponse } from 'next/server';

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  Array.from(store.entries()).forEach(([key, entry]) => {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  });
}, 5 * 60_000);

export function checkRateLimit(
  keyId: string,
  method: 'GET' | 'POST'
): { allowed: boolean; response?: NextResponse; headers: Record<string, string> } {
  const limit = method === 'GET' ? 60 : 30;
  const windowMs = 60_000;
  const now = Date.now();
  const storeKey = `${keyId}:${method}`;

  let entry = store.get(storeKey);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(storeKey, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

  const remaining = Math.max(0, limit - entry.timestamps.length);
  const resetTime = Math.ceil((now + windowMs) / 1000);

  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetTime),
  };

  if (entry.timestamps.length >= limit) {
    return {
      allowed: false,
      response: NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: `Rate limit exceeded. Max ${limit} ${method} requests per minute.` } },
        { status: 429, headers }
      ),
      headers,
    };
  }

  entry.timestamps.push(now);

  return { allowed: true, headers };
}
