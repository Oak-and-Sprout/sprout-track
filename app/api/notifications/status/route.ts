import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withSysAdminAuth } from '../../utils/auth';

/**
 * Notification system status response interface
 */
interface NotificationStatus {
  enabled: boolean;
  vapidConfigured: boolean;
  cronSecretConfigured: boolean;
  lastCronRun: {
    timestamp: string | null;
    notificationsSent: number;
    success: boolean;
  } | null;
  subscriptionCount: number;
  failedSubscriptionCount: number;
}

/**
 * GET handler for notification system status
 * Returns system health status for sysadmin dashboard
 * Requires sysadmin authentication (handled by withSysAdminAuth wrapper)
 */
async function handleGet(req: NextRequest) {
  try {
    // Check notification system status
    const enabled = process.env.ENABLE_NOTIFICATIONS === 'true';
    const vapidConfigured = !!(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    );
    const cronSecretConfigured = !!process.env.NOTIFICATION_CRON_SECRET;

    // Get last cron run from notification logs
    let lastCronRun: NotificationStatus['lastCronRun'] = null;
    if (enabled) {
      const recentLog = await prisma.notificationLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          success: true,
        },
      });

      if (recentLog) {
        // Count notifications sent in the same minute (batch)
        const batchStartTime = new Date(recentLog.createdAt);
        batchStartTime.setSeconds(0, 0);
        const batchEndTime = new Date(batchStartTime);
        batchEndTime.setMinutes(batchEndTime.getMinutes() + 1);

        const notificationsSent = await prisma.notificationLog.count({
          where: {
            createdAt: {
              gte: batchStartTime,
              lt: batchEndTime,
            },
            success: true,
          },
        });

        lastCronRun = {
          timestamp: recentLog.createdAt.toISOString(),
          notificationsSent,
          success: recentLog.success,
        };
      }
    }

    // Get subscription counts
    const subscriptionCount = await prisma.pushSubscription.count();
    const failedSubscriptionCount = await prisma.pushSubscription.count({
      where: {
        failureCount: {
          gte: 1,
        },
      },
    });

    const status: NotificationStatus = {
      enabled,
      vapidConfigured,
      cronSecretConfigured,
      lastCronRun,
      subscriptionCount,
      failedSubscriptionCount,
    };

    return NextResponse.json<ApiResponse<NotificationStatus>>({
      success: true,
      data: status,
    });
  } catch (error: unknown) {
    console.error('Error fetching notification status:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to fetch notification status';
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export const GET = withSysAdminAuth(handleGet);
