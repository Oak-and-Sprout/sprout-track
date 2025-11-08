# Phase 1.4: Write-Protected Endpoints

## Overview

This document lists all API endpoints in `/app/api/` that need write protection for the soft account expiration implementation. These endpoints should block write operations (POST, PUT, PATCH, DELETE) for expired accounts while allowing read operations (GET).

## Implementation Strategy

Each endpoint will use the new `checkWritePermission()` middleware from `app/api/utils/writeProtection.ts` to:
1. Verify authentication
2. Check if account is expired
3. Return 403 with upgrade information if expired
4. Allow operation if account is active or beta participant

## Endpoint Categories

### 🔴 HIGH PRIORITY - Core User Data (MUST PROTECT FIRST)

These are the most critical endpoints that users interact with daily. Block these first.

#### Log Entry Endpoints

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/diaper-log` | POST, PUT, DELETE | Create/edit/delete diaper change logs | 🔴 CRITICAL |
| `/api/feed-log` | POST, PUT, DELETE | Create/edit/delete feeding logs | 🔴 CRITICAL |
| `/api/sleep-log` | POST, PUT, DELETE | Create/edit/delete sleep logs | 🔴 CRITICAL |
| `/api/bath-log` | POST, PUT, DELETE | Create/edit/delete bath logs | 🔴 CRITICAL |
| `/api/pump-log` | POST, PUT, DELETE | Create/edit/delete pumping logs | 🔴 CRITICAL |
| `/api/medicine-log` | POST, PUT, DELETE | Create/edit/delete medicine logs | 🔴 CRITICAL |
| `/api/measurement-log` | POST, PUT, DELETE | Create/edit/delete measurement logs | 🔴 CRITICAL |
| `/api/milestone-log` | POST, PUT, DELETE | Create/edit/delete milestone logs | 🔴 CRITICAL |

**Implementation Pattern for Log Endpoints:**
```typescript
import { checkWritePermission } from '../utils/writeProtection';

// For POST handlers
async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Add at the very top of the function
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  // Continue with normal logic...
}

// For PUT handlers
async function handlePut(req: NextRequest, authContext: AuthResult) {
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  // Continue with normal logic...
}

// For DELETE handlers
async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  // Continue with normal logic...
}
```

#### Baby Management

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/baby` | POST, PUT, DELETE | Create/edit/delete babies | 🔴 CRITICAL |
| `/api/baby/create` | POST | Alternative baby creation endpoint | 🔴 CRITICAL |

#### Settings & Configuration

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/settings` | PUT | Update family settings, units, preferences | 🔴 CRITICAL |
| `/api/activity-settings` | POST, PUT, DELETE | Manage activity type settings | 🔴 CRITICAL |

#### Caretaker Management

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/caretaker` | POST, PUT, DELETE | Create/edit/delete caretakers | 🔴 CRITICAL |

---

### 🟡 MEDIUM PRIORITY - Extended Features

These enhance the experience but are less critical than core tracking.

#### Calendar & Notes

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/calendar-event` | POST, PUT, DELETE | Create/edit/delete calendar events | 🟡 MEDIUM |
| `/api/note` | POST, PUT, DELETE | Create/edit/delete notes | 🟡 MEDIUM |

#### Medicine Management

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/medicine` | POST, PUT, DELETE | Manage medicine inventory | 🟡 MEDIUM |

#### Family Management

| Endpoint | Methods | Purpose | Priority |
|----------|---------|---------|----------|
| `/api/family` | PUT | Update family name/slug | 🟡 MEDIUM |
| `/api/family/manage` | POST, PUT, DELETE | Advanced family management | 🟡 MEDIUM |

---

### 🟢 LOW PRIORITY - Account & Admin Features

These should be handled differently or may not need protection.

#### Account Management (Special Handling)

