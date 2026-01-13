/**
 * Client-side push notification subscription management
 * Handles browser-side subscription operations
 */

// Cache for VAPID public key with TTL
interface VapidCache {
  key: string;
  timestamp: number;
}
let vapidCache: VapidCache | null = null;
const VAPID_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check if browser supports push notifications
 */
export function checkPushSupport(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  return permission as 'granted' | 'denied' | 'default';
}

/**
 * Get VAPID public key from server
 * Uses TTL-based caching to handle VAPID key rotation
 */
export async function getVapidPublicKey(): Promise<string> {
  // Return cached key if available and not expired
  const now = Date.now();
  if (vapidCache && (now - vapidCache.timestamp) < VAPID_CACHE_TTL_MS) {
    return vapidCache.key;
  }

  const authToken = localStorage.getItem('authToken');
  const headers: HeadersInit = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  const response = await fetch('/api/notifications/vapid-key', { headers });

  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Push notifications are disabled');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch VAPID key');
  }

  const data = await response.json();
  if (!data.success || !data.data?.publicKey) {
    throw new Error('Invalid VAPID key response');
  }

  const publicKey = data.data.publicKey;
  if (!publicKey) {
    throw new Error('VAPID public key is empty');
  }

  // Cache the key with timestamp
  vapidCache = {
    key: publicKey,
    timestamp: Date.now(),
  };

  return publicKey;
}

/**
 * Clear the VAPID key cache (useful for forcing re-fetch)
 */
export function clearVapidCache(): void {
  vapidCache = null;
}

