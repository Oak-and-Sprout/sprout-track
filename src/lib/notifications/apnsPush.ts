/**
 * Native push for iOS: APNs HTTP/2, called directly. Sits beside fcmPush.ts
 * (Android) under the nativePush.ts dispatcher. Configured via APNS_* env vars;
 * unconfigured deployments no-op. No Firebase involvement on this path.
 */

import http2 from 'node:http2';
import jwt from 'jsonwebtoken';
import type { NotificationPayload } from './push';

export interface ApnsConfig {
  authKey: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  production: boolean;
}

export function loadApnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const authKey = env.APNS_AUTH_KEY;
  const keyId = env.APNS_KEY_ID;
  const teamId = env.APNS_TEAM_ID;
  const bundleId = env.APNS_BUNDLE_ID;
  if (!authKey || !keyId || !teamId || !bundleId) return null;
  return {
    authKey: authKey.replace(/\\n/g, '\n'),
    keyId,
    teamId,
    bundleId,
    production: env.APNS_PRODUCTION === 'true',
  };
}

export function isApnsConfigured(): boolean {
  return loadApnsConfig() !== null;
}

export function buildApnsJwtClaims(config: ApnsConfig, nowSeconds: number): { iss: string; iat: number } {
  return { iss: config.teamId, iat: nowSeconds };
}

export function buildApnsRequest(
  token: string,
  payload: NotificationPayload,
  config: ApnsConfig
): { path: string; headers: Record<string, string>; body: string } {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = String(value);
  }
  const headers: Record<string, string> = {
    'apns-topic': config.bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
  };
  if (payload.tag) headers['apns-collapse-id'] = payload.tag;
  return {
    path: `/3/device/${token}`,
    headers,
    body: JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: 'default' },
      ...data,
    }),
  };
}

export function classifyApnsResponse(
  status: number,
  body: string
): { success: boolean; unregistered: boolean } {
  if (status === 200) return { success: true, unregistered: false };
  // Only a definitive "this token is dead" deletes it. BadDeviceToken is far more
  // often a sandbox/production mismatch (see APNS_PRODUCTION) than a gone device.
  const unregistered = status === 410 && body.includes('Unregistered');
  return { success: false, unregistered };
}

// Apple rejects provider tokens refreshed more often than once per 20 minutes,
// so this cache is required, not an optimization.
const TOKEN_TTL_MS = 45 * 60 * 1000;
let cachedProviderToken: { token: string; issuedAt: number } | null = null;

function providerToken(config: ApnsConfig): string {
  const now = Date.now();
  if (cachedProviderToken && now - cachedProviderToken.issuedAt < TOKEN_TTL_MS) {
    return cachedProviderToken.token;
  }
  const token = jwt.sign(buildApnsJwtClaims(config, Math.floor(now / 1000)), config.authKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: config.keyId },
  });
  cachedProviderToken = { token, issuedAt: now };
  return token;
}

type ApnsResult = { success: boolean; unregistered: boolean };
type Finish = (result: ApnsResult) => void;

const REQUEST_TIMEOUT_MS = 10_000;
/** Reap a connection nobody has used for a while rather than hold a dead socket. */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

interface PooledSession {
  session: http2.ClientHttp2Session;
  /** Finishers for requests still in flight on this session. */
  inflight: Set<Finish>;
}

/**
 * One HTTP/2 session per APNs host, reused across sends.
 *
 * Apple documents that providers should hold connections open and may treat
 * repeated open/close as a denial-of-service attempt. It also matters locally:
 * nativePush sends to each device token sequentially, so a family with three
 * iOS devices used to pay three back-to-back TLS handshakes inside a single
 * cron pass, where HTTP/2 was designed to multiplex them onto one connection.
 *
 * Keyed by host so a sandbox/production switch (APNS_PRODUCTION) never reuses
 * the wrong connection.
 */
const pool = new Map<string, PooledSession>();

/**
 * Drop the entry from the pool and settle everything still riding on it. Called
 * for any condition that makes the session unusable - APNs sends GOAWAY
 * routinely, and a cached session that ignores it hands back a dead connection
 * for every later send.
 */
function discard(host: string, entry: PooledSession, destroy: boolean): void {
  if (pool.get(host) === entry) pool.delete(host);
  const pending = Array.from(entry.inflight);
  entry.inflight.clear();
  for (const finish of pending) finish({ success: false, unregistered: false });
  if (destroy) entry.session.destroy();
}

function getPooledSession(host: string): PooledSession {
  const existing = pool.get(host);
  if (existing && !existing.session.closed && !existing.session.destroyed) return existing;

  const entry: PooledSession = { session: http2.connect(host), inflight: new Set() };
  pool.set(host, entry);

  entry.session.setTimeout(IDLE_TIMEOUT_MS, () => discard(host, entry, true));
  entry.session.on('error', () => discard(host, entry, true));
  entry.session.on('goaway', () => discard(host, entry, true));
  // Already closing - evict and settle, but don't re-enter destroy().
  entry.session.on('close', () => discard(host, entry, false));

  return entry;
}

export async function sendOne(
  token: string,
  payload: NotificationPayload
): Promise<ApnsResult> {
  const config = loadApnsConfig();
  if (!config) return { success: false, unregistered: false };

  const host = config.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const { path, headers, body } = buildApnsRequest(token, payload, config);

  return new Promise((resolve) => {
    let settled = false;
    const entry = getPooledSession(host);

    // `settled` guards against double-resolving when a timeout races an error,
    // an end event, or a session-level teardown that settles every in-flight
    // request at once.
    const finish: Finish = (result) => {
      if (settled) return;
      settled = true;
      entry.inflight.delete(finish);
      resolve(result);
    };
    entry.inflight.add(finish);

    const req = entry.session.request({
      ':method': 'POST',
      ':path': path,
      authorization: `bearer ${providerToken(config)}`,
      ...headers,
    });

    // A stalled request is a strong signal the whole session is unhealthy, so
    // tear it down rather than let later sends queue behind it. This also
    // covers a connect-level stall: the stream never gets a response either way.
    req.setTimeout(REQUEST_TIMEOUT_MS, () => discard(host, entry, true));

    let status = 0;
    let responseBody = '';
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    // A single stream failing (RST_STREAM) must not take the shared connection
    // down with it - only this request is lost.
    req.on('error', () => finish({ success: false, unregistered: false }));
    req.on('end', () => {
      const result = classifyApnsResponse(status, responseBody);
      if (!result.success) {
        console.error(`[APNs] send failed (${status}): ${responseBody.slice(0, 300)}`);
      }
      finish(result);
    });

    req.end(body);
  });
}