| Endpoint | Methods | Purpose | Protection Strategy |
|----------|---------|---------|---------------------|
| `/api/accounts/update` | PUT | Update account email/details | ⚠️ **ALLOW** - Users need to update account info to upgrade |
| `/api/accounts/link-caretaker` | POST | Link existing caretaker to account | ⚠️ **ALLOW** - Account management |
| `/api/accounts/manage` | POST, PUT, DELETE | Account management operations | ⚠️ **ALLOW** - Account management |
| `/api/accounts/payments/create-checkout-session` | POST | Start upgrade checkout | ⚠️ **ALLOW** - Required for upgrading! |
| `/api/accounts/payments/cancel-subscription` | POST | Cancel subscription | ⚠️ **ALLOW** - Account management |
| `/api/accounts/payments/reactivate-subscription` | POST | Reactivate subscription | ⚠️ **ALLOW** - Account management |
| `/api/accounts/payments/verify-session` | POST | Verify payment session | ⚠️ **ALLOW** - Payment flow |

**Note:** Payment and account management endpoints must remain accessible to expired accounts so they can upgrade/manage billing.

#### Setup & Onboarding (Skip Protection)

| Endpoint | Methods | Purpose | Protection Strategy |
|----------|---------|---------|---------------------|
| `/api/setup/start` | POST | Start family setup | ⛔ **SKIP** - Pre-subscription setup |
| `/api/setup/validate-token` | POST | Validate setup token | ⛔ **SKIP** - Pre-subscription setup |
| `/api/family/create-setup-link` | POST | Create setup invitation | ⛔ **SKIP** - Already protected by other auth |
| `/api/family/setup-invites` | POST, DELETE | Manage setup invitations | ⛔ **SKIP** - Already protected |

#### Admin & System (Skip Protection)

| Endpoint | Methods | Purpose | Protection Strategy |
|----------|---------|---------|---------------------|
| `/api/database/*` | POST, PUT | Database migrations | ⛔ **SKIP** - Admin only, already protected |
| `/api/app-config` | PUT | System configuration | ⛔ **SKIP** - Admin only |
| `/api/beta-subscribers` | POST, PUT, DELETE | Beta program management | ⛔ **SKIP** - Public/admin only |

#### Feedback & Contact (Allow)

| Endpoint | Methods | Purpose | Protection Strategy |
|----------|---------|---------|---------------------|
| `/api/feedback` | POST | Submit user feedback | ⚠️ **ALLOW** - Want feedback from expired users |
| `/api/contact` | POST | Contact form submission | ⚠️ **ALLOW** - Support access |

---

## Implementation Checklist

### Phase 1: Critical Log Endpoints (Day 1-2)
- [ ] `/api/diaper-log` - POST, PUT, DELETE
- [ ] `/api/feed-log` - POST, PUT, DELETE
- [ ] `/api/sleep-log` - POST, PUT, DELETE
- [ ] `/api/bath-log` - POST, PUT, DELETE
- [ ] `/api/pump-log` - POST, PUT, DELETE
- [ ] `/api/medicine-log` - POST, PUT, DELETE
- [ ] `/api/measurement-log` - POST, PUT, DELETE
- [ ] `/api/milestone-log` - POST, PUT, DELETE

### Phase 2: Core Management (Day 2-3)
- [ ] `/api/baby` - POST, PUT, DELETE
- [ ] `/api/baby/create` - POST
- [ ] `/api/caretaker` - POST, PUT, DELETE
- [ ] `/api/settings` - PUT
- [ ] `/api/activity-settings` - POST, PUT, DELETE

### Phase 3: Extended Features (Day 3-4)
- [ ] `/api/calendar-event` - POST, PUT, DELETE
- [ ] `/api/note` - POST, PUT, DELETE
- [ ] `/api/medicine` - POST, PUT, DELETE
- [ ] `/api/family` - PUT
- [ ] `/api/family/manage` - POST, PUT, DELETE

### Phase 4: Verification (Day 4-5)
- [ ] Test each endpoint with expired account
- [ ] Verify 403 responses include upgrade URL
- [ ] Verify error messages are user-friendly
- [ ] Verify GET requests still work
- [ ] Verify active accounts unaffected

