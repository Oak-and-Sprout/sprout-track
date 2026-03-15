# Push Notifications - Logging & Debugging Guide

## Overview

This document provides comprehensive guidance on logging and debugging the push notification system. Use this guide when troubleshooting notification issues, testing the system, or analyzing log output.

**When to Use This Guide:**
- Troubleshooting notification delivery issues
- Testing notification functionality
- Understanding log messages
- Debugging cron job problems
- Analyzing notification performance

**Logging Philosophy:**
- All logging is kept for testing purposes (initial implementation)
- Logs use consistent prefixes for easy filtering: `[ComponentName]`
- Timestamps are included in file-based logs
- Error logs include full context for debugging

## Log Locations

### Console Logs (Browser/Client-Side)

**Location:** Browser Developer Tools Console

**How to Access:**
1. Open browser DevTools (F12)
2. Navigate to Console tab
3. Filter by `[NotificationSettings]` or `[Notification]` prefix

**What You'll See:**
- Component lifecycle events
- API call results
- Subscription status changes
- Error messages with context

### Server-Side Logs (stdout/stderr)

**Location:** Application stdout/stderr (captured by Docker or process manager)

**How to Access:**
- **Local:** Terminal where `npm run dev` is running
- **Docker:** `docker logs sprout-track` or `docker-compose logs -f`

**What You'll See:**
- API endpoint processing
- Timer check execution
- Cleanup operations
- Error stack traces

### Cron Job Logs

**Location:** `/app/logs/notification-cron.log` (Docker) or `./logs/notification-cron.log` (local)

**How to Access:**
- **Local:** `tail -f ./logs/notification-cron.log`
- **Docker:** `docker-compose exec app cat /app/logs/notification-cron.log`
- **Via script:** `./scripts/docker-setup.sh notification-logs`

**What You'll See:**
- Cron job execution timestamps
- API call results
- HTTP response codes
- Error messages

### Docker Logs

**Location:** Docker container stdout/stderr

**How to Access:**
```bash
docker logs sprout-track
docker logs sprout-track -f  # Follow mode
docker-compose logs -f app   # Follow mode with docker-compose
```

**What You'll See:**
- Container startup logs
- VAPID key generation
- Cron daemon startup
- Application logs
- All stdout/stderr output

### File System Log Locations

- **Cron logs:** `./logs/notification-cron.log` (local) or `/app/logs/notification-cron.log` (Docker)
- **Application logs:** stdout/stderr (no separate file)
- **Service worker logs:** Browser DevTools > Application > Service Workers

## Client-Side Logging

### NotificationSettings Component

**Prefix:** `[NotificationSettings]`

**Common Log Messages:**

1. **Component Lifecycle:**
   ```
   [NotificationSettings] Component mounted, parentLoading: false
   [NotificationSettings] Component unmounting
   ```

2. **Data Fetching:**
   ```
   [NotificationSettings] Fetching notification data...
   [NotificationSettings] Loaded 2 subscription(s)
   [NotificationSettings] Loaded 5 preference(s)
   [NotificationSettings] Subscription status: { isSubscribed: true, subscriptionId: "..." }
   ```

3. **Subscription Operations:**
   ```
   Getting VAPID public key...
   VAPID public key retrieved, length: 87
   Registering service worker and subscribing to push...
   Push subscription created, endpoint: https://...
   Sending subscription to server...
   Subscription saved to server, ID: clx...
   ```

4. **Device Removal:**
   ```
   [NotificationSettings] Removing device: { id: "...", deviceLabel: "...", endpoint: "..." }
   [NotificationSettings] Device removed from server successfully
   [NotificationSettings] Unsubscribing from browser push...
   ```

5. **Preference Updates:**
   ```
   [NotificationSettings] Updating preference: { subscriptionId: "...", babyId: "...", eventType: "FEED_TIMER_EXPIRED", updates: {...} }
   [NotificationSettings] Preference updated successfully: {...}
   ```

