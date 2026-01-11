import * as webPush from 'web-push';
import prisma from '../../../app/api/db';
import { NotificationEventType } from '@prisma/client';

/**
 * Initialize web-push with VAPID credentials from environment variables
 * Should be called once at application startup
 */
let isInitialized = false;

export function initializeWebPush(): void {
  if (isInitialized) {
    return;
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:notifications@sprouttrack.app';

  if (!publicKey || !privateKey) {
    throw new Error(
      'VAPID keys are not configured. Please run "npm run setup:vapid" to generate keys.'
    );
  }

  webPush.setVapidDetails(subject, publicKey, privateKey);
  isInitialized = true;
}

/**
 * Notification payload structure
 */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string; // For deduplication - same tag replaces previous notification
  data?: {
    eventType: NotificationEventType;
    babyId: string;
    activityType?: string;
    url?: string; // For deep linking
  };
}

/**
 * Result of sending a notification
 */
export interface SendNotificationResult {
  success: boolean;
  httpStatus?: number;
  error?: string;
}

/**
 * Send a push notification to a subscription endpoint
 * @param subscription - The push subscription object from database
 * @param payload - The notification payload
 * @param options - Optional web-push send options
 */
export async function sendNotification(
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: NotificationPayload,
  options?: webPush.RequestOptions
): Promise<SendNotificationResult> {
  if (!isInitialized) {
    initializeWebPush();
  }

  try {
    const pushSubscription: webPush.PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    };

    const payloadString = JSON.stringify(payload);
    await webPush.sendNotification(pushSubscription, payloadString, options);

    return {
      success: true,
      httpStatus: 200,
    };
  } catch (error: any) {
    // web-push throws errors with statusCode property for HTTP errors
    const httpStatus = error.statusCode || 500;
    const errorMessage = error.message || 'Unknown error';

    return {
      success: false,
      httpStatus,
      error: errorMessage,
    };
  }
}

/**
 * Send notification with logging to database
 * Handles subscription cleanup on 410 Gone, updates failure counts, and logs all attempts
 * @param subscriptionId - The PushSubscription ID from database
 * @param subscription - The push subscription object
 * @param payload - The notification payload
 * @param eventType - The notification event type
 * @param activityType - Optional activity type (for ACTIVITY_CREATED events)
 * @param babyId - The baby ID this notification is about
 */
export async function sendNotificationWithLogging(
  subscriptionId: string,
  subscription: {
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: NotificationPayload,
  eventType: NotificationEventType,
  activityType: string | null,
  babyId: string
): Promise<SendNotificationResult> {
  const result = await sendNotification(subscription, payload);

  // Log the attempt to NotificationLog
  try {
    await prisma.notificationLog.create({
      data: {
        subscriptionId,
        eventType,
        activityType,
        babyId,
        success: result.success,
        errorMessage: result.error ? result.error : null,
        httpStatus: result.httpStatus || null,
        payload: JSON.stringify(payload),
      },
    });
  } catch (logError) {
    console.error('Error logging notification attempt:', logError);
    // Don't fail the function if logging fails
  }

  // Update subscription based on result
  try {
    if (result.success) {
      // Success: reset failure count and update last success time
      await prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          failureCount: 0,
          lastSuccessAt: new Date(),
        },
      });
    } else {
      // Failure: handle based on HTTP status
      if (result.httpStatus === 410) {
        // 410 Gone: Subscription expired, delete immediately
        await prisma.pushSubscription.delete({
          where: { id: subscriptionId },
        });
        console.log(`Deleted expired subscription: ${subscriptionId}`);
      } else {
        // Other errors: increment failure count
        await prisma.pushSubscription.update({
          where: { id: subscriptionId },
          data: {
            failureCount: { increment: 1 },
            lastFailureAt: new Date(),
          },
        });
      }
    }
  } catch (updateError) {
    console.error('Error updating subscription:', updateError);
    // Don't fail the function if update fails
  }

  return result;
}
