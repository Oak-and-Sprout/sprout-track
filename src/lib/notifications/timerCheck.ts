import prisma from '../../../app/api/db';
import { NotificationEventType } from '@prisma/client';
import {
  sendNotificationWithLogging,
  NotificationPayload,
} from './push';

/**
 * Parse warning time string (format: "HH:mm") to total minutes
 * @param warningTime - Time string in "HH:mm" format (e.g., "03:00" = 3 hours)
 * @returns Total minutes
 */
function parseWarningTime(warningTime: string): number {
  const [hours, minutes] = warningTime.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) {
    console.error(`Invalid warning time format: ${warningTime}`);
    return 0;
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
 * Send timer expiration notification
 * @param preference - Notification preference
 * @param baby - Baby information
 * @param eventType - Event type (FEED_TIMER_EXPIRED or DIAPER_TIMER_EXPIRED)
 * @param lastActivityTime - When the last activity occurred
 * @param thresholdMinutes - Threshold in minutes
 */
async function sendTimerNotification(
  preference: {
    id: string;
    subscription: {
      id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
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
  const hours = Math.floor(timeSinceActivity / 60);
  const minutes = Math.floor(timeSinceActivity % 60);

  let timeElapsed: string;
  if (hours > 0) {
    timeElapsed = `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    timeElapsed = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }

  const eventTypeName =
    eventType === NotificationEventType.FEED_TIMER_EXPIRED ? 'Feed' : 'Diaper';
  const eventTypeLower = eventType === NotificationEventType.FEED_TIMER_EXPIRED ? 'feed' : 'diaper';

  const payload: NotificationPayload = {
    title: `${eventTypeName} Timer Expired`,
    body: `${babyName} hasn't had a ${eventTypeLower} in ${timeElapsed}`,
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
    return 0; // No-op if disabled
  }

  try {
    // Query all enabled timer-type notification preferences
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
      return 0;
    }

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

    // Process each baby
    for (const [babyId, eventMap] of babyEventMap.entries()) {
      const baby = timerPreferences.find((p) => p.baby?.id === babyId)?.baby;
      if (!baby) {
        continue;
      }

      // Check feed timer
      if (eventMap.has(NotificationEventType.FEED_TIMER_EXPIRED)) {
        const feedPreferences = eventMap.get(NotificationEventType.FEED_TIMER_EXPIRED)!;
        const thresholdMinutes = parseWarningTime(baby.feedWarningTime);
        const lastFeedTime = await getLastActivityTime(babyId, 'feed');

        if (lastFeedTime && thresholdMinutes > 0) {
          for (const preference of feedPreferences) {
            if (!preference.subscription) {
              continue;
            }

            const eligible = isNotificationEligible(
              preference.lastTimerNotifiedAt,
              preference.timerIntervalMinutes,
              lastFeedTime,
              thresholdMinutes
            );

            if (eligible) {
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

                // Update lastTimerNotifiedAt
                await prisma.notificationPreference.update({
                  where: { id: preference.id },
                  data: { lastTimerNotifiedAt: new Date() },
                });

                notificationsSent++;
              } catch (error) {
                console.error(
                  `Error sending feed timer notification for preference ${preference.id}:`,
                  error
                );
              }
            }
          }
        }
      }

      // Check diaper timer
      if (eventMap.has(NotificationEventType.DIAPER_TIMER_EXPIRED)) {
        const diaperPreferences = eventMap.get(NotificationEventType.DIAPER_TIMER_EXPIRED)!;
        const thresholdMinutes = parseWarningTime(baby.diaperWarningTime);
        const lastDiaperTime = await getLastActivityTime(babyId, 'diaper');

        if (lastDiaperTime && thresholdMinutes > 0) {
          for (const preference of diaperPreferences) {
            if (!preference.subscription) {
              continue;
            }

            const eligible = isNotificationEligible(
              preference.lastTimerNotifiedAt,
              preference.timerIntervalMinutes,
              lastDiaperTime,
              thresholdMinutes
            );

            if (eligible) {
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

                // Update lastTimerNotifiedAt
                await prisma.notificationPreference.update({
                  where: { id: preference.id },
                  data: { lastTimerNotifiedAt: new Date() },
                });

                notificationsSent++;
              } catch (error) {
                console.error(
                  `Error sending diaper timer notification for preference ${preference.id}:`,
                  error
                );
              }
            }
          }
        }
      }
    }

    return notificationsSent;
  } catch (error) {
    console.error('Error in checkTimerExpirations:', error);
    // Don't throw - this should never block cron execution
    return 0;
  }
}
