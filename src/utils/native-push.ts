'use client';

/**
 * Registers this device for native (FCM/APNs) push when running inside the
 * mobile shell. Safe no-op everywhere else. Permission is requested here —
 * i.e. after a successful login, never on first launch.
 */

import { detectNativeApp, getCapacitorPlugin, isNativeApp } from './native-app';

interface PushNotificationsPlugin {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: 'registration', cb: (token: { value: string }) => void): Promise<unknown>;
}

export function shouldAttemptNativePush(flags: {
  isNative: boolean;
  hasPlugin: boolean;
  nativePushEnabled: boolean;
}): boolean {
  return flags.isNative && flags.hasPlugin && flags.nativePushEnabled;
}

let attempted = false;

export async function registerNativePushToken(): Promise<void> {
  if (attempted) return;
  const plugin = getCapacitorPlugin<PushNotificationsPlugin>('PushNotifications');

  let nativePushEnabled = false;
  try {
    const res = await fetch('/api/deployment-config');
    const json = (await res.json()) as { data?: { nativePushEnabled?: boolean } };
    nativePushEnabled = Boolean(json.data?.nativePushEnabled);
  } catch {
    return;
  }

  if (!shouldAttemptNativePush({ isNative: isNativeApp(), hasPlugin: plugin !== null, nativePushEnabled })) {
    return;
  }
  attempted = true;

  try {
    const permission = await plugin!.requestPermissions();
    if (permission.receive !== 'granted') return;

    await plugin!.addListener('registration', (token) => {
      const platform = detectNativeApp(navigator.userAgent).platform;
      void fetch('/api/notifications/device-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') ?? ''}`,
        },
        body: JSON.stringify({ token: token.value, platform }),
      });
    });
    await plugin!.register();
  } catch (error) {
    console.error('[NativePush] registration failed:', error);
  }
}
