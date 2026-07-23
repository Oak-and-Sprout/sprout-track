/**
 * Native push channel: FCM HTTP v1, called directly with fetch. Sits beside the
 * VAPID web-push path (push.ts) and mirrors its token-lifecycle handling:
 * unregistered tokens are deleted, transient failures increment failureCount.
 * Configured via FCM_SERVICE_ACCOUNT_JSON (inline Firebase service-account JSON);
 * unconfigured deployments no-op.
 */

import jwt from 'jsonwebtoken';
import prisma from '../../../app/api/db';
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

interface FcmSendResult {
  success: boolean;
  unregistered: boolean;
}

async function sendFcm(account: FcmServiceAccount, token: string, payload: NotificationPayload): Promise<FcmSendResult> {
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

/**
 * Send `payload` to the device tokens belonging to the given caretaker/account
 * within the family. Returns the number of successful sends.
 */
export async function sendToDeviceTokens(
  target: { familyId: string; caretakerId?: string | null; accountId?: string | null },
  payload: NotificationPayload
): Promise<number> {
  const account = loadFcmServiceAccount();
  if (!account) return 0;
  if (!target.caretakerId && !target.accountId) return 0;

  const ownerFilter: object[] = [];
  if (target.caretakerId) ownerFilter.push({ caretakerId: target.caretakerId });
  if (target.accountId) ownerFilter.push({ accountId: target.accountId });

  const tokens = await prisma.deviceToken.findMany({
    where: { familyId: target.familyId, OR: ownerFilter },
  });

  let sent = 0;
  for (const deviceToken of tokens) {
    try {
      const result = await sendFcm(account, deviceToken.token, payload);
      if (result.success) {
        sent += 1;
        await prisma.deviceToken.update({
          where: { id: deviceToken.id },
          data: { failureCount: 0, lastSuccessAt: new Date() },
        });
      } else if (result.unregistered) {
        await prisma.deviceToken.delete({ where: { id: deviceToken.id } });
      } else {
        await prisma.deviceToken.update({
          where: { id: deviceToken.id },
          data: { failureCount: { increment: 1 }, lastFailureAt: new Date() },
        });
      }
    } catch (error) {
      console.error('[FCM] unexpected send error:', error);
    }
  }
  return sent;
}
