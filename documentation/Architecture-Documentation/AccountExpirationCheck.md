# Account Expiration Check - Server-Side Implementation

## Overview

This document describes the implementation of server-side account expiration checking in SAAS mode. Expiration is **soft**: expired users stay logged in with read-only access — the server computes expiration status during authentication and blocks write operations, rather than logging users out.

## Problem Statement

Previously, account expiration was only checked client-side in the `family.tsx` context provider. This approach had several issues:
1. Users could potentially bypass client-side checks
2. Expired accounts could still make API calls until the client-side check kicked in
3. The check occurred every 30 seconds on the client, creating unnecessary overhead
4. Users with expired accounts could access the application if they disabled client-side JavaScript checks

## Solution

Account expiration is now checked **server-side** during the authentication process in `app/api/utils/auth.ts`. Every API request computes the account's expiration status; the result is attached to the auth context as `isExpired` (plus `trialEnds`, `planExpires`, `planType`, `betaparticipant`) rather than failing authentication. Write endpoints then enforce read-only access via `checkWritePermission()` in `app/api/utils/writeProtection.ts`, which returns 403 for expired accounts. Read endpoints continue to work.

## Implementation Details

### Location
The expiration check is implemented in the `getAuthenticatedUser()` function within `app/api/utils/auth.ts`.

### When the Check Occurs
The check runs during JWT token validation, specifically after verifying:
1. The account exists
2. The account is not closed

### Conditions for Expiration Check
The expiration check only runs when **all** of the following conditions are true:
- Deployment mode is SAAS (`DEPLOYMENT_MODE=saas`)
- Account has an associated family (setup is complete)
- Account is not a beta participant (`betaparticipant=false`)

The check runs for **both** auth paths: account-based auth checks the account directly, and PIN-based (caretaker) auth checks the family's linked account, if one exists. Families without a linked account are never marked expired.

### Expiration Logic
An account is considered expired if any of the following is true:

1. **Trial Expired**: `trialEnds` date is in the past
2. **Plan Expired**: No active trial AND `planExpires` date is in the past
3. **No Subscription**: No trial, no plan (`planType`), and not a beta participant

### Response When Expired
When an expired account accesses the API (soft expiration):
- Authentication still **succeeds** — `authenticated: true` with `isExpired: true` in the auth context
- Read (GET) requests succeed normally
- Write requests hit `checkWritePermission()` and receive HTTP 403 with a user-friendly error message; `data.expirationInfo` carries the type (`TRIAL_EXPIRED`, `PLAN_EXPIRED`, or `NO_PLAN`) and date
- Closed accounts (`closed=true`) are the hard-failure case: `authenticated: false`, HTTP 401

## Code Changes

### Modified File: `app/api/utils/auth.ts`

