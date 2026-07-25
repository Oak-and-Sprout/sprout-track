/**
 * Pure FCM (Android) transport: HTTP v1, called directly with fetch. Sends one
 * message to one token and reports an outcome — it does not touch the
 * database or own any token lifecycle; that's owned by the nativePush.ts
 * dispatcher, which decides success/failure/unregistered handling and skips
 * calling this module entirely when FCM isn't configured. Configured via
 * FCM_SERVICE_ACCOUNT_JSON (inline Firebase service-account JSON).
 */

import jwt from 'jsonwebtoken';
import type { NotificationPayload } from './push';

export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function loadFcmServiceAccount(env: NodeJS.ProcessEnv = process.env): FcmServiceAccount | null {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (
      typeof parsed.project_id !== 'string' ||
      typeof parsed.client_email !== 'string' ||
      typeof parsed.private_key !== 'string'
    ) {
      return null;
    }
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return loadFcmServiceAccount() !== null;
}

export function buildFcmMessage(token: string, payload: NotificationPayload): Record<string, unknown> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = String(value);
  }
  const message: Record<string, unknown> = {
    token,
    notification: { title: payload.title, body: payload.body },
    data,
  };
  if (payload.tag) {
    message.android = { collapse_key: payload.tag };
    message.apns = { headers: { 'apns-collapse-id': payload.tag } };
  }
  return { message };
}

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(account: FcmServiceAccount): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }
  const assertion = jwt.sign(
    { scope: FCM_SCOPE, aud: OAUTH_TOKEN_URL },
    account.privateKey,
    { algorithm: 'RS256', issuer: account.clientEmail, expiresIn: 3600 }
  );
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM OAuth token request failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export async function sendOne(
  token: string,
  payload: NotificationPayload
): Promise<{ success: boolean; unregistered: boolean }> {
  const account = loadFcmServiceAccount();
  if (!account) return { success: false, unregistered: false };
  const accessToken = await getAccessToken(account);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFcmMessage(token, payload)),
    }
  );
  if (res.ok) return { success: true, unregistered: false };
  const body = await res.text();
  const unregistered = res.status === 404 && body.includes('UNREGISTERED');
  console.error(`[FCM] send failed (${res.status}): ${body.slice(0, 300)}`);
  return { success: false, unregistered };
}