6. **Errors:**
   ```
   [NotificationSettings] Error fetching notification data: Error: ...
   [NotificationSettings] Error removing device: Error: ...
   [NotificationSettings] Error updating preference: Error: ...
   ```

**What to Look For:**
- Successful data loading (subscriptions and preferences count)
- API call success/failure
- Subscription status changes
- Error messages with context

### Service Worker Logs

**Location:** Browser DevTools > Application > Service Workers

**Common Log Messages:**
- Service worker registration
- Push event reception
- Notification display
- Notification click handling

**How to Debug:**
1. Open DevTools > Application > Service Workers
2. Check service worker status (activated, waiting, etc.)
3. Click "Console" to see service worker logs
4. Test push notification by sending test notification

## Server-Side Logging

### API Endpoint Logs

**Prefix:** None (standard Next.js API route logging)

**Common Log Messages:**
- Request received: `POST /api/notifications/cron`
- Authentication success/failure
- Database query results
- Error stack traces

**What to Look For:**
- 401 errors (authentication issues)
- 503 errors (notifications disabled)
- 500 errors (server errors with stack traces)

### Timer Check Utility

**Prefix:** `[TimerCheck]`

**Common Log Messages:**

1. **Timer Check Start:**
   ```
   [TimerCheck] Starting timer expiration check...
   [TimerCheck] Querying enabled timer preferences...
   [TimerCheck] Found 3 enabled timer preference(s)
   ```

2. **Processing:**
   ```
   [TimerCheck] Processing 2 unique baby/baby-event combination(s)
   [TimerCheck] Processing baby clx...
   [TimerCheck] Checking feed timer for baby clx... (threshold: 180 minutes)
   [TimerCheck] Last feed: 185.5 minutes ago (threshold: 180 minutes)
   ```

3. **Notification Eligibility:**
   ```
   [TimerCheck] Feed timer preference clx...: eligible=true, lastNotified=null, interval=30
   [TimerCheck] Sending feed timer notification for preference clx...
   [TimerCheck] Feed timer notification sent successfully (total: 1)
   ```

4. **Completion:**
   ```
   [TimerCheck] Timer check completed: 2 notification(s) sent in 1250ms
   ```

5. **Errors:**
   ```
   [TimerCheck] Error in checkTimerExpirations: Error: ...
   [TimerCheck] Error sending feed timer notification for preference clx...: Error: ...
   ```

**What to Look For:**
- Number of preferences found
- Timer expiration detection
- Notification eligibility decisions
- Successful notification sending
- Performance metrics (duration)

### Cleanup Utility

**Prefix:** `[Cleanup]`

**Common Log Messages:**

1. **Cleanup Start:**
   ```
   [Cleanup] Starting cleanup operations...
   [Cleanup] Using log retention period: 30 days
   ```

2. **Subscription Cleanup:**
   ```
   [Cleanup] Starting failed subscription cleanup...
   [Cleanup] Found 2 subscription(s) with failureCount >= 5, deleting...
   [Cleanup] ✓ Cleaned up 2 failed push subscription(s)
   ```

3. **Log Cleanup:**
   ```
   [Cleanup] Starting old notification log cleanup (retention: 30 days)...
   [Cleanup] Deleting logs older than 2024-01-01T00:00:00.000Z
   [Cleanup] Found 150 log(s) older than 30 days, deleting...
   [Cleanup] ✓ Cleaned up 150 old notification log(s) (older than 30 days)
   ```

4. **Completion:**
   ```
   [Cleanup] Cleanup completed in 450ms: 2 subscription(s) cleaned, 150 log(s) cleaned
   ```

5. **Errors:**
   ```
   [Cleanup] Error cleaning up failed subscriptions: Error: ...
   [Cleanup] Error cleaning up old notification logs: Error: ...
   ```

**What to Look For:**
- Number of items found for cleanup
- Successful deletion counts
- Performance metrics
- Error messages

## Cron Logging

### Cron Daemon Logs

**Location:** Docker container stdout (when running with `-d 8` debug level)

