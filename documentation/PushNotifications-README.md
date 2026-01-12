# Push Notifications - Setup and Reference Guide

## Overview

The push notification system enables users to subscribe to push notifications for baby activity events (new records created) and timer expirations (feed/diaper thresholds exceeded). Subscriptions are per-baby, per-device, and available to Accounts, Caretakers, and family system logins.

**Implementation Status:** Phases 0-13 Complete ✅

**Key Features:**
- Real-time notifications when activities are logged
- Timer-based notifications for feed and diaper reminders
- Per-baby, per-device notification preferences
- Automatic cleanup of failed subscriptions
- Comprehensive logging for debugging

## Quick Start

### Prerequisites

- Node.js 22+ and npm
- Database (SQLite for local, PostgreSQL for production)
- Browser with push notification support (Chrome, Firefox, Edge, Safari 16.4+)
- HTTPS in production (required for push notifications)

### Basic Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Generate VAPID keys:**
   ```bash
   npm run setup:vapid
   ```

3. **Configure environment variables:**
   Add to your `.env` file:
   ```bash
   ENABLE_NOTIFICATIONS=true
   VAPID_PUBLIC_KEY=<generated>
   VAPID_PRIVATE_KEY=<generated>
   VAPID_SUBJECT=mailto:notifications@sprouttrack.app
   NOTIFICATION_CRON_SECRET=<random-secret-string>
   NOTIFICATION_LOG_RETENTION_DAYS=30
   APP_URL=http://localhost:3000
   ```

4. **Run database migrations:**
   ```bash
   npm run prisma:migrate
   ```

5. **Start the application:**
   ```bash
   npm run dev
   ```

6. **Enable notifications in UI:**
   - Navigate to Settings
   - Scroll to "Push Notifications" section
   - Click "Enable Notifications"
   - Grant browser permission
   - Configure preferences per baby

## File Structure

### Core Notification Files

#### Backend Utilities
- `src/lib/notifications/push.ts` - Core push notification sending with encryption
- `src/lib/notifications/client.ts` - Client-side subscription manager
- `src/lib/notifications/activityHook.ts` - Activity event hooks
- `src/lib/notifications/timerCheck.ts` - Timer expiration detection and notification
- `src/lib/notifications/cleanup.ts` - Subscription and log cleanup utilities

#### API Routes
- `app/api/notifications/vapid-key/route.ts` - VAPID public key endpoint
- `app/api/notifications/subscribe/route.ts` - Subscribe/unsubscribe
- `app/api/notifications/preferences/route.ts` - Preferences management
- `app/api/notifications/subscriptions/route.ts` - List subscriptions
- `app/api/notifications/subscriptions/[id]/route.ts` - Delete subscription
- `app/api/notifications/cron/route.ts` - Cron trigger endpoint

#### Frontend Components
- `src/components/forms/SettingsForm/NotificationSettings.tsx` - Settings UI
- `public/sw.js` - Service worker for receiving notifications

#### Scripts
- `scripts/setup-vapid-keys.ts` - VAPID key generation script
- `scripts/setup-notification-cron.ts` - Cron job setup script
- `scripts/run-notification-cron.sh` - Cron runner shell script

#### Documentation
- `documentation/PushNotifications-README.md` - This file (main reference)
- `documentation/PushNotifications-Implementation.md` - Implementation status
- `documentation/PushNotifications-Logging-Debugging.md` - Logging and debugging guide
- `documentation/PushNotificationPlan.md` - Original implementation plan

## Setup Instructions

### Local Development Setup

1. Follow the Quick Start steps above
2. Ensure your browser allows notifications
3. Test by logging an activity and checking for notifications

### Docker Setup

#### Notifications Enabled

1. **Set environment variables in `.env`:**
   ```bash
   ENABLE_NOTIFICATIONS=true
   NOTIFICATION_CRON_SECRET=your-secret-here
   APP_URL=http://localhost:3000
   VAPID_PUBLIC_KEY=your-public-key
   VAPID_PRIVATE_KEY=your-private-key
   ```

2. **Build with notifications:**
   ```bash
   docker build --build-arg ENABLE_NOTIFICATIONS=true --build-arg BUILD_NOTIFICATIONS=true -t sprout-track:with-notifications .
   ```

