# PWA and Notifications

## Overview

Sprout Track is a Progressive Web App with push notification support, Wake Lock API integration, and a dedicated nursery mode designed for wall-mounted tablets. The PWA architecture enables offline-capable, app-like behavior on mobile and desktop browsers.

## Service Worker

**File:** `public/sw.js`

The service worker handles push notification display and click behavior. It is minimal — focused on notifications rather than offline caching.

### Push Event Handling
When a push notification arrives:
1. Parses the notification payload (title, body, icon, badge, data)
2. Displays the notification using `self.registration.showNotification()`
3. Supports custom icons and badge images

### Notification Click Handling
When a user clicks a notification:
1. Closes the notification
2. Checks if the app is already open in a tab
3. If open: focuses that tab and navigates to the relevant page
4. If not open: opens a new window to the app

### Service Worker Updates
Supports `skip-waiting` for immediate activation of updated service workers.

## Push Notification Architecture

### VAPID Key Management
- Keys generated via `POST /api/notifications/generate-vapid` or `npm run setup:vapid`
- Stored in `NotificationConfig` table
- Private key encrypted with AES-256-GCM before storage
- Public key served via `GET /api/notifications/vapid-key`

### Subscription Flow

```
1. Client requests VAPID public key
   GET /api/notifications/vapid-key → { vapidPublicKey }

2. Browser subscribes to push service
   PushManager.subscribe({ applicationServerKey: vapidPublicKey })

3. Client sends subscription to server
   POST /api/notifications/subscribe
   Body: { endpoint, keys: { p256dh, auth }, deviceLabel? }

4. Server stores PushSubscription record
   Fields: endpoint, p256dh, auth, familyId, caretakerId/accountId
```

### Notification Preferences
Granular control per subscription, per baby, per event type:

```
NotificationPreference {
  subscriptionId     → Which device/browser
  babyId             → Which baby
  eventType          → ACTIVITY_CREATED | FEED_TIMER_EXPIRED | DIAPER_TIMER_EXPIRED | MEDICINE_TIMER_EXPIRED
  activityTypes      → JSON array of specific activity types (null = all)
  timerIntervalMinutes → Minutes between repeat timer notifications
  enabled            → On/off toggle
}
```

**API:** `GET/PUT /api/notifications/preferences`

### Sending Notifications

#### Activity-Triggered
**File:** `src/lib/notifications/activityHook.ts`

After an activity log is created (feed, diaper, sleep, etc.), the system:
1. Queries `NotificationPreference` for subscriptions wanting `ACTIVITY_CREATED` for this baby and activity type
2. Builds notification payload (title, body with activity details)
3. Sends via Web Push API to each matching subscription
4. Logs results to `NotificationLog`

#### Timer-Based (Cron)
**File:** `src/lib/notifications/timerCheck.ts`
**Endpoint:** `POST /api/notifications/cron` (protected by `NOTIFICATION_CRON_SECRET`)

Runs on a schedule (via Docker dcron) to check for overdue timers:

| Timer Type | Source | Threshold |
|------------|--------|-----------|
| Feed timer | Last `FeedLog.time` | `Baby.feedWarningTime` (default "03:00") |
| Diaper timer | Last `DiaperLog.time` | `Baby.diaperWarningTime` (default "02:00") |
| Medicine timer | Last `MedicineLog.time` | `Medicine.doseMinTime` |

For each expired timer:
1. Finds subscriptions with matching `NotificationPreference` (event type + baby)
2. Checks `timerIntervalMinutes` to avoid notification spam
3. Sends push notification
4. Updates `lastTimerNotifiedAt`

### Failure Handling
- `PushSubscription.failureCount` increments on send failure
- `lastFailureAt` and `lastSuccessAt` tracked per subscription
- Subscriptions with repeated failures can be auto-cleaned

