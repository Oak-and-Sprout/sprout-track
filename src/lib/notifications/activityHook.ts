import prisma from '../../../app/api/db';
import { NotificationEventType } from '@prisma/client';
import {
  sendNotificationWithLogging,
  NotificationPayload,
} from './push';
import { t, DEFAULT_LANGUAGE } from './i18n';
import { isNotificationsEnabled } from './config';

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
  note: 'note',
  NOTE: 'note',
  wake: 'wake',
  WAKE: 'wake',
};

/**
 * Get localized activity type display name
 */
function getActivityTypeName(activityType: string, lang: string): string {
  const normalized = ACTIVITY_TYPE_MAP[activityType] || activityType.toLowerCase();
  return t(`notification.activityType.${normalized}`, lang);
}

/**
 * Identity of the user who performed the action, used to exclude
 * them from receiving a notification about their own activity.
 */
interface ActingUser {
  accountId?: string | null;
  caretakerId?: string | null;
}

/**
 * Resolve the display name of the acting user (caretaker or account)
 */
async function resolveActorName(actingUser?: ActingUser): Promise<string> {
  if (!actingUser) return '';

  if (actingUser.caretakerId) {
    const caretaker = await prisma.caretaker.findUnique({
      where: { id: actingUser.caretakerId },
      select: { name: true },
    });
    if (caretaker?.name) return caretaker.name;
  }

  if (actingUser.accountId) {
    const account = await prisma.account.findUnique({
      where: { id: actingUser.accountId },
      select: { firstName: true },
    });
    if (account?.firstName) return account.firstName;
  }

  return '';
}

/**
 * Build an activity-specific notification body with actor attribution
 */
function buildNotificationBody(
  normalizedType: string,
  babyName: string,
  actorName: string,
  userLanguage: string,
  activityData?: any
): string {
  const byActor = actorName
    ? t('notification.by', userLanguage, { actorName })
    : '';

  switch (normalizedType) {
    case 'feed': {
      const feedType = activityData?.type;
      if (feedType === 'BOTTLE' && activityData?.amount) {
        return t('notification.feed.bottle.body', userLanguage, {
          babyName, amount: activityData.amount,
          unit: activityData.unitAbbr || 'oz', byActor,
        });
      }
      if (feedType === 'BREAST' && activityData?.side) {
        return t('notification.feed.breast.body', userLanguage, {
          babyName, side: activityData.side.toLowerCase(), byActor,
        });
      }
      if (feedType === 'SOLIDS' && activityData?.food) {
        return t('notification.feed.solids.body', userLanguage, {
          babyName, food: activityData.food, byActor,
        });
      }
      return t('notification.feed.generic.body', userLanguage, {
        babyName, byActor,
      });
    }
    case 'diaper': {
      const diaperType = activityData?.type;
      if (diaperType && ['WET', 'DIRTY', 'BOTH'].includes(diaperType)) {
        return t(`notification.diaper.${diaperType.toLowerCase()}.body`, userLanguage, {
          babyName, byActor,
        });
      }
      return t('notification.diaper.generic.body', userLanguage, {
        babyName, byActor,
      });
    }
    case 'sleep':
      return t('notification.sleep.body', userLanguage, { babyName, byActor });
    case 'wake': {
      if (activityData?.duration) {
        const hours = Math.floor(activityData.duration / 60);
        const mins = Math.round(activityData.duration % 60);
        const durationStr = hours > 0
          ? `${hours}h ${mins}m`
          : `${mins}m`;
        return t('notification.wake.duration.body', userLanguage, {
          babyName, duration: durationStr, byActor,
        });
      }
      return t('notification.wake.body', userLanguage, { babyName, byActor });
    }
    case 'bath':
      return t('notification.bath.body', userLanguage, { babyName, byActor });
    case 'pump': {
      if (activityData?.totalAmount) {
        return t('notification.pump.amount.body', userLanguage, {
          babyName, amount: activityData.totalAmount,
          unit: activityData.unitAbbr || 'oz', byActor,
        });
      }
      return t('notification.pump.body', userLanguage, { babyName, byActor });
    }
    case 'medicine': {
      if (activityData?.medicineName) {
        return t('notification.medicine.named.body', userLanguage, {
          babyName, medicineName: activityData.medicineName, byActor,
        });
      }
      return t('notification.medicine.body', userLanguage, { babyName, byActor });
    }
    case 'note': {
      if (activityData?.content) {
        const notePreview = activityData.content.length > 120
          ? activityData.content.substring(0, 120) + '...'
          : activityData.content;
        return t('notification.note.body', userLanguage, {
          babyName, byActor, notePreview,
        });
      }
      return t('notification.note.notext.body', userLanguage, { babyName, byActor });
    }
    default:
      return t('notification.activity.body', userLanguage, {
        activityName: normalizedType, byActor,
      });
  }
}

/**
 * Notify subscribers when an activity is created
 * @param babyId - The baby ID for the activity
 * @param activityType - Type of activity (feed, diaper, sleep, etc.)
 * @param actingUser - The user who performed the action (excluded from notifications)
 * @param activityData - Optional additional activity data
 */
export async function notifyActivityCreated(
  babyId: string,
  activityType: string,
  actingUser?: ActingUser,
  activityData?: any
): Promise<void> {
  // Check if notifications are enabled
  if (!(await isNotificationsEnabled())) {
    return; // No-op if disabled
  }

  try {
    // Get baby information for notification
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
      select: { firstName: true },
    });

    if (!baby) {
      console.error(`Baby not found: ${babyId}`);
      return;
    }

    const babyName = baby.firstName;
    const actorName = await resolveActorName(actingUser);

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

    // Exclude the acting user's subscriptions so they don't get notified about their own action
    const filteredPreferences = actingUser
      ? matchingPreferences.filter((pref) => {
          const sub = pref.subscription;
          if (!sub) return true;
          if (actingUser.accountId && sub.accountId === actingUser.accountId) return false;
          if (actingUser.caretakerId && sub.caretakerId === actingUser.caretakerId) return false;
          return true;
        })
      : matchingPreferences;

    // Send notifications to all matching preferences
    for (const preference of filteredPreferences) {
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
      const normalizedType = ACTIVITY_TYPE_MAP[activityType] || activityType.toLowerCase();
      const activityName = getActivityTypeName(activityType, userLanguage);
      const payload: NotificationPayload = {
        title: t('notification.activity.title', userLanguage, {
          activityName,
          babyName,
        }),
        body: buildNotificationBody(normalizedType, babyName, actorName, userLanguage, activityData),
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
  if (!(await isNotificationsEnabled())) {
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
