# Push Notifications Project Plan

## Overview

Enable users to subscribe to push notifications for baby activity events (new records created) and timer expirations (feed/diaper thresholds exceeded). Subscriptions are per-baby, per-device, and available to Accounts, Caretakers, and family system logins.

---

## Table of Contents

1. [Dependencies](#dependencies)
2. [Schema Additions](#schema-additions)
3. [Environment Variables](#environment-variables)
4. [Component Architecture](#component-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [Implementation Order](#implementation-order)
7. [Additional Considerations](#additional-considerations)

---

## Dependencies

Add `web-push` package for handling Web Push protocol encryption and VAPID authentication. This library handles the cryptographic complexity of the Web Push standard (RFC 8030, 8291, 8292) including ECDH key exchange, AES-128-GCM encryption, and JWT signing for VAPID.

---

## Schema Additions

### New Models

#### PushSubscription

Stores VAPID subscription data per device. Links to Account, Caretaker, or Family depending on authentication type. Uses `cuid()` for ID generation to match existing Account/Family patterns.

**Fields:**
- `id` - Primary key (cuid)
- `accountId` - Optional link to Account (for account-authenticated users)
- `caretakerId` - Optional link to Caretaker (for PIN-authenticated users)
- `familyId` - Always set for family context
- `endpoint` - VAPID endpoint URL (unique)
- `p256dh` - Browser public key for encryption
- `auth` - Auth secret for encryption
- `deviceLabel` - Optional user-friendly device name
- `userAgent` - For debugging
- `failureCount` - Tracks consecutive delivery failures
- `lastFailureAt` - Timestamp of last failure
- `lastSuccessAt` - Timestamp of last success
- `createdAt`, `updatedAt` - Standard timestamps

**Relations:** Account, Caretaker, Family, NotificationPreference[], NotificationLog[]

**Indexes:** accountId, caretakerId, familyId, endpoint, failureCount

---

#### NotificationPreference

User preferences for what notifications to receive, per subscription and per baby.

**Fields:**
- `id` - Primary key (cuid)
- `subscriptionId` - Link to PushSubscription
- `babyId` - Which baby this preference applies to
- `eventType` - NotificationEventType enum value
- `activityTypes` - JSON string array of activity types (null = all)
- `timerIntervalMinutes` - Minutes between repeat notifications (null = once per expiration)
- `lastTimerNotifiedAt` - When last timer notification was sent
- `enabled` - On/off toggle
- `createdAt`, `updatedAt` - Standard timestamps

**Relations:** PushSubscription, Baby

**Unique constraint:** subscriptionId + babyId + eventType

**Indexes:** subscriptionId, babyId, eventType, enabled

---

#### NotificationEventType Enum

- `ACTIVITY_CREATED` - Any activity logged
- `FEED_TIMER_EXPIRED` - No feed within baby's feedWarningTime
- `DIAPER_TIMER_EXPIRED` - No diaper within baby's diaperWarningTime

---

#### NotificationLog

Logging for debugging and failure tracking.

**Fields:**
- `id` - Primary key (cuid)
- `subscriptionId` - Link to PushSubscription
- `eventType` - Which event triggered this
- `activityType` - Specific activity type (for ACTIVITY_CREATED)
- `babyId` - Which baby
- `success` - Delivery success/failure
- `errorMessage` - Error details if failed
- `httpStatus` - HTTP response code
- `payload` - JSON of notification content sent
- `createdAt` - Timestamp

**Relations:** PushSubscription

**Indexes:** subscriptionId, createdAt, success

---

### Reverse Relations

Add `pushSubscriptions` relation array to: Account, Caretaker, Family

Add `notificationPreferences` relation array to: Baby

---

## Environment Variables

- `VAPID_PUBLIC_KEY` - Public key for VAPID (auto-generated during setup if not present)
- `VAPID_PRIVATE_KEY` - Private key for VAPID (auto-generated during setup if not present)
- `VAPID_SUBJECT` - Contact URI for VAPID (e.g., mailto:notifications@sprouttrack.app)
- `NOTIFICATION_CRON_SECRET` - Optional secret for securing the cron trigger endpoint

---

## Component Architecture

### 1. Setup Script Enhancement

**Location:** `/scripts/setup.ts` (or existing setup script)

**Responsibility:** VAPID key generation

- Check if VAPID keys exist in environment/config
- If not, generate new keypair using web-push library
- Output keys for user to add to `.env` (or write directly in self-hosted mode)

---

### 2. Push Notification Utility

**Location:** `/src/lib/notifications/push.ts`

**Responsibility:** Core push notification sending

- Initialize web-push with VAPID credentials
- Send notification to subscription endpoint with encrypted payload
- Handle 410 Gone response by deleting subscription immediately
- Handle other errors by incrementing failure count
- Reset failure count on success
- Log all send attempts to NotificationLog

---

### 3. Subscription Cleanup Utility

**Location:** `/src/lib/notifications/cleanup.ts`

**Responsibility:** Remove dead subscriptions

- Delete subscriptions where failureCount >= 5
- Delete NotificationLog entries older than 30 days (configurable)
- Called by cron script after processing notifications
- Also callable manually via admin endpoint if needed

---

### 4. Timer Check Utility

**Location:** `/src/lib/notifications/timerCheck.ts`

**Responsibility:** Detect and notify on expired timers

- Query all enabled NotificationPreference records for timer event types
- For each unique baby, check last activity time against baby's threshold
- Determine notification eligibility based on lastTimerNotifiedAt and timerIntervalMinutes
- Send notifications to eligible subscriptions
- Update lastTimerNotifiedAt for each notified preference

---

### 5. Activity Hook Utility

**Location:** `/src/lib/notifications/activityHook.ts`

**Responsibility:** Notify on activity creation, reset timer state

- `notifyActivityCreated()` - Called by API routes after successful activity creation, fans out to matching subscriptions
- `resetTimerNotificationState()` - Resets lastTimerNotifiedAt when relevant activity is logged (feed resets feed timer, diaper resets diaper timer)

---

### 6. Cron API Endpoint

**Location:** `/api/notifications/cron/route.ts`

**Responsibility:** Timer check execution triggered by cron

- POST endpoint protected by `NOTIFICATION_CRON_SECRET` header
- Calls timer check and cleanup utilities
- Returns JSON with results (notifications sent, subscriptions cleaned)
- Designed to be called via curl from system cron

---

### 7. Cron Setup Script

**Location:** `/scripts/setup-notification-cron.ts`

**Responsibility:** Install/verify system cron job for notification timer checks

**Behavior:**
- Check if the notification cron job already exists in crontab
- If not present, add a cron entry that runs every minute
- The cron job uses curl to POST to the cron API endpoint with the secret
- Works in both Docker and native Linux/macOS environments
- Idempotent - safe to run multiple times

**Cron Job Details:**
- Schedule: Every minute (`* * * * *`)
- Command: curl POST to `/api/notifications/cron` with `Authorization: Bearer $NOTIFICATION_CRON_SECRET`
- Uses the app's base URL from environment (`APP_URL` or constructed from `ROOT_DOMAIN`)
- Logs output to a notification cron log file for debugging
- Silent on success, logs errors

**Docker Considerations:**
- In Docker, cron runs inside the container
- The Dockerfile or entrypoint script should call this setup script on container start
- Uses `localhost` for the curl target since it's calling itself
- Alternatively, can use Docker's built-in healthcheck or an external scheduler

**Script Flow:**
1. Read current crontab (handle case where none exists)
2. Check if notification cron entry already present (by unique comment marker)
3. If missing, append the cron entry with identifying comment
4. Write updated crontab
5. Verify cron service is running (warn if not)

---

### 8. API Routes

#### VAPID Key
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/vapid-key` | Get public VAPID key for client subscription |

#### Subscribe/Unsubscribe
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications/subscribe` | Register a new push subscription |
| `DELETE` | `/api/notifications/subscribe` | Remove subscription by endpoint |

#### Preferences
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/preferences` | Get all preferences for current user |
| `PUT` | `/api/notifications/preferences` | Update notification preferences |

#### Subscription Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/subscriptions` | List all devices for current user |
| `DELETE` | `/api/notifications/subscriptions/[id]` | Remove a specific device |

#### Cron Trigger (Optional)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications/cron` | Trigger timer check (requires NOTIFICATION_CRON_SECRET) |

---

### 9. Service Worker

**Location:** `/public/sw.js`

**Responsibility:** Receive and display push notifications

- Handle `push` event to receive payload and display notification
- Handle `notificationclick` event for future deep-linking

Note: Next.js 16+ may require additional configuration for service worker registration.

---

### 10. Client-Side Subscription Manager

**Location:** `/src/lib/notifications/client.ts`

**Responsibility:** Browser-side subscription management

- Check browser push support
- Request notification permission
- Create VAPID subscription via PushManager
- Send subscription to server
- Handle unsubscription
- Check current subscription status

---

### 11. UI Components

**Location:** Settings page/modal

**Features:**
- Toggle notifications on/off per device
- List registered devices with ability to remove
- Per-baby configuration for each event type
- Activity type selection for ACTIVITY_CREATED
- Repeat interval selection for timer events

All user-facing text must use the localization system per project guidelines.

---

## Data Flow Diagrams

### Activity Created Flow

1. User logs activity (e.g., diaper change)
2. API route creates log entry in database
3. API route calls notifyActivityCreated()
4. Query matching NotificationPreference records (by baby, event type, activity type filter)
5. For each match, get PushSubscription and send notification
6. Log results
7. Call resetTimerNotificationState() to clear timer notification state

---

### Timer Expiration Flow

1. Cron triggers every minute
2. Query all enabled timer-type NotificationPreference records
3. Group by baby
4. For each baby, check if threshold exceeded
5. For each expired preference, check eligibility (first notification vs repeat interval)
6. Send eligible notifications, update lastTimerNotifiedAt
7. Run subscription cleanup
8. Exit

---

### Subscription Flow

1. User enables notifications in UI
2. Browser requests notification permission
3. If granted, fetch VAPID public key from server
4. Create subscription via PushManager.subscribe()
5. POST subscription data to server
6. Server creates PushSubscription record linked to auth context
7. User configures per-baby preferences
8. Server creates/updates NotificationPreference records

---

## Implementation Order

| Phase | Task | Description |
|-------|------|-------------|
| 0 | Dependencies | Add web-push package to project |
| 1 | Schema & Migration | Add new models, run Prisma migration |
| 2 | Environment & Setup | VAPID key generation in setup script |
| 3 | Push Utility | Core send functionality |
| 4 | API Routes | VAPID key, subscribe/unsubscribe/preferences endpoints, cron endpoint |
| 5 | Service Worker | Basic push event handling |
| 6 | Client Subscription Manager | Browser-side subscription logic |
| 7 | Activity Hook | Integrate into existing activity API routes |
| 8 | Timer Check Utility | Expiration detection and notification logic |
| 9 | Cron Setup Script | Script to install/verify cron job in system crontab |
| 10 | Cleanup Utility | Failed subscription and old log removal |
| 11 | UI Components | Settings page for managing subscriptions |
| 12 | Docker Integration | Update Dockerfile/entrypoint to run cron setup on start |
| 13 | Testing & Documentation | Self-hosted setup docs, testing |

---

## Additional Considerations

### Notification Payload Structure

Notifications include title, body, icon, badge, tag (for deduplication), and data payload with event type, baby ID, and target URL for deep linking.

The `tag` field prevents duplicate notifications from stacking - same tag replaces previous notification.

---

### Timer Interval Options

Suggested UI options for repeat notification interval:
- Once per expiration (null)
- Every 15 minutes
- Every 30 minutes
- Every hour
- Every 2 hours

---

### Log Retention

NotificationLog will grow quickly. Cleanup job should delete logs older than 30 days (or configurable retention period). Run as part of cron script.

---

### Localization

All notification body text and UI strings must use the localization system. Notification messages should be constructed using translation keys to support multiple languages.

---

### Future Enhancements

- Deep linking in notification tap (navigate directly to log activity screen)
- Additional timer types (sleep, medicine dose intervals)
- Quiet hours configuration (don't notify between configurable hours)
- Notification sound customization
- Summary notifications (batch multiple events into one notification)