**Common Log Messages:**
- Cron daemon startup
- Job execution
- Error messages

**How to View:**
```bash
docker logs sprout-track | grep -i cron
```

### Cron Job Execution Logs

**Location:** `/app/logs/notification-cron.log`

**Common Log Messages:**

1. **Execution Start:**
   ```
   2024-01-15 10:30:00: [Cron] Starting notification check...
   2024-01-15 10:30:00: [Cron] Calling API endpoint: http://localhost:3000/api/notifications/cron
   ```

2. **Success:**
   ```
   2024-01-15 10:30:01: [Cron] ✓ Success (HTTP 200)
   2024-01-15 10:30:01: [Cron] Response: {"success":true,"data":{"notificationsSent":2,"subscriptionsCleaned":0,"logsCleaned":0}}
   ```

3. **Errors:**
   ```
   2024-01-15 10:30:00: [Cron] ✗ ERROR: API call failed with HTTP 401
   2024-01-15 10:30:00: [Cron] Response: {"success":false,"error":"Unauthorized: Invalid secret"}
   ```

**What to Look For:**
- Timestamp of each execution
- HTTP response codes
- Success/failure status
- Response body content

## Docker Logging

### Startup Script Logs

**Location:** Docker container stdout

**Common Log Messages:**

1. **VAPID Key Generation:**
   ```
   === Notification Setup ===
   Notifications are enabled, setting up notification infrastructure...
   Checking for VAPID keys...
   VAPID keys not found. Generating new VAPID keypair...
   ✓ VAPID keys generated successfully
   ```

2. **Environment Validation:**
   ```
   Validating notification environment variables...
   ✓ NOTIFICATION_CRON_SECRET is set
   ✓ API URL configuration found
   ```

3. **Cron Setup:**
   ```
   Setting up notification cron job...
   ✓ Cron job setup completed
   Starting cron daemon...
   ✓ Cron daemon started (PID: 42)
   === Notification Setup Complete ===
   ```

**What to Look For:**
- Successful VAPID key generation
- Environment variable validation
- Cron job installation
- Cron daemon startup

## Debugging Procedures

### Step-by-Step Debugging Guide

#### 1. Verify Notifications Are Enabled

**Check:**
- Environment variable: `ENABLE_NOTIFICATIONS=true`
- Browser console: No 503 errors from API calls
- Settings UI: Notification section is visible

**Logs to Check:**
- Server logs: Should not see "Push notifications are disabled"
- Client logs: Should see subscription attempts

#### 2. Verify VAPID Keys

**Check:**
- `.env` file contains `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`
- Keys are not empty
- Keys are base64-url-encoded strings

**Logs to Check:**
- Docker startup: "✓ VAPID keys already exist" or "✓ VAPID keys generated successfully"
- Client logs: "VAPID public key retrieved, length: 87"

#### 3. Verify Subscription Creation

**Check:**
- Browser permission granted
- Service worker registered
- Subscription created in database

**Logs to Check:**
- Client: "Push subscription created, endpoint: https://..."
- Client: "Subscription saved to server, ID: ..."
- Server: Subscription record in database

#### 4. Verify Timer Notifications

**Check:**
- Cron job is installed: `crontab -l | grep notification`
- Cron daemon is running: `pgrep crond`
- Timer preferences are enabled
- Baby's warning times are set

**Logs to Check:**
- Cron logs: Successful API calls every minute
- Timer check logs: Timer expiration detection
- Timer check logs: Notifications sent

#### 5. Verify Cleanup

**Check:**
- Failed subscriptions are being removed
- Old logs are being deleted

**Logs to Check:**
- Cleanup logs: "Cleaned up X failed push subscription(s)"
- Cleanup logs: "Cleaned up X old notification log(s)"

### Common Issues and Solutions

#### Issue: Notifications Not Sending

**Symptoms:**
- No notifications appear in browser
- API calls return success but no notification