Inside `getAuthenticatedUser()`, after verifying the account exists (the same pattern is repeated for PIN-based tokens via the family's linked account):

```typescript
// Check if account is closed
if (account.closed) {
  console.log('Account authentication failed: Account is closed for ID:', decoded.accountId);
  return { authenticated: false, error: 'Account is closed' };
}

// Calculate expiration status in SAAS mode
// Only check if account has a family (no point checking expiration during setup)
const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';
let isExpired = false;

if (isSaasMode && account.family && !account.betaparticipant) {
  const now = new Date();

  // Check trial expiration
  if (account.trialEnds) {
    const trialEndDate = new Date(account.trialEnds);
    isExpired = now > trialEndDate;
  }
  // Check plan expiration (if no trial)
  else if (account.planExpires) {
    const planEndDate = new Date(account.planExpires);
    isExpired = now > planEndDate;
  }
  // No trial and no plan = expired
  else if (!account.planType) {
    isExpired = true;
  }
}
```

The computed `isExpired` (with `trialEnds`, `planExpires`, `planType`) is returned on the `AuthResult` — authentication is not rejected. Enforcement lives in `checkWritePermission()` (`app/api/utils/writeProtection.ts`), which mutation handlers call at the top:

```typescript
const writeCheck = checkWritePermission(authContext);
if (!writeCheck.allowed) return writeCheck.response; // 403 with expirationInfo
```

## Status Endpoint

The `/api/accounts/status` endpoint uses the standard `getAuthenticatedUser(req)`. Because expiration is soft, expired accounts can still authenticate and see their own status:

1. **Users need to see their expired status** - Since expiration never blocks authentication, the endpoint can report `accountStatus: 'expired'`
2. **Still secure** - Requires valid JWT token, so only the account owner can access
3. **No brute force risk** - Can't enumerate accounts without valid tokens
4. **Enables proper UX** - Client can display expiration warnings and renewal options

(There is no `skipExpirationCheck` parameter — the soft-expiration model made it unnecessary.)

## Impact on Client-Side Code

### Current Client-Side Check (`src/context/family.tsx`)
The client-side expiration check in `family.tsx` runs every 30 seconds in SAAS mode and reads the trial/plan dates embedded in the JWT payload. It is a **secondary/informational check**:
- Provides immediate feedback without waiting for an API call to fail
- Does **not** log the user out — soft expiration keeps expired users logged in
- Drives UI messaging (expiration banners and upgrade prompts)

However, the **primary** enforcement of expiration is on the server.

### What Happens When an Account Expires

1. **Server-side auth** → `isExpired: true` attached to the auth context; reads keep working
2. **Write requests** → `checkWritePermission()` returns 403 with `expirationInfo`
3. **Client-side check (family.tsx)** → Detects expiration from the JWT and shows expiration UI; the user remains logged in with read-only access

Both checks work together but the server-side check is the authoritative source.

## Performance Considerations

### Why This is Efficient
1. **No additional API calls**: The check happens during authentication, which already queries the database for account information
2. **Only runs in SAAS mode**: Self-hosted deployments skip the expiration calculation entirely
3. **Single database query**: For account auth, the existing `prisma.account.findUnique()` includes all necessary fields; for PIN-based tokens, one `prisma.family.findUnique()` (including the linked account) is performed per request
4. **Conditional execution**: Only calculated when the account has a family and is not a beta participant

### Database Query
The expiration check uses data already fetched in the authentication query:
```typescript
const account = await prisma.account.findUnique({
  where: { id: decoded.accountId },
  include: {
    family: { select: { id: true, slug: true } },
    caretaker: { select: { id: true, role: true, type: true, loginId: true } }
  }
});
```

No additional queries are required.

## Testing

### Test Cases
1. **Active subscription**: User with valid `trialEnds` or `planExpires` should read and write normally
2. **Expired trial**: User with `trialEnds` in the past should read normally but receive 403 on writes
3. **Expired plan**: User with `planExpires` in the past should read normally but receive 403 on writes
4. **Beta participant**: User with `betaparticipant=true` should never be marked expired regardless of dates
5. **Self-hosted mode**: All users should have full access (expiration calculation skipped)
6. **During setup**: Users without families should be authenticated (to complete setup)
7. **Closed account**: User with `closed=true` should receive 401

### How to Test Manually
1. Set `DEPLOYMENT_MODE=saas` in `.env`
2. Create a test account with expired trial: Set `trialEnds` to yesterday
3. Log in with the test account
4. Attempt a write to any API endpoint (e.g., `POST /api/diaper-log`)
5. Verify: Receives 403 with a trial-expired message and `data.expirationInfo`
6. Check: Reads still succeed and the UI shows expiration banners; the user stays logged in

## Security Benefits

1. **Server-side enforcement**: Cannot be bypassed by client-side manipulation
2. **Consistent across all API endpoints**: Every API call using an auth wrapper computes expiration; mutation endpoints enforce it via `checkWritePermission()`
3. **Closed accounts hard-fail**: `closed=true` returns 401 and blocks token refresh
4. **Refresh allowed for expired accounts**: Consistent with soft expiration — expired (but not closed) accounts can refresh their tokens and retain read-only access

## Backward Compatibility

### Self-Hosted Deployments
- **No impact**: Check only runs when `DEPLOYMENT_MODE=saas`
- Self-hosted deployments continue to work without any changes

### Beta Participants
- **No impact**: Check skips beta participants (`betaparticipant=true`)
- Beta participants retain unlimited access

### PIN-Based Authentication
- **Also covered**: PIN-based tokens are checked against the family's linked account (if any) — caretakers in an expired SaaS family get the same read-only treatment
- Families with no linked account (typical self-hosted) are unaffected

## Future Enhancements

### Potential Improvements
1. **Grace period**: Add a configurable grace period (e.g., 7 days) before enforcing expiration
2. **Renewal links**: Include renewal URL in error response
3. **Email notifications**: Send warning emails before expiration

(Already implemented since this doc was first written: read-only mode for expired accounts, and distinct error messages for trial vs. plan expiration vs. no plan in `checkWritePermission()`.)

### Configuration Options
Consider adding these environment variables:
- `EXPIRATION_GRACE_PERIOD_DAYS`: Grace period after expiration
- `EXPIRATION_WARNING_DAYS`: Days before expiration to show warning
- `EXPIRED_ACCOUNT_MODE`: `logout` | `readonly` | `limited`

## Related Files

- **Expiration calculation**: `app/api/utils/auth.ts` (`getAuthenticatedUser()`)
- **Write enforcement**: `app/api/utils/writeProtection.ts` (`checkWritePermission()`)
- **Client-side check**: `src/context/family.tsx` (30-second interval, soft check)
- **401 redirect logic**: `app/(app)/[slug]/layout.tsx`
- **Account status API**: `app/api/accounts/status/route.ts`
- **All API routes**: Any route using `withAuthContext`, `withAuth`, `withAccountOwner`

## Deployment Checklist

- [ ] Verify `DEPLOYMENT_MODE` environment variable is set correctly
- [ ] Test with expired account in staging environment (writes 403, reads succeed)
- [ ] Monitor for 403 write-protection responses from expired accounts
- [ ] Verify self-hosted deployments are not affected
- [ ] Test beta participant access
- [ ] Verify PIN-based authentication still works
- [ ] Check that setup flow allows unauthenticated accounts

## Rollback Plan

If issues arise, the change can be easily rolled back by:
1. Removing the `isExpired` calculation in `getAuthenticatedUser()` (`app/api/utils/auth.ts`) so it always stays `false` — `checkWritePermission()` then allows all writes
2. Redeploying the application
3. Client-side check in `family.tsx` will continue to provide basic protection

No database changes are required for this feature.
