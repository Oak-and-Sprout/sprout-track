import prisma from '../../../app/api/db';

/**
 * Cleanup failed push subscriptions
 * Deletes subscriptions where failureCount >= 5
 * @returns Number of subscriptions deleted
 */
export async function cleanupFailedSubscriptions(): Promise<number> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return 0; // No-op if disabled
  }

  try {
    const result = await prisma.pushSubscription.deleteMany({
      where: {
        failureCount: {
          gte: 5,
        },
      },
    });

    const deletedCount = result.count;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} failed push subscription(s)`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up failed subscriptions:', error);
    // Don't throw - this should never block cron execution
    return 0;
  }
}

/**
 * Cleanup old notification logs
 * Deletes logs older than the retention period (default 30 days)
 * @param retentionDays - Number of days to retain logs (default: 30)
 * @returns Number of logs deleted
 */
export async function cleanupOldNotificationLogs(
  retentionDays: number = 30
): Promise<number> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return 0; // No-op if disabled
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    const deletedCount = result.count;
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old notification log(s) (older than ${retentionDays} days)`);
    }

    return deletedCount;
  } catch (error) {
    console.error('Error cleaning up old notification logs:', error);
    // Don't throw - this should never block cron execution
    return 0;
  }
}

/**
 * Result of running cleanup operations
 */
export interface CleanupResult {
  subscriptionsCleaned: number;
  logsCleaned: number;
}

/**
 * Run all cleanup operations
 * @returns Summary of cleanup operations
 */
export async function runCleanup(): Promise<CleanupResult> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return {
      subscriptionsCleaned: 0,
      logsCleaned: 0,
    };
  }

  try {
    // Get retention days from environment (default: 30)
    const retentionDays = process.env.NOTIFICATION_LOG_RETENTION_DAYS
      ? parseInt(process.env.NOTIFICATION_LOG_RETENTION_DAYS, 10)
      : 30;

    // Run cleanup operations
    const [subscriptionsCleaned, logsCleaned] = await Promise.all([
      cleanupFailedSubscriptions(),
      cleanupOldNotificationLogs(retentionDays),
    ]);

    return {
      subscriptionsCleaned,
      logsCleaned,
    };
  } catch (error) {
    console.error('Error running cleanup:', error);
    // Don't throw - this should never block cron execution
    return {
      subscriptionsCleaned: 0,
      logsCleaned: 0,
    };
  }
}
