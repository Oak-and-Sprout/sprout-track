# Push Notifications Project Plan

## Overview

Enable users to subscribe to push notifications for baby activity events (new records created) and timer expirations (feed/diaper thresholds exceeded). Subscriptions are per-baby, per-device, and available to Accounts, Caretakers, and family system logins.

---

## Table of Contents

1. [Schema Additions](#schema-additions)
2. [Environment Variables](#environment-variables)
3. [Component Architecture](#component-architecture)
4. [Data Flow Diagrams](#data-flow-diagrams)
5. [Implementation Order](#implementation-order)
6. [Additional Considerations](#additional-considerations)

---

## Schema Additions

### New Models

#### PushSubscription

Stores VAPID subscription data per device.

```prisma
model PushSubscription {
  id            String    @id @default(uuid())
  
  // Subscriber identity (one of these will be set)
  accountId     String?
  caretakerId   String?
  familyId      String    // Always set - for family-level system account (00) access
  
  // VAPID subscription data from browser
  endpoint      String    @unique
  p256dh        String
  auth          String
  
  // Device identification
  deviceLabel   String?   // Optional user-friendly name ("John's iPhone")
  userAgent     String?   // For debugging
  
  // Health tracking
  failureCount  Int       @default(0)
  lastFailureAt DateTime?
  lastSuccessAt DateTime?
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  account       Account?   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  caretaker     Caretaker? @relation(fields: [caretakerId], references: [id], onDelete: Cascade)
  family        Family     @relation(fields: [familyId], references: [id], onDelete: Cascade)
  
  preferences   NotificationPreference[]
  logs          NotificationLog[]
  
  @@index([accountId])
  @@index([caretakerId])
  @@index([familyId])
  @@index([endpoint])
  @@index([failureCount])
}
```

#### NotificationPreference

User preferences for what notifications to receive.

```prisma
model NotificationPreference {
  id                    String   @id @default(uuid())
  
  subscriptionId        String
  babyId                String
  
  // What to notify on
  eventType             NotificationEventType
  
  // For activity created events, which activity types
  activityTypes         String?  // JSON array: ["FEED", "DIAPER", "SLEEP"] - null means all
  
  // Timer notification settings
  timerIntervalMinutes  Int?     // Minimum minutes between repeat timer notifications (null = notify once per expiration)
  lastTimerNotifiedAt   DateTime? // When we last sent a timer notification for this preference
  
  enabled               Boolean  @default(true)
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  // Relations
  subscription          PushSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  baby                  Baby             @relation(fields: [babyId], references: [id], onDelete: Cascade)
  
  @@unique([subscriptionId, babyId, eventType])
  @@index([subscriptionId])
  @@index([babyId])
  @@index([eventType])
  @@index([enabled])
}
```

#### NotificationEventType Enum

```prisma
enum NotificationEventType {
  ACTIVITY_CREATED      // Any activity logged
  FEED_TIMER_EXPIRED    // No feed within baby's feedWarningTime
  DIAPER_TIMER_EXPIRED  // No diaper within baby's diaperWarningTime
}
```

#### NotificationLog

Logging for debugging and failure tracking.

```prisma
model NotificationLog {
  id              String    @id @default(uuid())
  
  subscriptionId  String
  
  eventType       NotificationEventType
  activityType    String?   // Which activity triggered it (for ACTIVITY_CREATED)
  babyId          String?
  
  // Delivery status
  success         Boolean
  errorMessage    String?
  httpStatus      Int?
  
  // Payload sent (for debugging)
  payload         String?   // JSON of notification content
  
  createdAt       DateTime  @default(now())
  
  // Relations
  subscription    PushSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  @@index([subscriptionId])
  @@index([createdAt])
  @@index([success])
}
```

### Reverse Relations

Add to existing models:

```prisma
// Add to Account model
pushSubscriptions PushSubscription[]

// Add to Caretaker model
pushSubscriptions PushSubscription[]

// Add to Family model
pushSubscriptions PushSubscription[]

// Add to Baby model
notificationPreferences NotificationPreference[]
```

---

## Environment Variables

```env
# VAPID keys for web push (auto-generated during setup if not present)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:notifications@sprouttrack.app
```

---

## Component Architecture

### 1. Setup Script Enhancement

| | |
|---|---|
| **Location** | `/scripts/setup.ts` (or existing setup script) |
| **Responsibility** | VAPID key generation |

**Functions:**

- Check if VAPID keys exist in environment/config
- If not, generate new keypair using `web-push` library
- Output keys for user to add to `.env` (or write directly in self-hosted mode)

---

### 2. Push Notification Utility

| | |
|---|---|
| **Location** | `/src/lib/notifications/push.ts` |
| **Responsibility** | Core push notification sending |

**Functions:**

- Initialize `web-push` with VAPID credentials
- `sendNotification(subscriptionId, payload)` - Core send function
- Handle response status codes:
  - `410 Gone` = delete subscription immediately
  - Other errors = increment failure count
- Reset failure count on success
- Log all send attempts to `NotificationLog`

---

### 3. Subscription Cleanup Utility

| | |
|---|---|
| **Location** | `/src/lib/notifications/cleanup.ts` |
| **Responsibility** | Remove dead subscriptions |

**Functions:**

- `cleanupFailedSubscriptions()` - Delete subscriptions where `failureCount >= 5`
- Called by cron script after processing notifications
- Also callable manually via admin endpoint if needed

---

### 4. Timer Check Utility

| | |
|---|---|
| **Location** | `/src/lib/notifications/timerCheck.ts` |
| **Responsibility** | Detect and notify on expired timers |

**Functions:**

- `checkExpiredTimers()` - Main function called by cron

**Logic Flow:**

1. Query all enabled `NotificationPreference` records where `eventType` is `FEED_TIMER_EXPIRED` or `DIAPER_TIMER_EXPIRED`
2. For each unique baby, check last activity time against baby's threshold
3. For each expired timer, check notification eligibility:
   - If `lastTimerNotifiedAt` is null → send notification
   - If `timerIntervalMinutes` is null → only notify once per expiration (don't re-notify)
   - If `timerIntervalMinutes` is set → check if enough time has passed since `lastTimerNotifiedAt`
4. Send notifications to eligible subscriptions
5. Update `lastTimerNotifiedAt` for each notified preference

---

### 5. Activity Hook Utility

| | |
|---|---|
| **Location** | `/src/lib/notifications/activityHook.ts` |
| **Responsibility** | Notify on activity creation, reset timer state |

**Functions:**

- `notifyActivityCreated(activityType, babyId, familyId, metadata)`
  - Called by API routes after successful activity creation
  - Query matching `NotificationPreference` records
  - Filter by `activityTypes` if specified
  - Fan out to all matching subscriptions

- `resetTimerNotificationState(activityType, babyId)`
  - Called when relevant activity is logged
  - Reset `lastTimerNotifiedAt` to null for matching timer preferences
  - Feed activity resets `FEED_TIMER_EXPIRED` preferences
  - Diaper activity resets `DIAPER_TIMER_EXPIRED` preferences

---

### 6. Cron Script

| | |
|---|---|
| **Location** | `/scripts/check-notifications.ts` |
| **Responsibility** | Periodic timer check execution |

**Execution:**

- Standalone script executable by system cron
- Schedule: `* * * * *` (every minute)

**Steps:**

1. Initialize Prisma client
2. Call `checkExpiredTimers()`
3. Call `cleanupFailedSubscriptions()`
4. Exit cleanly

---

### 7. API Routes

#### Subscribe/Unsubscribe

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/notifications/subscribe` | Register a new push subscription |
| `DELETE` | `/api/notifications/subscribe` | Remove subscription by endpoint |

**POST body:**
- `endpoint` - VAPID endpoint URL
- `p256dh` - Public key
- `auth` - Auth secret
- `deviceLabel` - Optional friendly name

---

#### Preferences

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/preferences` | Get all preferences for current user |
| `PUT` | `/api/notifications/preferences` | Update notification preferences |

**PUT body:**
- `babyId` - Which baby
- `eventType` - Which event type
- `enabled` - On/off
- `activityTypes` - Array of activity types (for `ACTIVITY_CREATED`)
- `timerIntervalMinutes` - Repeat notification interval (for timer events)

---

#### Subscription Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications/subscriptions` | List all devices for current user |
| `DELETE` | `/api/notifications/subscriptions/[id]` | Remove a specific device |

---

### 8. Service Worker

| | |
|---|---|
| **Location** | `/public/sw.js` |
| **Responsibility** | Receive and display push notifications |

**Event Handlers:**

- `push` - Receive notification payload, display to user
- `notificationclick` - Handle tap (future deep-linking)

---

### 9. Client-Side Subscription Manager

| | |
|---|---|
| **Location** | `/src/lib/notifications/client.ts` |
| **Responsibility** | Browser-side subscription management |

**Functions:**

- `checkSupport()` - Verify browser push support
- `requestPermission()` - Request notification permission
- `subscribe()` - Create VAPID subscription, send to server
- `unsubscribe()` - Remove subscription
- `getSubscriptionStatus()` - Check current state

---

### 10. UI Components

#### Notification Settings Page/Modal

**Features:**

- Toggle notifications on/off per device
- List registered devices with ability to remove
- Per-baby configuration:
  - Activity created notifications
    - Toggle on/off
    - Select which activity types (or all)
  - Feed timer expired
    - Toggle on/off
    - Set repeat interval (once, every 15 min, every 30 min, every hour)
  - Diaper timer expired
    - Toggle on/off
    - Set repeat interval

---

## Data Flow Diagrams

### Activity Created Flow

```
User logs diaper
       │
       ▼
POST /api/diaper
       │
       ▼
Create DiaperLog in database
       │
       ▼
Call notifyActivityCreated("DIAPER", babyId, familyId)
       │
       ▼
Query NotificationPreference where:
  • babyId matches
  • eventType = ACTIVITY_CREATED
  • enabled = true
  • activityTypes is null OR contains "DIAPER"
       │
       ▼
For each matching preference:
  • Get associated PushSubscription
  • Send push notification
  • Log result
       │
       ▼
Call resetTimerNotificationState("DIAPER", babyId)
  • Sets lastTimerNotifiedAt = null for DIAPER_TIMER_EXPIRED preferences
```

---

### Timer Expiration Flow

```
Cron runs every minute
       │
       ▼
Execute /scripts/check-notifications.ts
       │
       ▼
Call checkExpiredTimers()
       │
       ▼
Query all NotificationPreference where:
  • eventType IN (FEED_TIMER_EXPIRED, DIAPER_TIMER_EXPIRED)
  • enabled = true
       │
       ▼
Group by babyId
       │
       ▼
For each baby:
  • Get baby's feedWarningTime / diaperWarningTime
  • Get last feed/diaper activity time
  • Calculate if threshold exceeded
       │
       ▼
For each expired preference, check eligibility:
  │
  ├─► lastTimerNotifiedAt is null?
  │     → SEND (first notification for this expiration)
  │
  ├─► timerIntervalMinutes is null?
  │     → SKIP (already notified, user wants single notification)
  │
  └─► timerIntervalMinutes is set?
        → Check: now - lastTimerNotifiedAt >= timerIntervalMinutes
        → If yes: SEND
        → If no: SKIP
       │
       ▼
Send notifications, update lastTimerNotifiedAt
       │
       ▼
Call cleanupFailedSubscriptions()
       │
       ▼
Exit
```

---

### Subscription Flow

```
User enables notifications in UI
       │
       ▼
Browser requests notification permission
       │
       ▼
Permission granted?
  • No  → Show error, exit
  • Yes → Continue
       │
       ▼
Fetch VAPID public key from server
       │
       ▼
PushManager.subscribe() creates subscription
       │
       ▼
POST /api/notifications/subscribe
  • endpoint
  • keys.p256dh
  • keys.auth
  • deviceLabel (optional)
       │
       ▼
Server creates PushSubscription record
  • Links to Account/Caretaker/Family based on auth context
       │
       ▼
User configures preferences in UI
       │
       ▼
PUT /api/notifications/preferences
       │
       ▼
Server creates/updates NotificationPreference records
```

---

## Implementation Order

| Phase | Task | Description |
|-------|------|-------------|
| 1 | Schema & Migration | Add new models, run Prisma migration |
| 2 | Environment & Setup | VAPID key generation in setup script |
| 3 | Push Utility | Core send functionality with `web-push` |
| 4 | API Routes | Subscribe/unsubscribe/preferences endpoints |
| 5 | Service Worker | Basic push event handling |
| 6 | Client Subscription Manager | Browser-side subscription logic |
| 7 | Activity Hook | Integrate into existing activity API routes |
| 8 | Timer Check Utility | Expiration detection and notification logic |
| 9 | Cron Script | Standalone script for timer checks |
| 10 | Cleanup Utility | Failed subscription removal |
| 11 | UI Components | Settings page for managing subscriptions |
| 12 | Testing & Documentation | Self-hosted setup docs, testing |

---

## Additional Considerations

### Notification Payload Structure

```json
{
  "title": "Sprout Track",
  "body": "Jackson hasn't been fed in 3 hours",
  "icon": "/icon-192.png",
  "badge": "/badge.png",
  "tag": "feed-timer-jackson",
  "data": {
    "type": "FEED_TIMER_EXPIRED",
    "babyId": "xxx",
    "url": "/dashboard"
  }
}
```

The `tag` field prevents duplicate notifications from stacking - same tag replaces previous notification.

---

### Timer Interval Options

Suggested UI options for `timerIntervalMinutes`:

| Label | Value |
|-------|-------|
| Once per expiration | `null` |
| Every 15 minutes | `15` |
| Every 30 minutes | `30` |
| Every hour | `60` |
| Every 2 hours | `120` |

---

### Log Retention

`NotificationLog` will grow quickly. Recommendations:

- Add cleanup job to delete logs older than 30 days
- Or make retention period configurable in settings
- Consider running cleanup as part of the cron script

---

### Future Enhancements

- Deep linking in notification tap (navigate directly to log activity screen)
- Additional timer types (sleep, medicine dose intervals)
- Quiet hours configuration (don't notify between 10pm-6am)
- Notification sound customization
- Summary notifications (batch multiple events into one notification)