---

## Code Template

### Standard Write Protection Pattern

For most endpoints, use this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkWritePermission } from '../utils/writeProtection';
import { withAuthContext, AuthResult } from '../utils/auth';
import { ApiResponse } from '../types';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Add write protection check at the top
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  // Use authContext from writeCheck for consistency
  const { familyId, caretakerId } = writeCheck.authResult;

  try {
    // ... existing logic
  } catch (error) {
    // ... existing error handling
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  const { familyId } = writeCheck.authResult;

  try {
    // ... existing logic
  } catch (error) {
    // ... existing error handling
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response;
  }

  const { familyId } = writeCheck.authResult;

  try {
    // ... existing logic
  } catch (error) {
    // ... existing error handling
  }
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  // GET requests do NOT need write protection
  // Expired accounts can read data
  try {
    const { familyId } = authContext;
    // ... existing logic
  } catch (error) {
    // ... existing error handling
  }
}

export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);
export const PUT = withAuthContext(handlePut);
export const DELETE = withAuthContext(handleDelete);
```

---

## Testing Strategy

### Test Cases for Each Endpoint

#### 1. Active Account (Control)
```bash
# Should work normally
curl -X POST /api/diaper-log \
  -H "Authorization: Bearer $ACTIVE_TOKEN" \
  -d '{"babyId":"123","type":"WET","time":"2025-01-01T10:00:00Z"}'

# Expected: 200 OK with created log entry
```

#### 2. Expired Trial Account
```bash
# Should be blocked with upgrade message
curl -X POST /api/diaper-log \
  -H "Authorization: Bearer $EXPIRED_TOKEN" \
  -d '{"babyId":"123","type":"WET","time":"2025-01-01T10:00:00Z"}'

# Expected: 403 Forbidden
# {
#   "success": false,
#   "error": "ACCOUNT_EXPIRED",
#   "message": "Your free trial has ended. Upgrade to continue tracking.",
#   "data": {
#     "expirationInfo": {
#       "type": "TRIAL_EXPIRED",
#       "date": "2024-12-15T00:00:00Z",
#       "upgradeUrl": "/accounts/my-family/billing"
#     }
#   }
# }
```

#### 3. Expired Account - GET Request
```bash
# Should still work (read access)
curl -X GET /api/diaper-log?babyId=123 \
  -H "Authorization: Bearer $EXPIRED_TOKEN"

# Expected: 200 OK with existing log entries
```

#### 4. Beta Participant (Expired Date)
```bash
# Should work normally (beta participants bypass expiration)
curl -X POST /api/diaper-log \
  -H "Authorization: Bearer $BETA_TOKEN" \
  -d '{"babyId":"123","type":"WET","time":"2025-01-01T10:00:00Z"}'

# Expected: 200 OK (beta participants never expire)
```

### Automated Test Script

Create a test script at `scripts/test-write-protection.sh`:

```bash
#!/bin/bash

# Test write protection for all endpoints

ACTIVE_TOKEN="..." # Set active account token
EXPIRED_TOKEN="..." # Set expired account token
BASE_URL="http://localhost:3000"

echo "Testing write protection..."