**Debugging Steps:**
1. Check browser console for errors
2. Verify service worker is active
3. Check browser notification permissions
4. Verify subscription exists in database
5. Check server logs for notification sending errors
6. Verify VAPID keys are correct

**Logs to Check:**
- Client: Service worker registration
- Client: Subscription creation
- Server: Notification sending attempts
- Server: Error messages

#### Issue: Cron Job Not Running

**Symptoms:**
- Timer notifications not received
- No cron logs being written

**Debugging Steps:**
1. Verify cron is installed: `which crond`
2. Check cron daemon is running: `pgrep crond`
3. Verify cron job is installed: `crontab -l`
4. Check cron logs for errors
5. Verify `NOTIFICATION_CRON_SECRET` is set
6. Test cron endpoint manually

**Logs to Check:**
- Docker startup: "✓ Cron daemon started"
- Cron logs: Execution timestamps
- Server logs: API endpoint calls

#### Issue: VAPID Keys Not Generating

**Symptoms:**
- VAPID key generation fails
- Keys are empty or missing

**Debugging Steps:**
1. Check Node.js version (requires Node 18+)
2. Verify `web-push` package is installed
3. Check file permissions on `.env`
4. Verify `npm run setup:vapid` completes successfully
5. Check for error messages in output

**Logs to Check:**
- Setup script output: Error messages
- Docker startup: VAPID generation logs

#### Issue: Timer Notifications Not Working

**Symptoms:**
- Timer preferences enabled but no notifications
- Cron job running but no notifications sent

**Debugging Steps:**
1. Verify timer preferences are enabled
2. Check baby's warning times are set
3. Verify last activity time vs threshold
4. Check notification eligibility logic
5. Verify cron job is calling API endpoint
6. Check timer check logs for details

**Logs to Check:**
- Timer check: Timer expiration detection
- Timer check: Notification eligibility
- Timer check: Notification sending
- Cron logs: API call results

#### Issue: Cleanup Not Running

**Symptoms:**
- Failed subscriptions accumulating
- Old logs not being deleted

**Debugging Steps:**
1. Verify cleanup is called during cron execution
2. Check cleanup logs for execution
3. Verify retention period is set correctly
4. Check database for items that should be cleaned

**Logs to Check:**
- Cleanup: Cleanup start messages
- Cleanup: Items found for cleanup
- Cleanup: Successful deletion counts

#### Issue: Logs Not Appearing

**Symptoms:**
- Expected log messages not visible
- Log files not being created

**Debugging Steps:**
1. Verify log directory exists and is writable
2. Check file permissions
3. Verify logging is enabled
4. Check Docker volume mounts
5. Verify cron job is writing to log file

**Logs to Check:**
- Docker startup: Log directory creation
- File system: Log file existence and permissions

## Log Message Reference

### Client-Side Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `[NotificationSettings] Component mounted` | Component loaded | Normal operation |
| `[NotificationSettings] Fetching notification data...` | Loading subscriptions/preferences | Normal operation |
| `[NotificationSettings] Loaded X subscription(s)` | Data loaded successfully | Normal operation |
| `[NotificationSettings] Error fetching notification data` | API call failed | Check network, API endpoint |
| `Getting VAPID public key...` | Requesting VAPID key | Normal operation |
| `Push subscription created` | Browser subscription created | Normal operation |
| `Subscription saved to server` | Server registration successful | Normal operation |
| `[NotificationSettings] Error enabling notifications` | Subscription failed | Check browser support, permissions |

### Server-Side Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `[TimerCheck] Starting timer expiration check...` | Timer check started | Normal operation |
| `[TimerCheck] Found X enabled timer preference(s)` | Preferences found | Normal operation |
| `[TimerCheck] Timer check completed: X notification(s) sent` | Check completed successfully | Normal operation |
| `[TimerCheck] Error in checkTimerExpirations` | Timer check failed | Check error details |
| `[Cleanup] Starting cleanup operations...` | Cleanup started | Normal operation |
| `[Cleanup] ✓ Cleaned up X subscription(s)` | Cleanup successful | Normal operation |
| `[Cleanup] Error cleaning up` | Cleanup failed | Check error details |

