import prisma from '../../../app/api/db';
import { NotificationConfig } from '@prisma/client';
import { decrypt, isEncrypted } from '../../../app/api/utils/encryption';

/**
 * Cached notification configuration with TTL
 * Central module for all notification code to read config from DB
 */

let cachedConfig: NotificationConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Decrypted notification config shape
 */
export interface DecryptedNotificationConfig {
  id: string;
  enabled: boolean;
  vapidPublicKey: string | null;
  vapidPrivateKey: string | null;
  vapidSubject: string | null;
  logRetentionDays: number;
  updatedAt: Date;
}

/**
 * Get the raw NotificationConfig record from DB (with caching)
 * Encrypted fields remain encrypted in this result
 */
export async function getNotificationConfig(): Promise<NotificationConfig | null> {
  const now = Date.now();
  if (cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const config = await prisma.notificationConfig.findFirst();
    cachedConfig = config;
    cacheTimestamp = now;
    return config;
  } catch (error) {
    console.error('Error fetching notification config from DB:', error);
    return cachedConfig; // Return stale cache on error
  }
}

/**
 * Get the notification config with sensitive fields decrypted
 */
export async function getDecryptedNotificationConfig(): Promise<DecryptedNotificationConfig | null> {
  const config = await getNotificationConfig();
  if (!config) return null;

  return {
    ...config,
    vapidPrivateKey: config.vapidPrivateKey && isEncrypted(config.vapidPrivateKey)
      ? decrypt(config.vapidPrivateKey)
      : config.vapidPrivateKey,
  };
}

/**
 * Fast-path check for whether notifications are enabled
 * Falls back to process.env if no DB record exists (backward compatibility)
 */
export async function isNotificationsEnabled(): Promise<boolean> {
  const config = await getNotificationConfig();
  if (config) return config.enabled;
  // Fallback to env var during transition (before seed script runs)
  return false;
}

/**
 * Clear the cached config (call after PUT updates)
 */
export function clearNotificationConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
}

/**
 * Track whether web-push has been initialized with VAPID credentials
 * Used by push.ts — reset when VAPID keys change via admin UI
 */
let webPushInitialized = false;

export function isWebPushInitialized(): boolean {
  return webPushInitialized;
}

export function setWebPushInitialized(value: boolean): void {
  webPushInitialized = value;
}

/**
 * Reset web-push initialization state (call when VAPID keys change)
 */
export function resetWebPushState(): void {
  webPushInitialized = false;
}