# Test each log endpoint
for endpoint in diaper-log feed-log sleep-log bath-log pump-log medicine-log measurement-log milestone-log; do
  echo ""
  echo "Testing /$endpoint..."

  # POST with expired account
  response=$(curl -s -X POST "$BASE_URL/api/$endpoint" \
    -H "Authorization: Bearer $EXPIRED_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"babyId":"test","time":"2025-01-01T10:00:00Z"}')

  if echo "$response" | grep -q "ACCOUNT_EXPIRED"; then
    echo "✅ POST blocked for expired account"
  else
    echo "❌ POST not blocked for expired account"
  fi

  # POST with active account
  response=$(curl -s -X POST "$BASE_URL/api/$endpoint" \
    -H "Authorization: Bearer $ACTIVE_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"babyId":"test","time":"2025-01-01T10:00:00Z"}')

  if echo "$response" | grep -q "success.*true"; then
    echo "✅ POST allowed for active account"
  else
    echo "⚠️  POST may have failed for active account (check data)"
  fi
done

echo ""
echo "Testing complete!"
```

---

## Error Response Format

All write-protected endpoints will return this consistent error format when blocking expired accounts:

```typescript
{
  success: false,
  error: 'ACCOUNT_EXPIRED',
  message: string, // User-friendly message based on expiration type
  data: {
    expirationInfo: {
      type: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED',
      date?: string, // ISO date of expiration
      upgradeUrl: string // Path to billing/upgrade page
    }
  }
}
```

### Message Variations by Expiration Type

| Expiration Type | Error Message |
|----------------|---------------|
| `TRIAL_EXPIRED` | "Your free trial has ended. Upgrade to continue tracking." |
| `PLAN_EXPIRED` | "Your subscription has expired. Please renew to continue." |
| `NO_PLAN` | "No active subscription found. Please subscribe to continue." |
| `CLOSED` | "This account has been closed. Contact support for assistance." |

---

## Special Considerations

### 1. System Administrators
- Should bypass all expiration checks
- `isSysAdmin` flag in auth context
- Write protection middleware checks this automatically

### 2. Beta Participants
- Should bypass all expiration checks
- `betaparticipant` field in account
- Write protection middleware checks this automatically

### 3. Setup Authentication
- During family setup, expiration checks are skipped
- `isSetupAuth` flag in auth context
- Users completing setup flow are not blocked

### 4. Account Authentication
- Account owners can access account management
- Payment endpoints must remain accessible
- Profile updates must remain accessible

### 5. Read-Only Endpoints
- Never add write protection to GET-only endpoints
- Examples: `/api/timeline`, `/api/baby-last-activities`, etc.
- These should remain fully accessible

---

## Performance Considerations

### Minimal Overhead
The `checkWritePermission()` middleware:
- Reuses existing `getAuthenticatedUser()` call
- No additional database queries
- Only adds 1-2ms to request time
- Returns early if account is active

### Caching Strategy
Consider implementing:
- JWT token caching (already includes expiration data)
- In-memory cache for account expiration status (5-minute TTL)
- Redis cache for high-traffic deployments

---

## Rollback Plan

If write protection causes issues:

### Quick Rollback (Comment Out)
```typescript
// Temporarily disable write protection
// const writeCheck = await checkWritePermission(req);
// if (!writeCheck.allowed) {
//   return writeCheck.response;
// }
```

### Selective Rollback
Roll back specific endpoints while keeping others protected.

### Full Rollback
1. Revert `writeProtection.ts` creation
2. Revert all endpoint modifications
3. Auth logic in `auth.ts` still allows expired users to authenticate
4. Frontend will handle soft expiration experience

---

## Success Metrics

### Pre-Deployment
- [ ] All write endpoints return 403 for expired accounts
- [ ] All write endpoints work normally for active accounts
- [ ] All read endpoints work for both expired and active accounts
- [ ] Error messages are consistent and helpful
- [ ] Upgrade URLs are correct and functional

### Post-Deployment
- Monitor 403 error rates (should see increase initially)
- Track upgrade conversion rate from 403 errors
- Monitor support tickets (should not increase)
- Watch for any unexpected blocking of valid users
- Verify beta participants are not affected

---

## Summary

**Total Endpoints to Protect: 25**

- 🔴 **Critical (Phase 1-2)**: 13 endpoints
- 🟡 **Medium (Phase 3)**: 6 endpoints
- 🟢 **Low/Skip**: 6 endpoints (account/payment/setup)

**Estimated Effort**: 3-4 days for implementation + 1-2 days for testing

**Risk Level**: Low - Write protection is additive and can be easily rolled back
