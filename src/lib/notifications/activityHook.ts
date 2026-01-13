import prisma from '../../../app/api/db';
import { NotificationEventType } from '@prisma/client';
import {
  sendNotificationWithLogging,
  NotificationPayload,
} from './push';
import { t, DEFAULT_LANGUAGE } from './i18n';

/**
 * Activity type mapping for consistent naming
 */
const ACTIVITY_TYPE_MAP: Record<string, string> = {
  feed: 'feed',
  FEED: 'feed',
  diaper: 'diaper',
  DIAPER: 'diaper',
  sleep: 'sleep',
  SLEEP: 'sleep',
  bath: 'bath',
  BATH: 'bath',
  medicine: 'medicine',
  MEDICINE: 'medicine',
  pump: 'pump',
  PUMP: 'pump',
};

/**
 * Get activity type display name
 */
function getActivityTypeName(activityType: string): string {
  const normalized = ACTIVITY_TYPE_MAP[activityType] || activityType.toLowerCase();
  const names: Record<string, string> = {
    feed: 'Feed',
    diaper: 'Diaper',
    sleep: 'Sleep',
    bath: 'Bath',
    medicine: 'Medicine',
    pump: 'Pump',
  };
  return names[normalized] || normalized;
}

/**
 * Notify subscribers when an activity is created
 * @param babyId - The baby ID for the activity
 * @param activityType - Type of activity (feed, diaper, sleep, etc.)
 * @param activityData - Optional additional activity data
 */
export async function notifyActivityCreated(
  babyId: string,
  activityType: string,
  activityData?: any
): Promise<void> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return; // No-op if disabled
  }

  try {
    // Get baby information for notification
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      select: { firstName: true, lastName: true },
    });

    if (!baby) {
      console.error(`Baby not found: ${babyId}`);
      return;
    }

    const babyName = `${baby.firstName} ${baby.lastName}`.trim();
    const activityName = getActivityTypeName(activityType);

    // Query matching NotificationPreference records with user language
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        babyId,
        eventType: NotificationEventType.ACTIVITY_CREATED,
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
      },
    });

    // Filter preferences by activity type if specified
    const matchingPreferences = preferences.filter((pref) => {
      if (!pref.activityTypes) {
        // null means all activities
        return true;
      }

      try {
        const activityTypes = JSON.parse(pref.activityTypes) as string[];
        const normalizedActivityType = ACTIVITY_TYPE_MAP[activityType] || activityType.toLowerCase();
        return activityTypes.includes(normalizedActivityType);
      } catch (error) {
        // If parsing fails, include it (safer default)
        console.error('Error parsing activityTypes:', error);
        return true;
      }
    });

    // Send notifications to all matching preferences
    for (const preference of matchingPreferences) {
      if (!preference.subscription) {
        continue;
      }

      // Get user's language preference
      let userLanguage = DEFAULT_LANGUAGE;
      if (preference.subscription.accountId) {
        const account = await prisma.account.findUnique({
          where: { id: preference.subscription.accountId },
          select: { language: true },
        });
        userLanguage = account?.language || DEFAULT_LANGUAGE;
      } else if (preference.subscription.caretakerId) {
        const caretaker = await prisma.caretaker.findUnique({
          where: { id: preference.subscription.caretakerId },
          select: { language: true },
        });
        userLanguage = caretaker?.language || DEFAULT_LANGUAGE;
      }

      // Create localized notification payload
      const payload: NotificationPayload = {
        title: t('notification.activity.title', userLanguage, {
          activityName,
          babyName,
        }),
        body: t('notification.activity.body', userLanguage, {
          activityName: activityName.toLowerCase(),
        }),
        icon: '/sprout-128.png',
        badge: '/sprout-128.png',
        tag: `activity-${babyId}-${activityType}-${Date.now()}`, // Unique tag for each notification
        data: {
          eventType: NotificationEventType.ACTIVITY_CREATED,
          babyId,
          activityType: activityType.toLowerCase(),
        },
      };

      // Send notification (non-blocking)
      sendNotificationWithLogging(
        preference.subscription.id,
        {
          endpoint: preference.subscription.endpoint,
          p256dh: preference.subscription.p256dh,
          auth: preference.subscription.auth,
        },
        payload,
        NotificationEventType.ACTIVITY_CREATED,
        activityType.toLowerCase(),
        babyId
      ).catch((error) => {
        console.error('Error sending activity notification:', error);
      });
    }
  } catch (error) {
    console.error('Error in notifyActivityCreated:', error);
    // Don't throw - this should never block activity creation
  }
}

/**
 * Reset timer notification state when relevant activity is logged
 * @param babyId - The baby ID
 * @param activityType - Type of activity (feed or diaper resets their respective timers)
 */
export async function resetTimerNotificationState(
  babyId: string,
  activityType: string
): Promise<void> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return; // No-op if disabled
  }

  try {
    const normalizedActivityType = ACTIVITY_TYPE_MAP[activityType] || activityType.toLowerCase();

    // Feed activity resets feed timer
    if (normalizedActivityType === 'feed') {
      await prisma.notificationPreference.updateMany({
        where: {
          babyId,
          eventType: NotificationEventType.FEED_TIMER_EXPIRED,
        },
        data: {
          lastTimerNotifiedAt: null,
        },
      });
    }

    // Diaper activity resets diaper timer
    if (normalizedActivityType === 'diaper') {
      await prisma.notificationPreference.updateMany({
        where: {
          babyId,
          eventType: NotificationEventType.DIAPER_TIMER_EXPIRED,
        },
        data: {
          lastTimerNotifiedAt: null,
        },
      });
    }
  } catch (error) {
    console.error('Error resetting timer notification state:', error);
    // Don't throw - this should never block activity creation
  }
}
