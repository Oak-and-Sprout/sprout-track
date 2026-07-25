/**
 * Native push dispatcher. Owns the device-token query, per-platform routing, and
 * the token lifecycle; the transport modules (fcmPush, apnsPush) only send one
 * message and report an outcome. Rows for an unconfigured platform are skipped
 * before any transport call or lifecycle write — a deployment with FCM but no
 * APNs delivers to Android and silently skips iOS, rather than recording those
 * skips as failures (an unconfigured transport's outcome is indistinguishable
 * from a real transient failure, so the dispatcher must not let it reach
 * onFailure).
 */

import prisma from '../../../app/api/db';
import type { NotificationPayload } from './push';
import { sendOne as sendFcmOne, isFcmConfigured } from './fcmPush';
import { sendOne as sendApnsOne, isApnsConfigured } from './apnsPush';

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
  /**
   * Gate on platform configuration *before* calling the transport. An
   * unconfigured transport's `{ success: false, unregistered: false }` is
   * indistinguishable from a real transient failure, so the dispatcher must
   * not route unconfigured rows through onFailure — that would accumulate
   * failureCount on every send attempt forever, purely because the platform
   * was never set up.
   */
  fcmConfigured: () => boolean;
  apnsConfigured: () => boolean;
}

const defaultDeps = (): NativePushDeps => ({
  sendFcm: sendFcmOne,
  sendApns: sendApnsOne,
  fcmConfigured: isFcmConfigured,
  apnsConfigured: isApnsConfigured,
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
    const isIos = row.platform === 'ios';
    if (isIos ? !deps.apnsConfigured() : !deps.fcmConfigured()) {
      // Platform never configured — skip entirely, no transport call and no
      // lifecycle write. This is not a failed send.
      continue;
    }
    try {
      const result = isIos
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