### Notification Logging
- `NotificationLog` records every send attempt
- Fields: subscriptionId, eventType, activityType, babyId, success, errorMessage, httpStatus, payload
- Retention controlled by `NotificationConfig.logRetentionDays` (default 30)
- Cleanup handled by `src/lib/notifications/cleanup.ts`

### Internationalization
**File:** `src/lib/notifications/i18n.ts`

Notification content is translated based on the subscriber's language preference. Activity names and timer messages are localized.

## Wake Lock API

**File:** `src/hooks/useWakeLock.ts`

Prevents the device screen from sleeping. Critical for nursery mode where a tablet displays activity tiles all day.

- Auto-acquires wake lock on component mount
- Re-acquires when page becomes visible again (after tab switch)
- Gracefully handles browsers that don't support the API
- Provides `isActive` and `isSupported` status

## Fullscreen API

**File:** `src/hooks/useFullscreen.ts`

Enables immersive fullscreen display. Used in nursery mode for a distraction-free tablet experience.

- Cross-browser support (webkit, moz, ms prefixes)
- `toggle()` function for one-button fullscreen control
- Listens to all vendor-prefixed fullscreen change events

## Nursery Mode

**Route:** `app/(nursery)/[slug]/nursery-mode/`

A dedicated, simplified interface designed for wall-mounted tablets in daycare/nursery settings.

### Design
- Separate route group with its own layout (no main app navigation)
- Large activity tiles for quick one-tap logging
- Configurable color palette (hue, brightness, saturation) via `useNurseryColors`
- Configurable visible tiles via `useNurserySettings`
- Uses Wake Lock to keep screen on
- Optional fullscreen mode

### Settings
Stored as JSON in `Settings.nurseryModeSettings`, managed via `useNurserySettings` hook:

```typescript
{
  hue: 230,           // Color hue (0-360)
  brightness: 15,     // Brightness (0-100, <50 = dark)
  saturation: 25,     // Color saturation (0-100)
  visibleTiles: ['feed', 'pump', 'diaper', 'sleep']
}
```

### Color System
The `useNurseryColors` hook generates a complete HSLA color palette from the settings:
- 16 computed colors: text, subtext, border, tileBg, btnBg, accent, etc.
- Brightness below 50% activates dark palette, above 50% activates light palette
- All colors derived from the single hue value for visual harmony

## Docker Notification Setup

Push notifications are enabled via Docker build arg:

```dockerfile
ARG ENABLE_NOTIFICATIONS=false
```

When enabled:
- `dcron` is installed for cron job scheduling
- VAPID keys are generated if not present
- Cron job configured to call `/api/notifications/cron` at the specified interval
- `NOTIFICATION_CRON_SECRET` env var secures the cron endpoint

**Environment variables:**
- `ENABLE_NOTIFICATIONS` — Feature flag
- `NOTIFICATION_CRON_SECRET` — Cron endpoint auth
- `NOTIFICATION_LOG_RETENTION_DAYS` — Log cleanup threshold

## Key Files

- `public/sw.js` — Service worker (push events, notification clicks)
- `src/lib/notifications/push.ts` — Push notification sending
- `src/lib/notifications/activityHook.ts` — Activity-triggered notifications
- `src/lib/notifications/timerCheck.ts` — Timer expiration checks
- `src/lib/notifications/config.ts` — VAPID key management
- `src/lib/notifications/client.ts` — Client-side notification API
- `src/lib/notifications/i18n.ts` — Notification translations
- `src/lib/notifications/cleanup.ts` — Log retention cleanup
- `src/hooks/useWakeLock.ts` — Wake Lock API hook
- `src/hooks/useFullscreen.ts` — Fullscreen API hook
- `src/hooks/useNurserySettings.ts` — Nursery settings management
- `src/hooks/useNurseryColors.ts` — Nursery color palette generation
- `app/api/notifications/` — All notification API routes
- `app/(nursery)/[slug]/nursery-mode/` — Nursery mode page