/**
 * Register service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser');
  }

  try {
    console.log('Registering service worker at /sw.js...');
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none', // Always check for updates
    });
    console.log('Service worker registration returned, state:', registration.installing?.state || registration.waiting?.state || registration.active?.state);

    // Timeout for service worker activation (30 seconds)
    const SW_ACTIVATION_TIMEOUT_MS = 30000;

    // Wait for the specific registration to be ready with timeout
    if (registration.installing) {
      console.log('Service worker is installing...');
      await new Promise<void>((resolve, reject) => {
        const installingWorker = registration.installing;
        if (!installingWorker) {
          resolve();
          return;
        }

        // Set up timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Service worker activation timed out after 30 seconds'));
        }, SW_ACTIVATION_TIMEOUT_MS);

        installingWorker.addEventListener('statechange', () => {
          console.log('Service worker state changed to:', installingWorker.state);
          if (installingWorker.state === 'activated') {
            clearTimeout(timeoutId);
            resolve();
          } else if (installingWorker.state === 'redundant') {
            clearTimeout(timeoutId);
            reject(new Error('Service worker installation failed'));
          }
        });
      });
    } else if (registration.waiting) {
      console.log('Service worker is waiting, sending skip waiting message...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Wait a bit for it to activate
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Ensure we have an active service worker with timeout
    if (registration.active) {
      console.log('Service worker is active');
    } else {
      // Wait for any service worker to be ready as fallback with timeout
      const readyPromise = navigator.serviceWorker.ready;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Service worker ready timed out after 30 seconds'));
        }, SW_ACTIVATION_TIMEOUT_MS);
      });

      await Promise.race([readyPromise, timeoutPromise]);
      console.log('Service worker is ready (via navigator.serviceWorker.ready)');
    }

    return registration;
  } catch (error: any) {
    console.error('Service worker registration failed:', error);
    console.error('Error details:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    
    // Check if it's a 404 error (service worker file not found)
    if (error?.message?.includes('404') || error?.message?.includes('Failed to fetch')) {
      throw new Error('Service worker file not found. Please ensure /sw.js is accessible.');
    }
    
    throw new Error(`Failed to register service worker: ${error?.message || 'Unknown error'}`);
  }
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(
  publicKey: string
): Promise<PushSubscription> {
  console.log('Registering service worker...');
  const registration = await registerServiceWorker();
  console.log('Service worker registered and ready');

  // Verify push manager is available
  if (!registration.pushManager) {
    throw new Error('PushManager is not available. This browser may not support push notifications.');
  }

  // Ensure we have an active service worker before subscribing
  if (!registration.active) {
    console.warn('Service worker is not active, waiting...');
    await navigator.serviceWorker.ready;
    // Re-check registration after ready
    const updatedRegistration = await navigator.serviceWorker.getRegistration();
    if (!updatedRegistration?.active) {
      throw new Error('Service worker failed to activate. Please refresh the page and try again.');
    }
  }

  try {
    console.log('Converting VAPID key...');
    console.log('VAPID key raw:', publicKey);
    console.log('VAPID key length:', publicKey.length);
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    console.log('VAPID key converted, byte length:', applicationServerKey.byteLength);

    // Check for existing subscription first
    console.log('Checking for existing subscription...');
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      console.log('Found existing subscription, unsubscribing first...');
      await existingSubscription.unsubscribe();
      console.log('Unsubscribed from existing subscription');
    }

    console.log('Subscribing to push manager...');
    console.log('Push manager state:', {
      hasPermission: Notification.permission,
      registrationActive: !!registration.active,
      userAgent: navigator.userAgent,
      isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
      isFirefox: navigator.userAgent.includes('Firefox'),
      isChrome: navigator.userAgent.includes('Chrome'),
    });

    // Check if this is Safari (which has limited push support)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      console.warn('Safari detected - push notifications may have limited support');
    }

    // Add timeout to prevent infinite hanging
    const PUSH_SUBSCRIBE_TIMEOUT_MS = 30000;
    console.log('Starting push subscription with 30s timeout...');

    const subscribePromise = registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }).then(sub => {
      console.log('pushManager.subscribe() resolved successfully');
      return sub;
    }).catch(err => {
      console.error('pushManager.subscribe() rejected:', err);
      throw err;
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        console.error('Push subscription timeout reached after 30s');
        // Provide browser-specific guidance
        const isOpera = navigator.userAgent.includes('OPR');
        const browserHint = isOpera
          ? ' Opera may have connectivity issues with push services. Try using Chrome or Firefox instead.'
          : ' Try using a different browser (Chrome or Firefox recommended).';
        reject(new Error(`Push subscription timed out. The push service (FCM/APNs) may be unreachable.${browserHint}`));
      }, PUSH_SUBSCRIBE_TIMEOUT_MS);
    });

    const subscription = await Promise.race([subscribePromise, timeoutPromise]);
    console.log('Push subscription successful, endpoint:', subscription.endpoint?.substring(0, 50) + '...');

    return subscription;
  } catch (error: any) {
    console.error('Push subscription failed:', error);
    console.error('Error details:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    // Provide more specific error messages based on different error types
    let errorMessage = 'Unknown error';
    if (error?.name === 'NotAllowedError') {
      errorMessage = 'Notification permission denied. Please allow notifications in your browser settings.';
    } else if (error?.name === 'NotSupportedError') {
      errorMessage = 'Push notifications are not supported in this browser.';
    } else if (error?.name === 'InvalidStateError') {
      errorMessage = 'Service worker is not in a valid state. Please try again.';
    } else if (error?.name === 'AbortError') {
      errorMessage = 'Push registration was aborted. The VAPID key may be invalid or the push service is unavailable.';
    } else if (error?.message?.includes('timed out')) {
      // Timeout error - pass through the detailed message
      errorMessage = error.message;
    } else if (error?.message?.includes('push service')) {
      errorMessage = 'Push service error. This may be caused by invalid VAPID keys. Try regenerating VAPID keys with: npx ts-node scripts/setup-vapid-keys.ts';
    } else if (error?.message) {
      errorMessage = error.message;
    }

    throw new Error(`${errorMessage}`);
  }
}

/**
 * Send subscription to server
 */
