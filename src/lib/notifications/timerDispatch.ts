import { NotificationEventType } from '@prisma/client';
import { NotificationPayload, sendNotificationWithLogging } from './push';
import { sendToDeviceTokens } from './nativePush';
import { nativeOwnerKey, PreferenceOwner } from './preferenceOwner';

/**
 * Fires both notification channels for one timer preference row.
 *
 * The two channels are independent and neither may block the other. Web push
 * used to be awaited unguarded with the native dispatch below it, so a rejected
 * web send - VAPID keys absent, undecryptable or malformed - skipped the native
 * send entirely. Because the caller rolls `lastTimerNotifiedAt` back when this
 * throws, every subsequent cron pass retried and failed identically: the app
 * never received another timer notification, and the only trace was a line in
 * the cron log.
 *
 * The web send is still awaited (this runs in a cron, and the caller counts
 * completed notifications) but its failure is contained here. `activityHook`
 * deliberately does NOT share this helper: it runs on the activity-creation
 * request path and must not await either transport.
 */
export interface TimerDispatchDeps {
  sendWeb: typeof sendNotificationWithLogging;
  sendNative: typeof sendToDeviceTokens;
}

export interface TimerDispatchArgs {
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  } | null;
  payload: NotificationPayload;
  eventType: NotificationEventType;
  activityType: string | null;
  babyId: string;
  familyId: string | null;
  owner: PreferenceOwner;
  /** Per-pass guard so one owner gets one native push, not one per row. */
  nativeSent: Set<string>;
}

export async function dispatchTimerPush(
  args: TimerDispatchArgs,
  depsOverride?: Partial<TimerDispatchDeps>
): Promise<void> {
  const deps: TimerDispatchDeps = {
    sendWeb: sendNotificationWithLogging,
    sendNative: sendToDeviceTokens,
    ...depsOverride,
  };

  // Web push: unchanged, still requires a real subscription (endpoint/keys).
  if (args.subscription) {
    try {
      await deps.sendWeb(
        args.subscription.id,
        {
          endpoint: args.subscription.endpoint,
          p256dh: args.subscription.p256dh,
          auth: args.subscription.auth,
        },
        args.payload,
        args.eventType,
        args.activityType,
        args.babyId
      );
    } catch (error) {
      console.error('[TimerCheck] web push failed, continuing to native:', error);
    }
  }

  if (!args.familyId) return;
  const ownerKey = nativeOwnerKey(args.owner);
  if (!ownerKey || args.nativeSent.has(ownerKey)) return;
  args.nativeSent.add(ownerKey);

  // Deliberately not awaited, matching the behaviour this replaced: native
  // sends across preference rows overlap rather than serialising, which
  // matters because each APNs send currently opens its own TLS connection.
  // The .catch() is what keeps a transport failure off the caller.
  void deps
    .sendNative(
      {
        familyId: args.familyId,
        caretakerId: args.owner.caretakerId,
        accountId: args.owner.accountId,
      },
      args.payload
    )
    .catch((error) => console.error('[TimerCheck] native push failed:', error));
}