### Cron Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `[Cron] Starting notification check...` | Cron job executing | Normal operation |
| `[Cron] ✓ Success (HTTP 200)` | API call successful | Normal operation |
| `[Cron] ✗ ERROR: API call failed` | API call failed | Check secret, endpoint URL |
| `[Cron] ERROR: NOTIFICATION_CRON_SECRET is not set` | Secret missing | Set environment variable |

## Testing & Verification

### How to Test Notifications

#### 1. Test Activity Notifications

1. Enable notifications in Settings
2. Enable "Activity Created" for a baby
3. Log an activity (feed, diaper, etc.)
4. Verify notification appears in browser
5. Check browser console for logs
6. Check server logs for notification sending

**Expected Logs:**
- Client: Activity logged
- Server: `notifyActivityCreated` called
- Server: Notification sent to subscription
- Browser: Notification displayed

#### 2. Test Timer Notifications

1. Enable timer notifications for a baby
2. Set a short warning time (e.g., 1 minute for testing)
3. Wait for timer to expire
4. Verify notification is received
5. Check cron logs for execution
6. Check timer check logs

**Expected Logs:**
- Cron: Successful API call
- Timer check: Timer expiration detected
- Timer check: Notification sent
- Browser: Notification displayed

#### 3. Test Cleanup

1. Create a subscription with high failure count (manually in DB)
2. Wait for cron execution
3. Verify subscription is deleted
4. Check cleanup logs

**Expected Logs:**
- Cleanup: Found subscription(s) to clean
- Cleanup: Deleted subscription(s)

### What Logs to Check

#### During Testing

1. **Browser Console:**
   - Component lifecycle
   - API call results
   - Error messages

2. **Server Logs:**
   - API endpoint calls
   - Notification sending
   - Timer checks
   - Cleanup operations

3. **Cron Logs:**
   - Execution timestamps
   - API call results
   - Error messages

### Verification Steps

1. **Verify Setup:**
   - [ ] VAPID keys generated
   - [ ] Environment variables set
   - [ ] Database migration applied
   - [ ] Cron job installed (if using timers)

2. **Verify Subscription:**
   - [ ] Browser permission granted
   - [ ] Service worker registered
   - [ ] Subscription in database
   - [ ] Preferences configured

3. **Verify Notifications:**
   - [ ] Activity notifications work
   - [ ] Timer notifications work (if enabled)
   - [ ] Notifications appear in browser
   - [ ] Notification clicks work

4. **Verify Cleanup:**
   - [ ] Failed subscriptions cleaned
   - [ ] Old logs cleaned
   - [ ] Cleanup runs during cron

### Testing Checklist

- [ ] Browser supports push notifications
- [ ] Notification permission granted
- [ ] Service worker registered
- [ ] Subscription created
- [ ] Preferences saved
- [ ] Activity notification received
- [ ] Timer notification received (if enabled)
- [ ] Cron job running (if using timers)
- [ ] Cleanup working
- [ ] Logs are being written
- [ ] No errors in logs

## Troubleshooting Common Issues

### Issue: Notifications Not Sending

**Check These Logs:**
1. Browser console: Subscription creation
2. Server logs: Notification sending attempts
3. Server logs: Error messages
4. Database: Subscription records

**Common Causes:**
- VAPID keys incorrect
- Subscription expired (410 Gone)
- Service worker not active
- Browser permission denied

### Issue: Cron Job Not Running

**Check These Logs:**
1. Docker startup: Cron daemon started
2. Cron logs: Execution timestamps
3. Server logs: API endpoint calls
4. System: `pgrep crond` returns PID

**Common Causes:**
- Cron daemon not started
- Cron job not installed
- `NOTIFICATION_CRON_SECRET` not set
- API endpoint URL incorrect

### Issue: Timer Notifications Not Working

