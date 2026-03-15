# Push Notifications Code Review Plan

## Overview

This document provides a comprehensive code review of the push notification system for Sprout Track, organized into three phases as requested:
1. Code Review & Functionality Viability
2. Edge Case Handling & Enhancement Recommendations
3. Documentation Cleanup

**User Requirements:**
- **Timeline:** Production deployment soon - critical security issues must be fixed first
- **Localization:** Implement server-side i18n for notification text
- **Documentation:** Update inaccuracies and add missing sections, keep current structure

---

## Phase 1: Code Review & Functionality Viability

### 1.1 Critical Issues (Must Fix)

#### 1.1.1 ~~Security: Empty Cron Secret by Default~~ - PARTIALLY MITIGATED
- **Files:** `scripts/setup-notification-cron.ts` (lines 129-132), `scripts/env-update.sh` (line 53)
- **Current Status:**
  - The cron setup script **does validate** that `NOTIFICATION_CRON_SECRET` is set and exits with error if not
  - However, `env-update.sh` creates an empty placeholder: `NOTIFICATION_CRON_SECRET=`
  - VAPID keys are auto-generated but cron secret is NOT auto-generated
- **Remaining Issue:** User must manually set the cron secret before timer notifications work
- **Enhancement:** Auto-generate cron secret in `env-update.sh` like it does for `ENC_HASH`
- **Fix:** Add to `scripts/env-update.sh`:
  ```bash
  CRON_SECRET=$(openssl rand -hex 32)
  echo "NOTIFICATION_CRON_SECRET=\"$CRON_SECRET\"" >> "$ENV_FILE"
  ```