export async function sendSubscriptionToServer(
  subscription: PushSubscription,
  deviceLabel?: string,
  userAgent?: string
): Promise<string> {
  const authToken = localStorage.getItem('authToken');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  console.log('Extracting subscription keys...');
  const keys = subscription.getKey
    ? {
        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
        auth: arrayBufferToBase64(subscription.getKey('auth')),
      }
    : null;

  if (!keys) {
    console.error('Failed to extract subscription keys - getKey method not available');
    throw new Error('Failed to extract subscription keys');
  }

  const payload = {
    endpoint: subscription.endpoint,
    keys,
    deviceLabel: deviceLabel || getDeviceLabel(),
    userAgent: userAgent || navigator.userAgent,
  };

  console.log('Sending subscription to server:', {
    endpoint: payload.endpoint.substring(0, 50) + '...',
    deviceLabel: payload.deviceLabel,
    hasKeys: !!(keys.p256dh && keys.auth),
  });

  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  console.log('Server response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Server error response:', errorText);
    
    if (response.status === 503) {
      throw new Error('Push notifications are disabled');
    }
    
    let error;
    try {
      error = JSON.parse(errorText);
    } catch {
      error = { error: errorText || 'Failed to register subscription' };
    }
    
    throw new Error(error.error || 'Failed to register subscription');
  }

  const data = await response.json();
  console.log('Server response data:', { success: data.success, hasId: !!data.data?.id });
  
  if (!data.success || !data.data?.id) {
    console.error('Invalid subscription response:', data);
    throw new Error('Invalid subscription response');
  }

  return data.data.id;
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  // Unsubscribe from server first
  const authToken = localStorage.getItem('authToken');
  const headers: HeadersInit = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  const response = await fetch(
    `/api/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok && response.status !== 404) {
    // 404 is okay - subscription might already be deleted
    if (response.status === 503) {
      throw new Error('Push notifications are disabled');
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to unsubscribe');
  }

  // Unsubscribe from PushManager
  try {
    // Add timeout to prevent hanging
    const SW_READY_TIMEOUT_MS = 5000;
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) => {
      setTimeout(() => reject(new Error('Service worker ready timeout')), SW_READY_TIMEOUT_MS);
    });

    const registration = await Promise.race([readyPromise, timeoutPromise]);
    const subscription = await registration.pushManager.getSubscription();
    if (subscription && subscription.endpoint === endpoint) {
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Failed to unsubscribe from PushManager:', error);
    // Don't throw - server unsubscribe succeeded
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // First check if there's a service worker registered at all
    const existingRegistration = await navigator.serviceWorker.getRegistration('/');
    if (!existingRegistration) {
      // No service worker registered yet - that's fine, just return null
      return null;
    }

    // If there's a registration, check for push subscription
    if (existingRegistration.active) {
      return await existingRegistration.pushManager.getSubscription();
    }

    // SW is registered but not active yet - wait briefly
    const SW_READY_TIMEOUT_MS = 3000;
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) => {
      setTimeout(() => reject(new Error('Service worker ready timeout')), SW_READY_TIMEOUT_MS);
    });

    const registration = await Promise.race([readyPromise, timeoutPromise]);
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('Failed to get current subscription:', error);
    return null;
  }
}

/**
 * Check subscription status (both client and server)
 */
export async function checkSubscriptionStatus(): Promise<{
  isSubscribed: boolean;
  isRegisteredOnServer: boolean;
  subscriptionId?: string;
}> {
  const subscription = await getCurrentSubscription();

  if (!subscription) {
    return {
      isSubscribed: false,
      isRegisteredOnServer: false,
    };
  }

  // Check if registered on server
  try {
    const authToken = localStorage.getItem('authToken');
    const headers: HeadersInit = authToken
      ? { Authorization: `Bearer ${authToken}` }
      : {};

    const response = await fetch('/api/notifications/subscriptions', {
      headers,
    });

    if (!response.ok) {
      if (response.status === 503) {
        return {
          isSubscribed: true,
          isRegisteredOnServer: false,
        };
      }
      return {
        isSubscribed: true,
        isRegisteredOnServer: false,
      };
    }

    const data = await response.json();
    if (data.success && Array.isArray(data.data)) {
      const serverSubscription = data.data.find(
        (sub: any) => sub.endpoint === subscription.endpoint
      );
      return {
        isSubscribed: true,
        isRegisteredOnServer: !!serverSubscription,
        subscriptionId: serverSubscription?.id,
      };
    }
  } catch (error) {
    console.error('Failed to check server subscription:', error);
  }

  return {
    isSubscribed: true,
    isRegisteredOnServer: false,
  };
}

/**
 * Helper: Convert VAPID key from base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  if (!base64String || typeof base64String !== 'string') {
    throw new Error('Invalid VAPID key: must be a non-empty string');
  }

  try {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    // VAPID public key should be 65 bytes (uncompressed) or 87 characters in base64
    if (outputArray.length !== 65) {
      console.warn(`VAPID key length is ${outputArray.length} bytes, expected 65. This may cause issues.`);
    }
    
    return outputArray;
  } catch (error: any) {
    console.error('Error converting VAPID key:', error);
    throw new Error(`Failed to convert VAPID key: ${error?.message || 'Invalid base64 format'}`);
  }
}

/**
 * Helper: Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) {
    throw new Error('Buffer is null');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Helper: Generate device label from user agent
 */
function getDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Mobile')) {
    if (ua.includes('Android')) return 'Android Device';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Device';
    return 'Mobile Device';
  }
  if (ua.includes('Mac')) return 'Mac';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Linux')) return 'Linux';
  return 'Device';
}
