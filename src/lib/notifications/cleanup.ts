import prisma from '../../../app/api/db';

/**
 * Cleanup failed push subscriptions
 * Deletes subscriptions where failureCount >= 5
 * @returns Number of subscriptions deleted
 */
export async function cleanupFailedSubscriptions(): Promise<number> {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    console.log('[Cleanup] Notifications disabled, skipping subscription cleanup');
    return 0; // No-op if disabled
  }

  console.log('[Cleanup] Starting failed subscription cleanup...');
  try {
    // First, count how many will be deleted
    const countToDelete = await prisma.pushSubscription.count({
      where: {
        failureCount: {
          gte: 5,
        },
      },
    });

    if (countToDelete === 0) {
      console.log('[Cleanup] No failed subscriptions to clean up (failureCount >= 5)');
      return 0;
    }

    console.log(`[Cleanup] Found ${countToDelete} subscription(s) with failureCount >= 5, deleting...`);
    const result = await prisma.pushSubscription.deleteMany({
      where: {
        failureCount: {
          gte: 5,
        },
      },
    });

    const deletedCount = result.count;
    if (deletedCount > 0) {
      console.log(`[Cleanup] ✓ Cleaned up ${deletedCount} failed push subscription(s)`);
    }

    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Error cleaning up failed subscriptions:', error);
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
    console.log('[Cleanup] Notifications disabled, skipping log cleanup');
    return 0; // No-op if disabled
  }

  console.log(`[Cleanup] Starting old notification log cleanup (retention: ${retentionDays} days)...`);
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    console.log(`[Cleanup] Deleting logs older than ${cutoffDate.toISOString()}`);

    // First, count how many will be deleted
    const countToDelete = await prisma.notificationLog.count({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    if (countToDelete === 0) {
      console.log(`[Cleanup] No old notification logs to clean up (older than ${retentionDays} days)`);
      return 0;
    }

    console.log(`[Cleanup] Found ${countToDelete} log(s) older than ${retentionDays} days, deleting...`);
    const result = await prisma.notificationLog.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    const deletedCount = result.count;
    if (deletedCount > 0) {
      console.log(`[Cleanup] ✓ Cleaned up ${deletedCount} old notification log(s) (older than ${retentionDays} days)`);
    }

    return deletedCount;
  } catch (error) {
    console.error('[Cleanup] Error cleaning up old notification logs:', error);
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
    console.log('[Cleanup] Notifications disabled, skipping cleanup');
    return {
      subscriptionsCleaned: 0,
      logsCleaned: 0,
    };
  }

  console.log('[Cleanup] Starting cleanup operations...');
  const startTime = Date.now();

  try {
    // Get retention days from environment (default: 30)
    // With proper validation to handle invalid values
    const DEFAULT_RETENTION_DAYS = 30;
    const MIN_RETENTION_DAYS = 1;
    const MAX_RETENTION_DAYS = 365;

    let retentionDays = DEFAULT_RETENTION_DAYS;
    const envValue = process.env.NOTIFICATION_LOG_RETENTION_DAYS;

    if (envValue) {
      const parsedValue = parseInt(envValue, 10);
      if (isNaN(parsedValue)) {
        console.warn(`[Cleanup] Invalid NOTIFICATION_LOG_RETENTION_DAYS value "${envValue}", using default: ${DEFAULT_RETENTION_DAYS}`);
      } else if (parsedValue < MIN_RETENTION_DAYS) {
        console.warn(`[Cleanup] NOTIFICATION_LOG_RETENTION_DAYS value ${parsedValue} is below minimum ${MIN_RETENTION_DAYS}, using minimum`);
        retentionDays = MIN_RETENTION_DAYS;
      } else if (parsedValue > MAX_RETENTION_DAYS) {
        console.warn(`[Cleanup] NOTIFICATION_LOG_RETENTION_DAYS value ${parsedValue} exceeds maximum ${MAX_RETENTION_DAYS}, using maximum`);
        retentionDays = MAX_RETENTION_DAYS;
      } else {
        retentionDays = parsedValue;
      }
    }

    console.log(`[Cleanup] Using log retention period: ${retentionDays} days`);

    // Run cleanup operations
    const [subscriptionsCleaned, logsCleaned] = await Promise.all([
      cleanupFailedSubscriptions(),
      cleanupOldNotificationLogs(retentionDays),
    ]);

    const duration = Date.now() - startTime;
    console.log(`[Cleanup] Cleanup completed in ${duration}ms: ${subscriptionsCleaned} subscription(s) cleaned, ${logsCleaned} log(s) cleaned`);

    return {
      subscriptionsCleaned,
      logsCleaned,
    };
  } catch (error) {
    console.error('[Cleanup] Error running cleanup:', error);
    // Don't throw - this should never block cron execution
    return {
      subscriptionsCleaned: 0,
      logsCleaned: 0,
    };
  }
}
