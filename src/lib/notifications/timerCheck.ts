import prisma from '../../../app/api/db';
import { NotificationEventType } from '@prisma/client';
import {
  sendNotificationWithLogging,
  NotificationPayload,
} from './push';
import { t, formatTimeElapsed, DEFAULT_LANGUAGE } from './i18n';

/**
 * Parse warning time string (format: "HH:mm") to total minutes
 * @param warningTime - Time string in "HH:mm" format (e.g., "03:00" = 3 hours)
 * @returns Total minutes, or -1 if invalid format (to distinguish from valid 0)
 */
function parseWarningTime(warningTime: string): number {
  if (!warningTime || typeof warningTime !== 'string') {
    console.error(`[TimerCheck] Invalid warning time: value is empty or not a string`);
    return -1;
  }

  const parts = warningTime.split(':');
  if (parts.length !== 2) {
    console.error(`[TimerCheck] Invalid warning time format "${warningTime}": expected "HH:mm" format`);
    return -1;
  }

  const [hours, minutes] = parts.map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    console.error(`[TimerCheck] Invalid warning time values "${warningTime}": hours=${hours}, minutes=${minutes}`);
    return -1;
  }

  return hours * 60 + minutes;
}

/**
 * Get the most recent activity time for a baby
 * @param babyId - The baby ID
 * @param activityType - Type of activity ('feed' or 'diaper')
 * @returns Date of last activity, or null if no activity found
 */
async function getLastActivityTime(
  babyId: string,
  activityType: 'feed' | 'diaper'
): Promise<Date | null> {
  try {
    if (activityType === 'feed') {
      const lastFeed = await prisma.feedLog.findFirst({
        where: {
          babyId,
          deletedAt: null,
        },
        orderBy: {
          time: 'desc',
        },
        select: {
          time: true,
        },
      });
      return lastFeed?.time || null;
    } else if (activityType === 'diaper') {
      const lastDiaper = await prisma.diaperLog.findFirst({
        where: {
          babyId,
          deletedAt: null,
        },
        orderBy: {
          time: 'desc',
        },
        select: {
          time: true,
        },
      });
      return lastDiaper?.time || null;
    }
    return null;
  } catch (error) {
    console.error(`Error getting last ${activityType} activity for baby ${babyId}:`, error);
    return null;
  }
}

/**
 * Check if a notification is eligible to be sent
 * @param lastTimerNotifiedAt - When the last timer notification was sent (null = never)
 * @param timerIntervalMinutes - Minutes between repeat notifications (null = once per expiration)
 * @param lastActivityTime - When the last activity occurred
 * @param thresholdMinutes - Threshold in minutes before timer expires
 * @returns true if notification should be sent
 */
function isNotificationEligible(
  lastTimerNotifiedAt: Date | null,
  timerIntervalMinutes: number | null,
  lastActivityTime: Date | null,
  thresholdMinutes: number
): boolean {
  // If no last activity, don't notify (shouldn't happen, but safety check)
  if (!lastActivityTime) {
    return false;
  }

  const now = new Date();
  const timeSinceActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60);

  // Check if threshold is exceeded
  if (timeSinceActivity < thresholdMinutes) {
    return false; // Timer hasn't expired yet
  }

  // If never notified before, eligible for first notification
  if (!lastTimerNotifiedAt) {
    return true;
  }

  // If timerIntervalMinutes is null, only notify once per expiration
  // Since we already notified once, don't notify again until timer resets
  if (timerIntervalMinutes === null) {
    return false;
  }

  // Check if interval has passed since last notification
  const timeSinceLastNotification =
    (now.getTime() - lastTimerNotifiedAt.getTime()) / (1000 * 60);
  return timeSinceLastNotification >= timerIntervalMinutes;
}

/**
 * Get user language preference from subscription
 * @param accountId - Account ID (if subscription belongs to an account)
 * @param caretakerId - Caretaker ID (if subscription belongs to a caretaker)
 * @returns Language code (e.g., 'en', 'es', 'fr')
 */
