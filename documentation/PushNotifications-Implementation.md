# Push Notifications Implementation Status

## Overview

This document outlines the current implementation status of the push notification system for Sprout Track. The system enables users to subscribe to push notifications for baby activity events (new records created) and timer expirations (feed/diaper thresholds exceeded).

**Implementation Status:** Phases 0-13 Complete, plus Code Review enhancements (January 2026)

---

## Table of Contents

1. [Completed Features](#completed-features)
2. [Database Schema](#database-schema)
3. [Environment Variables](#environment-variables)
4. [API Endpoints](#api-endpoints)
5. [Client-Side Implementation](#client-side-implementation)
6. [UI Components](#ui-components)
7. [Files Created/Modified](#files-createdmodified)
8. [Setup Instructions](#setup-instructions)
9. [Testing](#testing)
10. [Known Issues](#known-issues)
11. [Remaining Work](#remaining-work)

---

## Completed Features

### Phase 0: Dependencies
- ✅ Added `web-push` package (v3.6.7) for Web Push protocol encryption
- ✅ Added `@types/web-push` (v3.6.4) for TypeScript support
- ✅ Added `setup:vapid` npm script for VAPID key generation

### Phase 1: Database Schema
- ✅ Created `NotificationEventType` enum (`ACTIVITY_CREATED`, `FEED_TIMER_EXPIRED`, `DIAPER_TIMER_EXPIRED`)
- ✅ Created `PushSubscription` model with all required fields
- ✅ Created `NotificationPreference` model for per-baby, per-device preferences
- ✅ Created `NotificationLog` model for debugging and failure tracking
- ✅ Added reverse relations to `Account`, `Caretaker`, `Family`, and `Baby` models
- ✅ Applied Prisma migration (`add_push_notifications`)

### Phase 2: Environment Variables & Setup
- ✅ Created `scripts/setup-vapid-keys.ts` for VAPID key generation
- ✅ Updated `scripts/env-update.sh` to automatically generate VAPID keys
- ✅ Added `ENABLE_NOTIFICATIONS` feature flag
- ✅ Created `.env.sample` with all notification-related variables
- ✅ Integrated VAPID key generation into setup workflow

### Phase 3: Core Push Utility
- ✅ Created `src/lib/notifications/push.ts` with:
  - `initializeWebPush()` - VAPID credential initialization
  - `sendNotification()` - Core notification sending with encryption
  - `sendNotificationWithLogging()` - Wrapper with database logging
  - Automatic handling of 410 Gone responses (expired subscriptions)
  - Failure count tracking and success timestamp updates

### Phase 4: API Routes
- ✅ `/api/notifications/vapid-key` (GET) - Returns public VAPID key
- ✅ `/api/notifications/subscribe` (POST, DELETE) - Subscribe/unsubscribe
- ✅ `/api/notifications/preferences` (GET, PUT) - Manage notification preferences
- ✅ `/api/notifications/subscriptions` (GET) - List all user devices
- ✅ `/api/notifications/subscriptions/[id]` (DELETE) - Remove specific device
- ✅ `/api/notifications/cron` (POST) - Cron trigger endpoint (protected by secret)
- ✅ All routes include `ENABLE_NOTIFICATIONS` feature flag check
- ✅ All routes return 503 when notifications are disabled

### Phase 5: Service Worker
- ✅ Created `public/sw.js` with:
  - `push` event listener for receiving notifications
  - `notificationclick` event handler for deep-linking
  - `notificationclose` event handler
  - `message` event handler for `SKIP_WAITING` command
  - Proper notification display with icons and badges

### Phase 6: Client-Side Subscription Manager
- ✅ Created `src/lib/notifications/client.ts` with:
  - `checkPushSupport()` - Browser compatibility check
  - `requestNotificationPermission()` - Permission request
  - `getVapidPublicKey()` - Fetch VAPID key with caching
  - `registerServiceWorker()` - Service worker registration with state handling
  - `subscribeToPush()` - Push subscription creation
  - `sendSubscriptionToServer()` - Server registration
  - `unsubscribeFromPush()` - Unsubscribe from both client and server
  - `getCurrentSubscription()` - Get browser subscription
  - `checkSubscriptionStatus()` - Check client and server status
  - Helper functions for key conversion and device labeling
  - Comprehensive error handling and logging

### Phase 7: Activity Hook & UI Integration
- ✅ Created `src/lib/notifications/activityHook.ts` with:
  - `notifyActivityCreated()` - Trigger notifications on activity creation
  - `resetTimerNotificationState()` - Reset timer state when activities logged
  - Integration with all activity log API routes
- ✅ Updated activity log routes to trigger notifications:
  - `app/api/feed-log/route.ts`
  - `app/api/diaper-log/route.ts`
  - `app/api/sleep-log/route.ts`
  - `app/api/bath-log/route.ts`
  - `app/api/medicine-log/route.ts`
  - `app/api/pump-log/route.ts`
- ✅ Created `src/components/forms/SettingsForm/NotificationSettings.tsx`:
  - Enable/disable notifications button
  - Device list with details (label, last success/failure, failure count)
  - Per-baby notification preferences (event types, intervals)
  - Remove device functionality
  - Full localization support
- ✅ Integrated notification settings into main Settings form
- ✅ Updated `app/api/deployment-config/route.ts` to expose `notificationsEnabled` flag
- ✅ Added comprehensive translation keys to `src/localization/translations/en.json`

### Phase 8: Timer Check Utility
- ✅ Created `src/lib/notifications/timerCheck.ts` with:
  - `checkTimerExpirations()` - Main entry point for timer expiration checks
  - `parseWarningTime()` - Parse "HH:mm" format to minutes
  - `getLastActivityTime()` - Query most recent feed/diaper activity
  - `isNotificationEligible()` - Check notification eligibility logic
  - `sendTimerNotification()` - Send timer expiration notifications
  - Queries enabled timer preferences (FEED_TIMER_EXPIRED, DIAPER_TIMER_EXPIRED)
  - Groups preferences by baby and event type
  - Checks last activity time against baby's threshold (feedWarningTime/diaperWarningTime)
  - Handles repeat interval logic (first notification vs. repeat intervals)
  - Updates `lastTimerNotifiedAt` after sending notifications

### Phase 9: Cron Setup Script
- ✅ Created `scripts/setup-notification-cron.ts`:
  - Checks if cron job exists in crontab (by unique comment marker)
  - Installs cron entry that runs every minute
  - Verifies cron service is running
  - Idempotent - safe to run multiple times
  - Handles missing crontab gracefully
  - Makes cron script executable
- ✅ Created `scripts/run-notification-cron.sh`:
  - Shell script called by cron every minute
  - Uses curl to POST to `/api/notifications/cron` endpoint
  - Includes `Authorization: Bearer $NOTIFICATION_CRON_SECRET` header
  - Loads environment variables from `.env` file
  - Handles errors gracefully with appropriate exit codes
  - Silent on success, logs errors to stderr
- ✅ Added npm scripts:
  - `notification:cron:setup` - Run cron setup script
  - `notification:cron:run` - Manually run cron check

### Phase 10: Cleanup Utility
- ✅ Created `src/lib/notifications/cleanup.ts` with:
  - `cleanupFailedSubscriptions()` - Delete subscriptions with failureCount >= 5
  - `cleanupOldNotificationLogs()` - Delete logs older than retention period
  - `runCleanup()` - Main entry point that runs both cleanup functions
  - Configurable log retention via `NOTIFICATION_LOG_RETENTION_DAYS` (default: 30 days)
  - Uses batch deletion for efficiency
  - Comprehensive error handling and logging
- ✅ Integrated cleanup into cron API endpoint

---

## Database Schema

### Models

#### PushSubscription
Stores VAPID subscription data per device, linked to Account, Caretaker, or Family.

**Key Fields:**
- `id` (cuid)
- `endpoint` (unique) - VAPID endpoint URL
- `p256dh` - Browser public key for encryption
- `auth` - Auth secret for encryption
- `deviceLabel` - User-friendly device name
- `failureCount` - Tracks consecutive delivery failures
- `lastFailureAt`, `lastSuccessAt` - Timestamps

#### NotificationPreference
User preferences for what notifications to receive, per subscription and per baby.

**Key Fields:**
- `subscriptionId` - Link to PushSubscription
- `babyId` - Which baby this preference applies to
- `eventType` - NotificationEventType enum
- `activityTypes` - JSON array of activity types (null = all)
- `timerIntervalMinutes` - Minutes between repeat notifications
- `lastTimerNotifiedAt` - When last timer notification was sent
- `enabled` - On/off toggle

**Unique Constraint:** `subscriptionId + babyId + eventType`

#### NotificationLog
Logging for debugging and failure tracking.

**Key Fields:**
- `subscriptionId` - Link to PushSubscription
- `eventType` - Which event triggered this
- `activityType` - Specific activity type (for ACTIVITY_CREATED)
- `babyId` - Which baby
- `success` - Delivery success/failure
- `errorMessage` - Error details if failed
- `httpStatus` - HTTP response code
- `payload` - JSON of notification content sent

---

## Environment Variables

### Required Variables

```bash
# Feature flag - enables/disables all notification functionality
ENABLE_NOTIFICATIONS=true

# VAPID keys (auto-generated by setup script)
VAPID_PUBLIC_KEY=<base64-url-encoded-public-key>
VAPID_PRIVATE_KEY=<base64-url-encoded-private-key>
VAPID_SUBJECT=mailto:notifications@sprouttrack.app

# Optional: Secret for securing cron endpoint
NOTIFICATION_CRON_SECRET=<random-secret-string>
```

### Setup

VAPID keys are automatically generated during setup via `scripts/env-update.sh`, which calls `npm run setup:vapid`. The setup script:
1. Checks if VAPID keys exist in `.env`
2. If missing or empty, generates new keypair using `web-push`
3. Updates `.env` file with generated keys

---

## API Endpoints

### Public Endpoints

#### GET `/api/notifications/vapid-key`
Returns the public VAPID key for client-side subscription.
- **Auth:** Not required (public key is safe to expose)
- **Response:** `{ success: true, data: { publicKey: string } }`
- **Status:** Returns 503 if `ENABLE_NOTIFICATIONS !== 'true'`

### Authenticated Endpoints

#### POST `/api/notifications/subscribe`
Register a new push subscription.
- **Auth:** Required (Bearer token)
- **Body:**
  ```json
  {
    "endpoint": "https://...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    },
    "deviceLabel": "Desktop Device",
    "userAgent": "..."
  }
  ```
- **Response:** `{ success: true, data: { id: string } }`

#### DELETE `/api/notifications/subscribe?endpoint=...`
Remove subscription by endpoint.
- **Auth:** Required
- **Response:** `{ success: true }`

#### GET `/api/notifications/subscriptions`
List all devices for current user.
- **Auth:** Required
- **Response:** `{ success: true, data: PushSubscription[] }`

#### DELETE `/api/notifications/subscriptions/[id]`
Remove a specific device by ID.
- **Auth:** Required
- **Response:** `{ success: true }`

#### GET `/api/notifications/preferences`
Get all notification preferences for current user.
- **Auth:** Required
- **Response:** `{ success: true, data: NotificationPreference[] }`

#### PUT `/api/notifications/preferences`
Update notification preferences.
- **Auth:** Required
- **Body:**
  ```json
  {
    "subscriptionId": "...",
    "babyId": "...",
    "eventType": "ACTIVITY_CREATED",
    "activityTypes": ["FEED", "DIAPER"],
    "timerIntervalMinutes": 30,
    "enabled": true
  }
  ```
- **Response:** `{ success: true, data: NotificationPreference }`

#### POST `/api/notifications/cron`
Trigger timer check (protected by `NOTIFICATION_CRON_SECRET`).
- **Auth:** `Authorization: Bearer <NOTIFICATION_CRON_SECRET>`
- **Response:** `{ success: true, data: { notificationsSent: number, subscriptionsCleaned: number, logsCleaned: number } }`
- **Status:** Fully implemented - checks timer expirations and runs cleanup

---

## Client-Side Implementation

### Core Functions (`src/lib/notifications/client.ts`)

#### Browser Support & Permissions
- `checkPushSupport()` - Checks if browser supports push notifications
- `requestNotificationPermission()` - Requests notification permission from user

#### Service Worker Management
- `registerServiceWorker()` - Registers `/sw.js` with proper state handling
  - Waits for service worker to activate
  - Handles installing/waiting/active states
  - Supports `SKIP_WAITING` for updates

#### Subscription Management
- `getVapidPublicKey()` - Fetches and caches VAPID public key
- `subscribeToPush(publicKey)` - Creates browser push subscription
  - Validates VAPID key format
  - Ensures service worker is active
  - Comprehensive error handling
- `sendSubscriptionToServer()` - Registers subscription with backend
- `unsubscribeFromPush()` - Removes subscription from browser and server
- `getCurrentSubscription()` - Gets current browser subscription
- `checkSubscriptionStatus()` - Checks both client and server status

### Service Worker (`public/sw.js`)

Handles:
- **Push Events:** Receives encrypted payloads and displays notifications
- **Notification Clicks:** Deep-links to app or opens new window
- **Service Worker Updates:** Responds to `SKIP_WAITING` messages

---

## UI Components

### NotificationSettings Component

**Location:** `src/components/forms/SettingsForm/NotificationSettings.tsx`

**Features:**
1. **Enable Notifications Button**
   - Checks browser support
   - Requests permission
   - Registers service worker
   - Creates push subscription
   - Sends to server

2. **Device Management**
   - Lists all registered devices
   - Shows device label, user agent
   - Displays last success/failure timestamps
   - Shows failure count
   - Remove device button

3. **Per-Baby Preferences**
   - Toggle switches for each event type:
     - Activity Created
     - Feed Timer Expired
     - Diaper Timer Expired
   - Activity type filters (for ACTIVITY_CREATED)
   - Repeat interval selectors (for timer events)
   - Per-baby configuration

**Integration:**
- Conditionally rendered in `SettingsForm` based on `deploymentConfig.notificationsEnabled`
- Positioned after "Default Units" section
- Uses existing Shadcn/UI components for consistency
- Fully localized with translation keys

---

## Files Created/Modified

### New Files

#### Backend
- `src/lib/notifications/push.ts` - Core push notification utility
- `src/lib/notifications/client.ts` - Client-side subscription manager
- `src/lib/notifications/activityHook.ts` - Activity event hooks
- `src/lib/notifications/timerCheck.ts` - Timer expiration detection and notification
- `src/lib/notifications/cleanup.ts` - Subscription and log cleanup utilities
- `app/api/notifications/vapid-key/route.ts` - VAPID key endpoint
- `app/api/notifications/subscribe/route.ts` - Subscribe/unsubscribe
- `app/api/notifications/preferences/route.ts` - Preferences management
- `app/api/notifications/subscriptions/route.ts` - List subscriptions
- `app/api/notifications/subscriptions/[id]/route.ts` - Delete subscription
- `app/api/notifications/cron/route.ts` - Cron trigger endpoint
- `scripts/setup-vapid-keys.ts` - VAPID key generation script
- `scripts/setup-notification-cron.ts` - Cron job setup script
- `scripts/run-notification-cron.sh` - Cron runner shell script

#### Frontend
- `public/sw.js` - Service worker
- `src/components/forms/SettingsForm/NotificationSettings.tsx` - Settings UI

#### Documentation
- `.env.sample` - Environment variable template

### Modified Files

#### Backend
- `prisma/schema.prisma` - Added notification models and enum
- `package.json` - Added `web-push` dependency, `setup:vapid` script, and cron scripts
- `scripts/env-update.sh` - Added VAPID key generation
- `app/api/deployment-config/route.ts` - Added `notificationsEnabled` flag
- `app/api/feed-log/route.ts` - Added notification triggers
- `app/api/diaper-log/route.ts` - Added notification triggers
- `app/api/sleep-log/route.ts` - Added notification triggers
- `app/api/bath-log/route.ts` - Added notification triggers
- `app/api/medicine-log/route.ts` - Added notification triggers
- `app/api/pump-log/route.ts` - Added notification triggers
- `app/api/notifications/cron/route.ts` - Integrated timer check and cleanup utilities

#### Frontend
- `src/components/forms/SettingsForm/index.tsx` - Integrated NotificationSettings
- `src/localization/translations/en.json` - Added notification translation keys

---

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate VAPID Keys

VAPID keys are automatically generated during setup via `scripts/env-update.sh`. To generate manually:

```bash
npm run setup:vapid
```

This will:
- Check if VAPID keys exist in `.env`
- Generate new keypair if missing
- Update `.env` with the keys

### 3. Configure Environment Variables

Add to your `.env` file:

```bash
ENABLE_NOTIFICATIONS=true
VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:notifications@sprouttrack.app
NOTIFICATION_CRON_SECRET=<random-secret-string>
NOTIFICATION_LOG_RETENTION_DAYS=30  # Optional, default: 30
APP_URL=http://localhost:3000  # Or use ROOT_DOMAIN
```

### 4. Run Database Migration

```bash
npm run prisma:migrate
```

### 5. Start the Application

```bash
npm run dev
```

### 6. Setup Cron Job (Optional but Recommended)

To enable timer expiration notifications, set up the cron job:

```bash
npm run notification:cron:setup
```

This will:
- Install a cron job that runs every minute
- Check for expired feed/diaper timers
- Send notifications to eligible subscriptions
- Clean up failed subscriptions and old logs

**Note:** The cron job requires:
- `NOTIFICATION_CRON_SECRET` to be set in `.env`
- `APP_URL` or `ROOT_DOMAIN` to be set for API calls
- Cron service to be running on the system

### 7. Enable Notifications in UI

1. Navigate to Settings
2. Scroll to "Push Notifications" section
3. Click "Enable Notifications"
4. Grant browser permission
5. Configure preferences per baby

---

## Testing

### Manual Testing Checklist

#### Setup
- [ ] VAPID keys are generated automatically
- [ ] Environment variables are set correctly
- [ ] Database migration applied successfully

#### Browser Support
- [ ] Chrome/Edge: Full support
- [ ] Firefox: Full support
- [ ] Safari: Limited support (requires macOS/iOS)
- [ ] Mobile browsers: Test on actual devices

#### Subscription Flow
- [ ] Enable notifications button works
- [ ] Permission prompt appears
- [ ] Service worker registers successfully
- [ ] Push subscription created
- [ ] Subscription saved to database
- [ ] Device appears in device list

#### Notification Preferences
- [ ] Can toggle event types per baby
- [ ] Can select activity types for ACTIVITY_CREATED
- [ ] Can set repeat intervals for timer events
- [ ] Preferences saved correctly

#### Activity Notifications
- [ ] Feed log creates notification
- [ ] Diaper log creates notification
- [ ] Sleep log creates notification
- [ ] Bath log creates notification
- [ ] Medicine log creates notification
- [ ] Pump log creates notification
- [ ] Notification appears in browser
- [ ] Notification click opens app

#### Device Management
- [ ] Can view all registered devices
- [ ] Can remove devices
- [ ] Removed devices are unsubscribed

#### Error Handling
- [ ] Feature flag (ENABLE_NOTIFICATIONS=false) hides UI
- [ ] Feature flag disables all API endpoints (503)
- [ ] Invalid VAPID keys show error
- [ ] Permission denied shows error
- [ ] Browser not supported shows error

### Debugging

#### Client-Side Logging
All client-side functions include comprehensive console logging. Check browser console for:
- Service worker registration steps
- VAPID key retrieval
- Push subscription creation
- Server communication

#### Server-Side Logging
All API routes log:
- Request processing
- Database operations
- Errors with stack traces

#### Service Worker
Check browser DevTools > Application > Service Workers for:
- Registration status
- Activation state
- Update status

---

## Known Issues

### Current Limitations

1. **Service Worker Updates**
   - Service worker updates require manual refresh
   - `SKIP_WAITING` handler is implemented but may need refinement

2. **Cron Job Setup**
   - Cron job must be manually set up using `npm run notification:cron:setup`
   - In Docker environments, cron may need special configuration
   - Cron service must be running for timer notifications to work

### Resolved Issues (January 2026 Code Review)

1. **Localization** - ✅ RESOLVED
   - Notification payloads now support full i18n
   - Translations available in English, Spanish, and French
   - Uses user's language preference from Account/Caretaker

2. **Security** - ✅ ENHANCED
   - Timing-safe secret comparison in cron endpoint
   - Auto-generated NOTIFICATION_CRON_SECRET during setup
   - Input validation for endpoints and preferences

3. **Reliability** - ✅ IMPROVED
   - Race condition fix in timer notification state updates
   - Service worker activation timeout (30 seconds)
   - VAPID key cache with TTL (30 minutes)

### Browser Compatibility

- **Chrome/Edge:** Full support ✅
- **Firefox:** Full support ✅
- **Safari:** Limited support (macOS 10.16+, iOS 16.4+) ⚠️
- **Opera:** Full support ✅
- **Mobile:** Requires HTTPS in production ⚠️

### HTTPS Requirement

Push notifications require HTTPS in production. Localhost is exempt for development, but production deployments must use HTTPS.

---

## Architecture Notes

### Feature Flag Pattern

The `ENABLE_NOTIFICATIONS` environment variable acts as a master switch:
- When `false`, all notification APIs return 503
- UI component is hidden when `notificationsEnabled === false`
- Client-side functions check the flag before making API calls

### Subscription Lifecycle

1. **Registration:** User clicks "Enable Notifications"
2. **Permission:** Browser requests notification permission
3. **Service Worker:** Registers `/sw.js`
4. **Subscription:** Creates browser PushSubscription
5. **Server Registration:** Sends subscription to backend
6. **Preferences:** User configures per-baby preferences
7. **Notifications:** Server sends notifications based on preferences
8. **Cleanup:** Failed subscriptions are tracked and can be removed

### Error Handling

- **Client-Side:** All errors are caught and displayed via toast notifications
- **Server-Side:** All errors are logged with stack traces
- **Database:** Failed subscriptions increment `failureCount`
- **410 Gone:** Expired subscriptions are automatically deleted

### Security

- VAPID keys provide authentication and encryption
- All API endpoints require authentication (except VAPID key endpoint)
- Cron endpoint protected by `NOTIFICATION_CRON_SECRET`
- Subscription endpoints verify family ownership

---

## Remaining Work

### Phase 11: UI Components
- ✅ Completed in Phase 7

### Phase 12: Docker Integration
- Update Dockerfile/entrypoint to run cron setup on start
- Ensure cron service runs in Docker container
- Handle cron in containerized environments

### Phase 13: Testing & Documentation
- Comprehensive testing of timer notifications
- Test cron job execution in various environments
- Document Docker deployment with cron
- Performance testing for large numbers of subscriptions

---

## Related Documentation

- [PushNotificationPlan.md](./PushNotificationPlan.md) - Original implementation plan
- [.env.sample](../.env.sample) - Environment variable template
- [Prisma Schema](../prisma/schema.prisma) - Database schema

---

## Support

For issues or questions:
1. Check browser console for client-side errors
2. Check server logs for API errors
3. Verify environment variables are set correctly
4. Ensure database migration has been applied
5. Test in different browsers to rule out compatibility issues