**Check These Logs:**
1. Timer check: Preferences found
2. Timer check: Timer expiration detection
3. Timer check: Notification eligibility
4. Timer check: Notification sending
5. Cron logs: API call results

**Common Causes:**
- Timer preferences not enabled
- Warning times not set
- Last activity too recent
- Notification eligibility logic

### Issue: Cleanup Not Running

**Check These Logs:**
1. Cleanup: Cleanup start
2. Cleanup: Items found
3. Cleanup: Deletion results
4. Cron logs: Cleanup in response

**Common Causes:**
- Cleanup not called
- Retention period too long
- Database query issues

### Issue: Logs Not Appearing

**Check These:**
1. Log directory exists
2. File permissions
3. Docker volume mounts
4. Cron job log redirection

**Common Causes:**
- Log directory not created
- Permission denied
- Volume not mounted
- Cron job not writing to file

## Advanced Debugging

### Enabling Verbose Logging

**Client-Side:**
All logging is already enabled. Use browser DevTools to filter logs.

**Server-Side:**
All logging is already enabled. Check server stdout/stderr.

**Cron:**
Cron daemon runs with debug level 8: `crond -f -d 8`

### Debug Mode Configuration

No special debug mode needed - all logging is enabled by default for testing.

### Log Level Configuration

Currently, all log levels are enabled:
- `console.log` - Info messages
- `console.warn` - Warnings
- `console.error` - Errors

### Performance Monitoring

**Metrics to Monitor:**
- Timer check duration (logged in timerCheck)
- Cleanup duration (logged in cleanup)
- API response times (in cron logs)
- Notification sending success rate

**Log Patterns:**
- Look for `[TimerCheck] Timer check completed: X notification(s) sent in Yms`
- Look for `[Cleanup] Cleanup completed in Xms`

## Log Analysis

### How to Read Logs

1. **Start with timestamps** - Understand when events occurred
2. **Look for prefixes** - Filter by component (`[TimerCheck]`, `[Cleanup]`, etc.)
3. **Follow the flow** - Start → Process → Complete
4. **Check for errors** - Look for `ERROR` or `✗` markers
5. **Verify success** - Look for `✓` or success messages

### Pattern Recognition

**Successful Flow:**
```
[TimerCheck] Starting timer expiration check...
[TimerCheck] Found 2 enabled timer preference(s)
[TimerCheck] Processing baby clx...
[TimerCheck] Timer check completed: 2 notification(s) sent in 1250ms
```

**Error Pattern:**
```
[TimerCheck] Starting timer expiration check...
[TimerCheck] Error in checkTimerExpirations: Error: Database connection failed
```

### Error Pattern Identification

**Common Error Patterns:**

1. **Authentication Errors:**
   - `401 Unauthorized`
   - `NOTIFICATION_CRON_SECRET is not set`
   - Solution: Set secret in environment

2. **Database Errors:**
   - `Database connection failed`
   - `Prisma error`
   - Solution: Check database connection

3. **Network Errors:**
   - `Failed to fetch`
   - `Connection timeout`
   - Solution: Check network, API URL

4. **Subscription Errors:**
   - `410 Gone` - Subscription expired
   - `403 Forbidden` - Invalid subscription
   - Solution: Re-subscribe

### Performance Analysis

**Key Metrics:**
- Timer check duration (should be < 5 seconds)
- Cleanup duration (should be < 2 seconds)
- API response time (should be < 1 second)

**Performance Issues:**
- Large number of preferences (optimize queries)
- Slow database (check indexes)
- Network latency (check API URL)

## References

- **[PushNotifications-README.md](./PushNotifications-README.md)** - Main setup and reference guide
- **[PushNotifications-Implementation.md](./PushNotifications-Implementation.md)** - Implementation status
- **[PushNotificationPlan.md](./PushNotificationPlan.md)** - Original implementation plan

## Support

If you encounter issues not covered in this guide:

1. Check all relevant log locations
2. Review the main README for setup issues
3. Verify environment variables are correct
4. Test in different browsers
5. Check database for subscription/preference records