async function getUserLanguage(
  accountId: string | null,
  caretakerId: string | null
): Promise<string> {
  if (accountId) {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: { language: true },
    });
    return account?.language || DEFAULT_LANGUAGE;
  }
  if (caretakerId) {
    const caretaker = await prisma.caretaker.findUnique({
      where: { id: caretakerId },
      select: { language: true },
    });
    return caretaker?.language || DEFAULT_LANGUAGE;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Send timer expiration notification
 * @param preference - Notification preference
 * @param baby - Baby information
 * @param eventType - Event type (FEED_TIMER_EXPIRED or DIAPER_TIMER_EXPIRED)
 * @param lastActivityTime - When the last activity occurred
 * @param thresholdMinutes - Threshold in minutes
 * @param userLanguage - User's language preference
 */
async function sendTimerNotification(
  preference: {
    id: string;
    subscription: {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
      accountId: string | null;
      caretakerId: string | null;
    };
  },
  baby: {
    id: string;
    firstName: string;
    lastName: string;
  },
  eventType: NotificationEventType,
  lastActivityTime: Date,
  thresholdMinutes: number
): Promise<void> {
  const babyName = `${baby.firstName} ${baby.lastName}`.trim();
  const now = new Date();
  const timeSinceActivity = (now.getTime() - lastActivityTime.getTime()) / (1000 * 60);

  // Get user's language preference
  const userLanguage = await getUserLanguage(
    preference.subscription.accountId,
    preference.subscription.caretakerId
  );

  // Format time elapsed using localized strings
  const timeElapsed = formatTimeElapsed(timeSinceActivity, userLanguage);

  // Get localized title based on event type
  const titleKey =
    eventType === NotificationEventType.FEED_TIMER_EXPIRED
      ? 'notification.timer.feed.title'
      : 'notification.timer.diaper.title';
  const activityType =
    eventType === NotificationEventType.FEED_TIMER_EXPIRED ? 'feed' : 'diaper';

  const payload: NotificationPayload = {
    title: t(titleKey, userLanguage),
    body: t('notification.timer.body', userLanguage, {
      babyName,
      activityType,
      timeElapsed,
    }),
    icon: '/sprout-128.png',
    badge: '/sprout-128.png',
    tag: `timer-${baby.id}-${eventType}`, // Same tag for deduplication
    data: {
      eventType,
      babyId: baby.id,
    },
  };

  await sendNotificationWithLogging(
    preference.subscription.id,
    {
      endpoint: preference.subscription.endpoint,
      p256dh: preference.subscription.p256dh,
      auth: preference.subscription.auth,
    },
    payload,
    eventType,
    null, // No activity type for timer events
    baby.id
  );
}

/**
 * Check timer expirations and send notifications
 * @returns Number of notifications sent
 */
export async function checkTimerExpirations(): Promise<number> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    console.log('[TimerCheck] Notifications disabled, skipping timer check');
    return 0; // No-op if disabled
  }

  console.log('[TimerCheck] Starting timer expiration check...');
  const startTime = Date.now();

  try {
    // Query all enabled timer-type notification preferences
    console.log('[TimerCheck] Querying enabled timer preferences...');
    const timerPreferences = await prisma.notificationPreference.findMany({
      where: {
        eventType: {
          in: [
            NotificationEventType.FEED_TIMER_EXPIRED,
            NotificationEventType.DIAPER_TIMER_EXPIRED,
          ],
        },
        enabled: true,
      },
      include: {
        subscription: {
          select: {
            id: true,
            endpoint: true,
            p256dh: true,
            auth: true,
            accountId: true,
            caretakerId: true,
          },
        },
        baby: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            feedWarningTime: true,
            diaperWarningTime: true,
          },
        },
      },
    });

    if (timerPreferences.length === 0) {
      console.log('[TimerCheck] No enabled timer preferences found');
      return 0;
    }

    console.log(`[TimerCheck] Found ${timerPreferences.length} enabled timer preference(s)`);

    // Group preferences by baby and event type
    const babyEventMap = new Map<
      string,
      Map<NotificationEventType, typeof timerPreferences>
    >();

    for (const preference of timerPreferences) {
      if (!preference.baby || !preference.subscription) {
        continue;
      }

      const babyId = preference.baby.id;
      if (!babyEventMap.has(babyId)) {
        babyEventMap.set(babyId, new Map());
      }

      const eventMap = babyEventMap.get(babyId)!;
      if (!eventMap.has(preference.eventType)) {
        eventMap.set(preference.eventType, []);
      }

      eventMap.get(preference.eventType)!.push(preference);
    }

    let notificationsSent = 0;
    console.log(`[TimerCheck] Processing ${babyEventMap.size} unique baby/baby-event combination(s)`);

    // Process each baby - convert Map entries to array for ES5 compatibility
    const babyEventEntries = Array.from(babyEventMap.entries());
    for (const [babyId, eventMap] of babyEventEntries) {
      console.log(`[TimerCheck] Processing baby ${babyId}...`);
      const baby = timerPreferences.find((p) => p.baby?.id === babyId)?.baby;
      if (!baby) {
        continue;
      }

      // Check feed timer
      if (eventMap.has(NotificationEventType.FEED_TIMER_EXPIRED)) {
        const feedPreferences = eventMap.get(NotificationEventType.FEED_TIMER_EXPIRED)!;
        const thresholdMinutes = parseWarningTime(baby.feedWarningTime);
        console.log(`[TimerCheck] Checking feed timer for baby ${babyId} (threshold: ${thresholdMinutes} minutes)`);
        const lastFeedTime = await getLastActivityTime(babyId, 'feed');

        if (thresholdMinutes < 0) {
          console.warn(`[TimerCheck] Feed timer check skipped for baby ${babyId}: invalid warning time configuration`);
        } else if (lastFeedTime && thresholdMinutes > 0) {
          const timeSinceLastFeed = (Date.now() - lastFeedTime.getTime()) / (1000 * 60);
          console.log(`[TimerCheck] Last feed: ${timeSinceLastFeed.toFixed(1)} minutes ago (threshold: ${thresholdMinutes} minutes)`);
          
          for (const preference of feedPreferences) {
            if (!preference.subscription) {
              console.warn(`[TimerCheck] Preference ${preference.id} has no subscription, skipping`);
              continue;
            }

            const eligible = isNotificationEligible(
              preference.lastTimerNotifiedAt,
              preference.timerIntervalMinutes,
              lastFeedTime,
              thresholdMinutes
            );

            console.log(`[TimerCheck] Feed timer preference ${preference.id}: eligible=${eligible}, lastNotified=${preference.lastTimerNotifiedAt}, interval=${preference.timerIntervalMinutes}`);

            if (eligible) {
              try {
                console.log(`[TimerCheck] Sending feed timer notification for preference ${preference.id}...`);

                // Update lastTimerNotifiedAt BEFORE sending to prevent duplicate notifications
                // if the app crashes between send and update (race condition fix)
                const previousNotifiedAt = preference.lastTimerNotifiedAt;
                const newNotifiedAt = new Date();
                await prisma.notificationPreference.update({
                  where: { id: preference.id },
                  data: { lastTimerNotifiedAt: newNotifiedAt },
                });

                try {
                  await sendTimerNotification(
                    {
                      id: preference.id,
                      subscription: preference.subscription,
                    },
                    baby,
                    NotificationEventType.FEED_TIMER_EXPIRED,
                    lastFeedTime,
                    thresholdMinutes
                  );
                  notificationsSent++;
                  console.log(`[TimerCheck] Feed timer notification sent successfully (total: ${notificationsSent})`);
                } catch (sendError) {
                  // Rollback lastTimerNotifiedAt if send fails
                  console.error(`[TimerCheck] Send failed, rolling back lastTimerNotifiedAt for preference ${preference.id}`);
                  await prisma.notificationPreference.update({
                    where: { id: preference.id },
                    data: { lastTimerNotifiedAt: previousNotifiedAt },
                  });
                  throw sendError;
                }
              } catch (error) {
                console.error(
                  `[TimerCheck] Error sending feed timer notification for preference ${preference.id}:`,
                  error
                );
              }
            }
          }
        } else {
          console.log(`[TimerCheck] Feed timer check skipped: lastFeedTime=${lastFeedTime}, threshold=${thresholdMinutes}`);
        }
      }

      // Check diaper timer
      if (eventMap.has(NotificationEventType.DIAPER_TIMER_EXPIRED)) {
        const diaperPreferences = eventMap.get(NotificationEventType.DIAPER_TIMER_EXPIRED)!;
        const thresholdMinutes = parseWarningTime(baby.diaperWarningTime);
        console.log(`[TimerCheck] Checking diaper timer for baby ${babyId} (threshold: ${thresholdMinutes} minutes)`);
        const lastDiaperTime = await getLastActivityTime(babyId, 'diaper');

        if (thresholdMinutes < 0) {
          console.warn(`[TimerCheck] Diaper timer check skipped for baby ${babyId}: invalid warning time configuration`);
        } else if (lastDiaperTime && thresholdMinutes > 0) {
          const timeSinceLastDiaper = (Date.now() - lastDiaperTime.getTime()) / (1000 * 60);
          console.log(`[TimerCheck] Last diaper: ${timeSinceLastDiaper.toFixed(1)} minutes ago (threshold: ${thresholdMinutes} minutes)`);
          
          for (const preference of diaperPreferences) {
            if (!preference.subscription) {
              console.warn(`[TimerCheck] Preference ${preference.id} has no subscription, skipping`);
              continue;
            }

            const eligible = isNotificationEligible(
              preference.lastTimerNotifiedAt,
              preference.timerIntervalMinutes,
              lastDiaperTime,
              thresholdMinutes
            );

            console.log(`[TimerCheck] Diaper timer preference ${preference.id}: eligible=${eligible}, lastNotified=${preference.lastTimerNotifiedAt}, interval=${preference.timerIntervalMinutes}`);

            if (eligible) {
              try {
                console.log(`[TimerCheck] Sending diaper timer notification for preference ${preference.id}...`);

                // Update lastTimerNotifiedAt BEFORE sending to prevent duplicate notifications
                // if the app crashes between send and update (race condition fix)
                const previousNotifiedAt = preference.lastTimerNotifiedAt;
                const newNotifiedAt = new Date();
                await prisma.notificationPreference.update({
                  where: { id: preference.id },
                  data: { lastTimerNotifiedAt: newNotifiedAt },
                });

                try {
                  await sendTimerNotification(
                    {
                      id: preference.id,
                      subscription: preference.subscription,
                    },
                    baby,
                    NotificationEventType.DIAPER_TIMER_EXPIRED,
                    lastDiaperTime,
                    thresholdMinutes
                  );
                  notificationsSent++;
                  console.log(`[TimerCheck] Diaper timer notification sent successfully (total: ${notificationsSent})`);
                } catch (sendError) {
                  // Rollback lastTimerNotifiedAt if send fails
                  console.error(`[TimerCheck] Send failed, rolling back lastTimerNotifiedAt for preference ${preference.id}`);
                  await prisma.notificationPreference.update({
                    where: { id: preference.id },
                    data: { lastTimerNotifiedAt: previousNotifiedAt },
                  });
                  throw sendError;
                }
              } catch (error) {
                console.error(
                  `[TimerCheck] Error sending diaper timer notification for preference ${preference.id}:`,
                  error
                );
              }
            }
          }
        } else {
          console.log(`[TimerCheck] Diaper timer check skipped: lastDiaperTime=${lastDiaperTime}, threshold=${thresholdMinutes}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TimerCheck] Timer check completed: ${notificationsSent} notification(s) sent in ${duration}ms`);
    return notificationsSent;
  } catch (error) {
    console.error('[TimerCheck] Error in checkTimerExpirations:', error);
    // Don't throw - this should never block cron execution
    return 0;
  }
}
