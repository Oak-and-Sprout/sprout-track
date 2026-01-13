// Service Worker for Push Notifications
// Handles push events and notification clicks

// Handle skip waiting message (for service worker updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Listen for push events
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  
  const options = {
    title: payload.title || 'Sprout Track',
    body: payload.body || '',
    icon: payload.icon || '/sprout-128.png',
    badge: payload.badge || '/sprout-128.png',
    tag: payload.tag || 'default',
    data: payload.data || {},
    requireInteraction: false,
    silent: false,
  };
  
  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Future: Navigate to URL from data.payload.url
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  } else {
    // Default: Focus or open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If a window is already open on the same origin, focus it
        // Use URL parsing to match any path on the same origin, not just '/'
        const appOrigin = self.location.origin;
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          try {
            const clientUrl = new URL(client.url);
            // Focus any window from our app origin
            if (clientUrl.origin === appOrigin && 'focus' in client) {
              return client.focus();
            }
          } catch (e) {
            // URL parsing failed, skip this client
            console.warn('Failed to parse client URL:', client.url);
          }
        }
        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  // Could log analytics here if needed
  console.log('Notification closed:', event.notification.tag);
});