#### 1.1.2 Security: Non-Timing-Safe Secret Comparison
- **File:** [app/api/notifications/cron/route.ts:51](app/api/notifications/cron/route.ts#L51)
- **Issue:** `providedSecret !== expectedSecret` is vulnerable to timing attacks
- **Fix:** Use `crypto.timingSafeEqual()` for constant-time comparison

#### 1.1.3 Race Condition: Timer Notification State Update
- **File:** [src/lib/notifications/timerCheck.ts:314-318](src/lib/notifications/timerCheck.ts#L314-L318) (also lines 375-379)
- **Issue:** `lastTimerNotifiedAt` is updated AFTER sending notification. If app crashes between send and update, duplicate notifications will be sent
- **Fix:** Either:
  - Update `lastTimerNotifiedAt` BEFORE sending (optimistic)
  - Use database transaction to atomically update and send

#### 1.1.4 Silent Failure: Invalid Warning Time Returns 0
- **File:** [src/lib/notifications/timerCheck.ts:13-20](src/lib/notifications/timerCheck.ts#L13-L20)
- **Issue:** `parseWarningTime()` returns 0 on invalid format, which causes timer checks to be silently skipped (line 281, 342: `thresholdMinutes > 0`)
- **Impact:** Users with invalid warning time data never receive timer notifications with no indication
- **Fix:** Return -1 or throw error for invalid format, handle explicitly

#### 1.1.5 Localization Violation: Hardcoded English Strings
- **Files:** Per CLAUDE.md, all user-facing text must use the localization system
- **Affected locations:**
  - [src/lib/notifications/activityHook.ts:117-118](src/lib/notifications/activityHook.ts#L117-L118): `"${activityName} logged for ${babyName}"`, `"A new ${activityName.toLowerCase()} was logged"`
  - [src/lib/notifications/timerCheck.ts:158-159](src/lib/notifications/timerCheck.ts#L158-L159): `"Feed Timer Expired"`, `"hasn't had a feed in ${timeElapsed}"`
  - [src/lib/notifications/timerCheck.ts:146-151](src/lib/notifications/timerCheck.ts#L146-L151): Time elapsed formatting
- **Fix:** Implement server-side i18n for notifications:
  1. Create `src/lib/notifications/i18n.ts` - server-side translation utility that loads from `/src/localization/translations/*.json`
  2. Query user's language preference from database (Account.language or Caretaker.language field)
  3. Pass language context through notification functions
  4. Add translation keys to `en.json`, `es.json`, `fr.json`:
     - `"Feed logged for {babyName}"`, `"Diaper logged for {babyName}"`, etc.
     - `"Feed Timer Expired"`, `"Diaper Timer Expired"`
     - `"{babyName} hasn't had a {activityType} in {timeElapsed}"`
     - Time elapsed patterns: `"{hours} hour"`, `"{hours} hours"`, `"{minutes} minute"`, `"{minutes} minutes"`

### 1.2 High Priority Issues

#### 1.2.1 Docker: Cron Daemon Reliability & Visibility
- **File:** [docker-startup.sh:119-126](docker-startup.sh#L119-L126)
- **Issue:** Cron daemon is backgrounded but not monitored. If it crashes, notifications stop without recovery
- **Impact:** Timer notifications silently stop working
- **Enhancement:** Add notification system status indicator in family-manager/Settings for sysadmins

**NEW FEATURE: Notification System Status Indicator**
- **Location:** Add to `AppConfigForm` component (`src/components/forms/AppConfigForm/index.tsx`)
- **UI:** New "Notification System" section with status indicators
- **Status checks:**
  1. ENABLE_NOTIFICATIONS flag status
  2. VAPID keys configured (non-empty)
  3. NOTIFICATION_CRON_SECRET configured (non-empty)
  4. Last successful cron execution (query NotificationLog for recent entries)
  5. Cron daemon running (new API endpoint to check)
- **API endpoint needed:** `GET /api/notifications/status` - returns system health
- **Display:** Green/Yellow/Red status badges with explanatory text
- **Example UI:**
  ```
  Notification System Status
  ├── Feature Enabled: ✅ Enabled
  ├── VAPID Keys: ✅ Configured
  ├── Cron Secret: ✅ Configured
  ├── Cron Daemon: ✅ Running (PID: 42)
  └── Last Cron Run: ✅ 2 minutes ago (sent 3 notifications)
  ```

#### 1.2.2 Error Handling: Generic `any` Type in Error Handling
- **File:** [src/lib/notifications/push.ts:91-94](src/lib/notifications/push.ts#L91-L94)
- **Issue:** `catch (error: any)` defeats TypeScript protection, assumes error structure
- **Fix:** Use proper error type narrowing or web-push error types

#### 1.2.3 ~~Client Security: Auth Token in localStorage~~ - NOT NOTIFICATION-SPECIFIC
- **File:** [src/lib/notifications/client.ts:41](src/lib/notifications/client.ts#L41) (also lines 209, 283, 354)
- **Issue:** Auth tokens in localStorage are vulnerable to XSS attacks
- **Finding:** This is the **standard pattern used throughout the entire app** - not a notification-specific issue
- **Used in:** All client-side API calls across the codebase (family-manager, settings, activity logging, etc.)
- **Note:** The architecture includes cookie fallback for backward compatibility (`withAuthContext` checks `caretakerId` cookie)
- **Action:** OUT OF SCOPE for this review - this is a broader architectural decision that affects the whole app
- **Future consideration:** Consider migrating to HttpOnly cookies for all API auth

#### 1.2.4 Memory: Global VAPID Key Cache Never Invalidates
- **File:** [src/lib/notifications/client.ts:7](src/lib/notifications/client.ts#L7)
- **Issue:** `cachedVapidKey` is never cleared - if VAPID key is rotated server-side, clients won't pick up new key until full page refresh
- **Fix:** Add TTL-based cache invalidation

### 1.3 Medium Priority Issues

#### 1.3.1 Input Validation: Endpoint URL Not Validated
- **File:** [app/api/notifications/subscribe/route.ts:38-62](app/api/notifications/subscribe/route.ts)
- **Issue:** Push endpoint URL accepted without validation (HTTPS required, length limits, valid URL format)
- **Fix:** Validate endpoint is a valid HTTPS URL with reasonable length

#### 1.3.2 Input Validation: Activity Types JSON Not Validated
- **File:** [app/api/notifications/preferences/route.ts:198-207](app/api/notifications/preferences/route.ts)
- **Issue:** `activityTypes` accepts any JSON string without validating against valid activity type enum values
- **Fix:** Validate array contents against known activity types

#### 1.3.3 Input Validation: timerIntervalMinutes No Range Check
- **File:** [app/api/notifications/preferences/route.ts:223-228](app/api/notifications/preferences/route.ts)
- **Issue:** Accepts any number without validating against allowed intervals (15, 30, 60, 120, null)
- **Fix:** Validate against allowed values or reasonable range

#### 1.3.4 Silent Logging Failure
- **File:** [src/lib/notifications/push.ts:142-145](src/lib/notifications/push.ts#L142-L145)
- **Issue:** If database logging fails, notification is still sent but not logged, creating audit gaps
- **Impact:** No way to know notifications were sent without logs

#### 1.3.5 Service Worker: Overly Strict Window Matching
- **File:** [public/sw.js:45-49](public/sw.js#L45-L49)
- **Issue:** Only focuses windows with `client.url === '/'`, which is overly strict
- **Impact:** Opens unnecessary new windows instead of focusing existing app window

#### 1.3.6 Cleanup: Unsafe parseInt for Retention Days
- **File:** [src/lib/notifications/cleanup.ts:137-139](src/lib/notifications/cleanup.ts)
- **Issue:** `parseInt()` without validation could return `NaN` for invalid input
- **Fix:** Use `parseInt(env, 10) || 30` with explicit bounds validation

### 1.4 Functionality Assessment

**Overall:** The implementation is **functionally viable** but has significant issues that should be addressed before production use.

**Working correctly:**
- VAPID key generation and storage
- Push subscription creation and storage
- Activity notification triggering on log creation
- Timer expiration detection logic
- Cleanup of failed subscriptions and old logs
- Service worker push event handling
- UI component for managing subscriptions and preferences

**Areas needing attention:**
- Security hardening (cron secret, timing attacks)
- Error handling robustness
- Localization compliance
- Race condition in timer notifications
- Input validation

---

## Phase 2: Edge Case Handling & Enhancement Recommendations

### 2.1 Edge Cases to Handle

#### 2.1.1 New Baby with No Activities
- **Current:** Timer check queries last activity, returns null, notification skipped
- **Issue:** New babies without any logged activities never get timer notifications
- **Recommendation:** Consider using baby's creation date or a configurable "start monitoring" time

#### 2.1.2 Subscription Key Extraction Failure
- **File:** [src/lib/notifications/client.ts:216-225](src/lib/notifications/client.ts#L216-L225)
- **Current:** `getKey()` can return null, leading to unclear error
- **Recommendation:** Add specific error message: "Subscription keys unavailable - browser may not support push notifications"

#### 2.1.3 Service Worker Activation Timeout
- **File:** [src/lib/notifications/client.ts:85-115](src/lib/notifications/client.ts#L85-L115)
- **Current:** No timeout mechanism - could hang indefinitely
- **Recommendation:** Add timeout (e.g., 30 seconds) and clear error message

#### 2.1.4 VAPID Key Rotation
- **Current:** Clients cache VAPID key forever
- **Recommendation:** Add cache TTL or server-side key version header to detect rotation

#### 2.1.5 Failed Notification Retry
- **Current:** Failed activity notifications have no retry mechanism; timer notifications only retry on next cron cycle
- **Recommendation:** Implement exponential backoff retry queue for transient failures

#### 2.1.6 Concurrent Preference Updates
- **File:** [app/api/notifications/preferences/route.ts:210-231](app/api/notifications/preferences/route.ts)
- **Current:** Upsert could hit unique constraint race condition
- **Recommendation:** Add proper P2002 error handling with retry

### 2.2 Enhancement Recommendations

#### 2.2.1 Rate Limiting
- **Priority:** High
- **Description:** Add rate limiting to notification API endpoints to prevent abuse
- **Affected endpoints:** subscribe, preferences, subscriptions
- **Recommendation:** Use existing rate limiting pattern from other endpoints (e.g., resend-verification)

#### 2.2.2 Notification Delivery Metrics
- **Priority:** Medium
- **Description:** Track success/failure rates, latency, cleanup statistics
- **Benefit:** Identify issues early, monitor system health

#### 2.2.3 Quiet Hours
- **Priority:** Medium
- **Description:** Allow users to configure "do not disturb" periods
- **Already mentioned:** In PushNotificationPlan.md as future enhancement

#### 2.2.4 Batch Timer Check
- **Priority:** Medium
- **Description:** Currently sends individual notifications sequentially
- **Recommendation:** Batch notifications for same subscription to reduce API calls

#### 2.2.5 VAPID Key Validation
- **Priority:** Medium
- **Description:** Validate VAPID key format/length at startup
- **File:** [src/lib/notifications/push.ts:16-17](src/lib/notifications/push.ts#L16-L17)

#### 2.2.6 Cron Job Mutex
- **Priority:** Medium
- **Description:** Prevent overlapping cron executions if one takes longer than 1 minute
- **Recommendation:** Add lock file or database flag

#### 2.2.7 Subscription Verification
- **Priority:** Low
- **Description:** Verify subscription endpoint is valid by sending test notification on registration
- **Benefit:** Early detection of invalid subscriptions

#### 2.2.8 Notification Sound Customization
- **Priority:** Low
- **Already mentioned:** In PushNotificationPlan.md as future enhancement

---

## Phase 3: Documentation Cleanup

### 3.1 Documentation Consolidation

The current documentation structure has overlap and could be streamlined:

**Current files:**
1. `documentation/PushNotificationPlan.md` - Original implementation plan
2. `documentation/PushNotifications-Implementation.md` - Implementation status
3. `documentation/PushNotifications-README.md` - Setup and reference guide
4. `documentation/PushNotifications-Logging-Debugging.md` - Logging and debugging guide

**Recommendations:**

#### 3.1.1 Archive the Plan
- `PushNotificationPlan.md` was useful during implementation but is now mostly redundant
- **Action:** Move to `documentation/archive/` or add "HISTORICAL" header noting it's superseded by Implementation.md

#### 3.1.2 Consolidate README and Implementation
- Both files contain overlapping setup instructions, file lists, and API references
- **Action:** Merge into single `PushNotifications-README.md` with clear sections:
  - Quick Start
  - Configuration
  - API Reference
  - Architecture
  - Troubleshooting (link to debugging guide)
  - Implementation Status/Changelog

#### 3.1.3 Keep Debugging Guide Separate
- `PushNotifications-Logging-Debugging.md` is appropriately focused
- **Action:** Keep as-is, it serves a distinct purpose

### 3.2 Documentation Updates Needed

#### 3.2.1 Update Implementation Status
- **File:** `documentation/PushNotifications-Implementation.md`
- **Update needed:** Line 7 says "Phases 0-10 Complete" but README says "Phases 0-13 Complete"
- Clarify which is accurate

#### 3.2.2 Add Security Considerations Section
- **Missing:** Documentation doesn't cover:
  - NOTIFICATION_CRON_SECRET requirements (length, generation)
  - VAPID key security
  - Rate limiting recommendations
- **Action:** Add security section to README

#### 3.2.3 Add Environment Variable Validation Requirements
- **Missing:** Documentation doesn't specify:
  - NOTIFICATION_CRON_SECRET must be non-empty for timer notifications
  - NOTIFICATION_LOG_RETENTION_DAYS must be positive integer
- **Action:** Add validation requirements to configuration section

#### 3.2.4 Document Known Limitations
- **Add to README:**
  - Localization not yet implemented for notification text
  - Timer notifications require cron daemon
  - No retry mechanism for failed activity notifications
  - VAPID key rotation requires re-subscription

#### 3.2.5 Fix Cross-References
- Some internal links between documentation files may be broken or outdated
- **Action:** Verify all links work

### 3.3 Proposed Documentation Structure

```
documentation/
├── PushNotifications-README.md          # Main reference (consolidated)
├── PushNotifications-Logging-Debugging.md  # Keep as-is
└── archive/
    └── PushNotificationPlan.md          # Historical reference
```

---

## Summary of Recommended Actions

### Immediate (Before Production) - Must Complete
1. **Fix timing-safe comparison in cron endpoint** - Prevent timing attacks
2. **Address race condition in timer notification state update** - Prevent duplicate notifications
3. **Implement server-side i18n for notifications** - Required per CLAUDE.md guidelines
4. **Fix parseWarningTime to not silently fail** - Users with invalid data get no notifications

### High Priority (Production Hardening)
5. **Auto-generate NOTIFICATION_CRON_SECRET in setup** - Currently requires manual setup
6. **Add notification system status indicator** - New feature for sysadmin visibility in Settings
7. Add input validation for endpoints (HTTPS, length) and preferences (activity types enum)
8. Fix service worker window matching logic

### Medium Priority (Can Ship Without)
9. Add VAPID key format validation at startup
10. Add rate limiting to notification endpoints
11. Add VAPID key cache TTL in client
12. Fix cleanup.ts parseInt validation
13. Documentation updates

### Deferred (Backlog)
14. Add notification delivery metrics
15. Implement quiet hours feature
16. Add exponential backoff retry mechanism
17. Add cron job mutex/lock
18. Handle new baby edge case for timers

---

## Implementation Order for Fixes

### Step 1: Security Fixes (Cron Endpoint)
**File:** `app/api/notifications/cron/route.ts`
```typescript
// Add at top:
import crypto from 'crypto';

// Replace line 51:
// OLD: if (providedSecret !== expectedSecret)
// NEW:
const secretBuffer = Buffer.from(expectedSecret, 'utf8');
const providedBuffer = Buffer.from(providedSecret, 'utf8');
if (secretBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(secretBuffer, providedBuffer)) {
```

### Step 2: Race Condition Fix (Timer Check)
**File:** `src/lib/notifications/timerCheck.ts`
- Move `lastTimerNotifiedAt` update BEFORE `sendTimerNotification()` call
- Wrap in try/catch to rollback timestamp if send fails

### Step 3: Warning Time Validation
**File:** `src/lib/notifications/timerCheck.ts`
- Change `parseWarningTime()` to return `-1` on invalid format
- Add explicit check and logging for invalid warning times

### Step 4: Server-Side i18n Implementation
**New File:** `src/lib/notifications/i18n.ts`
```typescript
import fs from 'fs';
import path from 'path';

type TranslationMap = Record<string, string>;
const translationCache: Record<string, TranslationMap> = {};

export function loadTranslations(lang: string): TranslationMap {
  if (translationCache[lang]) return translationCache[lang];

  const filePath = path.join(process.cwd(), 'src/localization/translations', `${lang}.json`);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    translationCache[lang] = JSON.parse(content);
    return translationCache[lang];
  } catch {
    if (lang !== 'en') return loadTranslations('en');
    return {};
  }
}

export function t(key: string, lang: string, replacements?: Record<string, string>): string {
  const translations = loadTranslations(lang);
  let text = translations[key] || key;
  if (replacements) {
    Object.entries(replacements).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, v);
    });
  }
  return text;
}
```

**Modify:** `src/lib/notifications/activityHook.ts` and `timerCheck.ts`
- Import `t` from `./i18n`
- Query subscription's user language from Account/Caretaker record
- Replace hardcoded strings with translation calls

**Add to** `src/localization/translations/en.json`:
```json
{
  "notification.activity.title": "{activityName} logged for {babyName}",
  "notification.activity.body": "A new {activityName} was logged",
  "notification.timer.feed.title": "Feed Timer Expired",
  "notification.timer.diaper.title": "Diaper Timer Expired",
  "notification.timer.body": "{babyName} hasn't had a {activityType} in {timeElapsed}",
  "time.hours": "{count} hour",
  "time.hours.plural": "{count} hours",
  "time.minutes": "{count} minute",
  "time.minutes.plural": "{count} minutes"
}
```

### Step 5: Input Validation
**File:** `app/api/notifications/subscribe/route.ts`
- Validate endpoint is valid HTTPS URL
- Add length limit (2048 chars)

**File:** `app/api/notifications/preferences/route.ts`
- Validate activityTypes against known enum values
- Validate timerIntervalMinutes against allowed values (null, 15, 30, 60, 120)

### Step 6: Notification System Status Indicator (New Feature)

**New API Endpoint:** `app/api/notifications/status/route.ts`
```typescript
// GET /api/notifications/status
// Returns notification system health status for sysadmin dashboard
// Requires sysadmin authentication

interface NotificationStatus {
  enabled: boolean;
  vapidConfigured: boolean;
  cronSecretConfigured: boolean;
  lastCronRun: {
    timestamp: Date | null;
    notificationsSent: number;
    success: boolean;
  } | null;
  subscriptionCount: number;
  failedSubscriptionCount: number;
}
```

**Implementation:**
1. Check `process.env.ENABLE_NOTIFICATIONS === 'true'`
2. Check `process.env.VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are non-empty
3. Check `process.env.NOTIFICATION_CRON_SECRET` is non-empty
4. Query `NotificationLog` for most recent entry to get last cron run time
5. Query `PushSubscription` count and failed subscription count

**UI Component:** Add to `src/components/forms/AppConfigForm/index.tsx`
- New section after "Email Configuration"
- Use Bell icon (from lucide-react)
- Status badges with colors:
  - Green (CheckCircle): Configured/Running/Recent
  - Yellow (AlertCircle): Warning (e.g., no recent cron runs)
  - Red (XCircle): Not configured/Failed
- Conditionally show only when `ENABLE_NOTIFICATIONS === 'true'`

### Step 7: Auto-generate Cron Secret
**File:** `scripts/env-update.sh`
- Add section after ENC_HASH generation to auto-generate `NOTIFICATION_CRON_SECRET`
- Same pattern: check if empty, generate with `openssl rand -hex 32`

### Step 8: Documentation Updates
**File:** `documentation/PushNotifications-Implementation.md`
- Fix status: clarify "Phases 0-10" vs "0-13" discrepancy

**File:** `documentation/PushNotifications-README.md`
- Add Security Considerations section
- Document NOTIFICATION_CRON_SECRET requirements (must be non-empty, recommend 32+ chars)
- Add Known Limitations section

---

## Files Requiring Modification

| Priority | File | Changes Needed |
|----------|------|----------------|
| Critical | `app/api/notifications/cron/route.ts` | Timing-safe comparison |
| Critical | `src/lib/notifications/timerCheck.ts` | Race condition fix, warning time validation |
| Critical | `src/lib/notifications/i18n.ts` | **NEW FILE** - Server-side translation utility |
| Critical | `src/lib/notifications/activityHook.ts` | Use i18n for notification text |
| Critical | `src/localization/translations/en.json` | Add notification translation keys |
| Critical | `src/localization/translations/es.json` | Add notification translation keys |
| Critical | `src/localization/translations/fr.json` | Add notification translation keys |
| High | `scripts/env-update.sh` | Auto-generate NOTIFICATION_CRON_SECRET |
| High | `app/api/notifications/status/route.ts` | **NEW FILE** - Notification system health check API |
| High | `src/components/forms/AppConfigForm/index.tsx` | Add Notification System Status section |
| High | `src/lib/notifications/push.ts` | Error type handling |
| Medium | `app/api/notifications/subscribe/route.ts` | Endpoint validation |
| Medium | `app/api/notifications/preferences/route.ts` | Input validation |
| Medium | `src/lib/notifications/client.ts` | Cache TTL, timeout handling |
| Medium | `src/lib/notifications/cleanup.ts` | parseInt validation |
| Medium | `public/sw.js` | Window matching fix |
| Low | `documentation/PushNotifications-Implementation.md` | Fix status discrepancy |
| Low | `documentation/PushNotifications-README.md` | Add security & limitations sections |
