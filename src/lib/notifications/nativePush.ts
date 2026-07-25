/**
 * Native push dispatcher. Owns the device-token query, per-platform routing, and
 * the token lifecycle; the transport modules (fcmPush, apnsPush) only send one
 * message and report an outcome. Unconfigured transports no-op, so a deployment
 * with FCM but no APNs delivers to Android and skips iOS.
 */

import prisma from '../../../app/api/db';
import type { NotificationPayload } from './push';
import { sendOne as sendFcmOne } from './fcmPush';
import { sendOne as sendApnsOne } from './apnsPush';

export interface SendOutcome {
  success: boolean;
  unregistered: boolean;
}

interface TokenRow {
  id: string;
  token: string;
  platform: string;
}

export interface NativePushDeps {
  sendFcm: (token: string, payload: NotificationPayload) => Promise<SendOutcome>;
  sendApns: (token: string, payload: NotificationPayload) => Promise<SendOutcome>;
  findTokens: (target: { familyId: string; ownerFilter: object[] }) => Promise<TokenRow[]>;
  onSuccess: (id: string) => Promise<void>;
  onFailure: (id: string) => Promise<void>;
  /** Keyed on the token, not the row id: one dead token may own rows in several families. */
  onUnregistered: (token: string) => Promise<void>;
}

const defaultDeps = (): NativePushDeps => ({
  sendFcm: sendFcmOne,
  sendApns: sendApnsOne,
  findTokens: ({ familyId, ownerFilter }) =>
    prisma.deviceToken.findMany({ where: { familyId, OR: ownerFilter } }),
  onSuccess: async (id) => {
    await prisma.deviceToken.update({
      where: { id },
      data: { failureCount: 0, lastSuccessAt: new Date() },
    });
  },
  onFailure: async (id) => {
    await prisma.deviceToken.update({
      where: { id },
      data: { failureCount: { increment: 1 }, lastFailureAt: new Date() },
    });
  },
  onUnregistered: async (token) => {
    await prisma.deviceToken.deleteMany({ where: { token } });
  },
});

export async function sendToDeviceTokens(
  target: { familyId: string; caretakerId?: string | null; accountId?: string | null },
  payload: NotificationPayload,
  depsOverride?: Partial<NativePushDeps>
): Promise<number> {
  const deps: NativePushDeps = { ...defaultDeps(), ...depsOverride };

  if (!target.caretakerId && !target.accountId) return 0;

  const ownerFilter: object[] = [];
  if (target.caretakerId) ownerFilter.push({ caretakerId: target.caretakerId });
  if (target.accountId) ownerFilter.push({ accountId: target.accountId });

  const tokens = await deps.findTokens({ familyId: target.familyId, ownerFilter });

  let sent = 0;
  for (const row of tokens) {
    try {
      const result =
        row.platform === 'ios'
          ? await deps.sendApns(row.token, payload)
          : await deps.sendFcm(row.token, payload);

      if (result.success) {
        sent += 1;
        await deps.onSuccess(row.id);
      } else if (result.unregistered) {
        await deps.onUnregistered(row.token);
      } else {
        await deps.onFailure(row.id);
      }
    } catch (error) {
      console.error('[NativePush] unexpected send error:', error);
    }
  }
  return sent;
}
