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

export async function sendOne(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; unregistered: boolean }> {
  const config = loadApnsConfig();
  if (!config) return { success: false, unregistered: false };

  const host = config.production ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com';
  const { path, headers, body } = buildApnsRequest(token, payload, config);

  return new Promise((resolve) => {
    const client = http2.connect(host);
    client.on('error', () => {
      client.close();
      resolve({ success: false, unregistered: false });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': path,
      authorization: `bearer ${providerToken(config)}`,
      ...headers,
    });

    let status = 0;
    let responseBody = '';
    req.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    req.on('data', (chunk) => {
      responseBody += chunk;
    });
    req.on('error', () => {
      client.close();
      resolve({ success: false, unregistered: false });
    });
    req.on('end', () => {
      client.close();
      const result = classifyApnsResponse(status, responseBody);
      if (!result.success) {
        console.error(`[APNs] send failed (${status}): ${responseBody.slice(0, 300)}`);
      }
      resolve(result);
    });

    req.end(body);
  });
}