3. **Or use docker-compose:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Verify cron job:**
   ```bash
   ./scripts/docker-setup.sh notification-status
   ```

#### Notifications Disabled (Default)

Simply build without setting `ENABLE_NOTIFICATIONS`:
```bash
docker build -t sprout-track:standard .
```

### VAPID Key Generation

VAPID keys are automatically generated during setup. To generate manually:

```bash
npm run setup:vapid
```

This will:
- Check if VAPID keys exist in `.env`
- Generate new keypair if missing
- Update `.env` with the keys

### Cron Job Setup

For timer notifications to work, set up the cron job:

**Local:**
```bash
npm run notification:cron:setup
```

**Docker:**
The cron job is automatically set up during container startup if `ENABLE_NOTIFICATIONS=true`.

**Manual execution:**
```bash
npm run notification:cron:run
```

## Configuration

### Environment Variables

#### Required (when notifications enabled)
- `ENABLE_NOTIFICATIONS` - Master feature flag (true/false)
- `VAPID_PUBLIC_KEY` - VAPID public key (auto-generated)
- `VAPID_PRIVATE_KEY` - VAPID private key (auto-generated)
- `VAPID_SUBJECT` - VAPID subject (mailto: URI)
- `NOTIFICATION_CRON_SECRET` - Secret for securing cron endpoint

#### Optional
- `NOTIFICATION_LOG_RETENTION_DAYS` - Days to retain notification logs (default: 30)
- `APP_URL` - Base URL for API calls (or use `ROOT_DOMAIN`)
- `ROOT_DOMAIN` - Domain name (used to construct APP_URL if not set)

### Build Arguments (Docker)

- `ENABLE_NOTIFICATIONS` - Enable notification features (default: false)
- `BUILD_NOTIFICATIONS` - Include notification code in build (default: false)

### Feature Flags

The `ENABLE_NOTIFICATIONS` environment variable acts as a master switch:
- When `false`, all notification APIs return 503
- UI component is hidden when `notificationsEnabled === false`
- Client-side functions check the flag before making API calls

## Docker Deployment

### Building with Notifications

```bash
docker build \
  --build-arg ENABLE_NOTIFICATIONS=true \
  --build-arg BUILD_NOTIFICATIONS=true \
  -t sprout-track:with-notifications .
```

### Running Cron in Container

Cron runs automatically inside the container when notifications are enabled:
- Cron daemon starts in background during container startup
- Runs every minute to check for timer expirations
- Logs to `/app/logs/notification-cron.log`
- Accessible via volume mount: `./logs:/app/logs`

### Environment Variable Setup

Set variables in `.env` file or `docker-compose.yml`:

```yaml
environment:
  - ENABLE_NOTIFICATIONS=true
  - NOTIFICATION_CRON_SECRET=your-secret
  - APP_URL=http://localhost:3000
```

### Viewing Logs

**Container logs:**
```bash
docker logs sprout-track
```

**Notification cron logs:**
```bash
./scripts/docker-setup.sh notification-logs
# Or directly:
tail -f ./logs/notification-cron.log
```

## API Reference

### Public Endpoints

#### GET `/api/notifications/vapid-key`
Returns the public VAPID key for client-side subscription.
- **Auth:** Not required (public key is safe to expose)
- **Response:** `{ success: true, data: { publicKey: string } }`

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

## Client-Side Usage

### Browser Compatibility

- **Chrome/Edge:** Full support ✅
- **Firefox:** Full support ✅
- **Safari:** Limited support (macOS 10.16+, iOS 16.4+) ⚠️
- **Opera:** Full support ✅
- **Mobile:** Requires HTTPS in production ⚠️

### Service Worker

The service worker (`/sw.js`) handles:
- Receiving push notifications
- Displaying notifications
- Handling notification clicks (deep-linking)
- Service worker updates

### Subscription Management

Use the `NotificationSettings` component in Settings to:
- Enable/disable notifications
- View registered devices
- Configure per-baby preferences
- Remove devices

## Timer Notifications

### How Timer Checks Work

1. Cron job runs every minute
2. Queries all enabled timer-type preferences
3. For each baby, checks last activity time vs threshold
4. Determines notification eligibility (first notification vs repeat interval)
5. Sends notifications to eligible subscriptions
6. Updates `lastTimerNotifiedAt` for notified preferences
7. Runs cleanup operations

