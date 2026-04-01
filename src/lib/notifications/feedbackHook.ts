import prisma from '../../../app/api/db';
import { isNotificationsEnabled } from './config';
import { sendNotification, NotificationPayload } from './push';
import { t, DEFAULT_LANGUAGE } from './i18n';

/**
 * Send a push notification to a user when an admin replies to their feedback.
 * Bypasses the NotificationPreference system — sends directly to all of the
 * user's active push subscriptions.
 *
 * @param accountId - The feedback author's account ID (nullable)
 * @param caretakerId - The feedback author's caretaker ID (nullable)
 * @param replyMessage - The admin's reply message text
 */
export async function notifyFeedbackReply(
  accountId: string | null,
  caretakerId: string | null,
  replyMessage: string
): Promise<void> {
  if (!(await isNotificationsEnabled())) {
    return;
  }

  try {
    // Build query to find the user's active subscriptions
    const where: Record<string, unknown> = { failureCount: { lt: 5 } };
    if (accountId) {
      where.accountId = accountId;
    } else if (caretakerId) {
      where.caretakerId = caretakerId;
    } else {
      return; // Can't identify user
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where,
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
        accountId: true,
        caretakerId: true,
      },
    });

    if (subscriptions.length === 0) {
      return;
    }

    for (const sub of subscriptions) {
      // Resolve user's language preference
      let userLanguage = DEFAULT_LANGUAGE;
      if (sub.accountId) {
        const account = await prisma.account.findUnique({
          where: { id: sub.accountId },
          select: { language: true },
        });
        userLanguage = account?.language || DEFAULT_LANGUAGE;
      } else if (sub.caretakerId) {
        const caretaker = await prisma.caretaker.findUnique({
          where: { id: sub.caretakerId },
          select: { language: true },
        });
        userLanguage = caretaker?.language || DEFAULT_LANGUAGE;
      }

      const truncatedMessage =
        replyMessage.length > 50
          ? replyMessage.substring(0, 50) + '...'
          : replyMessage;

      const payload: NotificationPayload = {
        title: t('notification.feedback.reply.title', userLanguage),
        body: truncatedMessage,
        icon: '/sprout-128.png',
        badge: '/sprout-128.png',
        tag: `feedback-reply-${Date.now()}`,
      };

      sendNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        payload
      ).catch((error) => {
        console.error('Error sending feedback push notification:', error);
      });
    }
  } catch (error) {
    console.error('Error in notifyFeedbackReply:', error);
    // Don't throw — notifications should never block the feedback reply
  }
}