### Cron Job Configuration

- **Schedule:** Every minute (`* * * * *`)
- **Script:** `scripts/run-notification-cron.sh`
- **Logs:** `/app/logs/notification-cron.log` (Docker) or `./logs/notification-cron.log` (local)

### Repeat Intervals

Timer notifications support repeat intervals:
- **Once per expiration** (null) - Notify once when timer expires, then wait for activity
- **Every 15 minutes** - Repeat notification every 15 minutes
- **Every 30 minutes** - Repeat notification every 30 minutes
- **Every hour** - Repeat notification every hour
- **Every 2 hours** - Repeat notification every 2 hours

### Testing Timer Notifications

1. Enable timer notifications for a baby
2. Wait for the timer threshold to expire (check baby's `feedWarningTime` or `diaperWarningTime`)
3. Verify notification is received
4. Check cron logs: `./scripts/docker-setup.sh notification-logs`

## Cleanup & Maintenance

### Failed Subscription Cleanup

Subscriptions with `failureCount >= 5` are automatically cleaned up during cron execution.

**Manual cleanup:**
The cleanup runs automatically, but you can trigger it manually by calling the cron endpoint.

### Log Retention

Notification logs older than the retention period (default: 30 days) are automatically deleted during cron execution.

**Configure retention:**
```bash
NOTIFICATION_LOG_RETENTION_DAYS=60  # Keep logs for 60 days
```

### Manual Cleanup Procedures

1. **Check failed subscriptions:**
   ```sql
   SELECT * FROM PushSubscription WHERE failureCount >= 5;
   ```

2. **Check old logs:**
   ```sql
   SELECT COUNT(*) FROM NotificationLog 
   WHERE createdAt < datetime('now', '-30 days');
   ```

3. **Manual cleanup via API:**
   Call the cron endpoint manually (requires `NOTIFICATION_CRON_SECRET`)

## Troubleshooting

### Quick Reference

- **Notifications not sending:** Check browser console, service worker status, VAPID keys
- **Cron job not running:** Verify cron is installed and running, check cron logs
- **Timer notifications not working:** Verify cron job is set up, check timer preferences are enabled
- **VAPID keys not generating:** Check Node.js version, verify `web-push` package is installed

### Basic Debugging Steps

1. Check browser console for client-side errors
2. Check server logs for API errors
3. Verify environment variables are set correctly
4. Ensure database migration has been applied
5. Test in different browsers to rule out compatibility issues

### Detailed Debugging

For comprehensive debugging procedures, log locations, and troubleshooting guides, see:
**[PushNotifications-Logging-Debugging.md](./PushNotifications-Logging-Debugging.md)**

## Deviations from Original Plan

### Enhancements Made

1. **Comprehensive Logging:** Added extensive logging throughout for testing and debugging
2. **Docker Integration:** Full Docker support with build arguments and automatic cron setup
3. **Enhanced Error Handling:** Improved error messages and logging context
4. **Separate Logging Documentation:** Created dedicated logging/debugging guide

### Changes from Plan

1. **Cron Setup:** Automated in Docker startup script instead of requiring manual setup
2. **VAPID Key Generation:** Integrated into Docker startup for automatic generation
3. **Logging Strategy:** Kept all console.log statements for testing (as requested)
4. **Documentation Structure:** Split into main README and separate logging guide

### Testing Considerations

This is the initial implementation and has not been fully tested yet. All logging has been kept for testing purposes. See the logging guide for testing procedures.

## References

- **[PushNotifications-Implementation.md](./PushNotifications-Implementation.md)** - Detailed implementation status
- **[PushNotifications-Logging-Debugging.md](./PushNotifications-Logging-Debugging.md)** - Comprehensive logging and debugging guide
- **[PushNotificationPlan.md](./PushNotificationPlan.md)** - Original implementation plan
- **[Prisma Schema](../prisma/schema.prisma)** - Database schema

## Support

For issues or questions:
1. Check the [Logging & Debugging Guide](./PushNotifications-Logging-Debugging.md)
2. Review browser console for client-side errors
3. Check server logs for API errors
4. Verify environment variables are set correctly
5. Ensure database migration has been applied
6. Test in different browsers to rule out compatibility issues
