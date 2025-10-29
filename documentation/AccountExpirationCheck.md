# Account Expiration Check - Server-Side Implementation

## Overview

This document describes the implementation of server-side account expiration checking to automatically log out users with expired subscriptions in SAAS mode.

## Problem Statement

Previously, account expiration was only checked client-side in the `family.tsx` context provider. This approach had several issues:
1. Users could potentially bypass client-side checks
2. Expired accounts could still make API calls until the client-side check kicked in
3. The check occurred every 30 seconds on the client, creating unnecessary overhead
4. Users with expired accounts could access the application if they disabled client-side JavaScript checks

## Solution

Account expiration is now checked **server-side** during the authentication process in `app/api/utils/auth.ts`. This ensures that every API request validates the account status before allowing access.

## Implementation Details

### Location
The expiration check is implemented in the `getAuthenticatedUser()` function within `app/api/utils/auth.ts`.

### When the Check Occurs
The check runs during JWT token validation for account-authenticated users, specifically after verifying:
1. The account exists
2. The account is not closed

### Conditions for Expiration Check
The expiration check only runs when **all** of the following conditions are true:
- Deployment mode is SAAS (`DEPLOYMENT_MODE=saas`)
- User is authenticated via account (not PIN-based auth)
- Account has an associated family (setup is complete)
- Account is not a beta participant (`betaparticipant=false`)

### Expiration Logic
An account is considered expired if any of the following is true:

1. **Trial Expired**: `trialEnds` date is in the past
2. **Plan Expired**: No active trial AND `planExpires` date is in the past
3. **No Subscription**: No trial, no plan (`planType`), and not a beta participant

### Response When Expired
When an expired account attempts to access the API:
- `authenticated: false`
- `error: 'Account subscription has expired'`
- HTTP status: 401 (Unauthorized)

## Code Changes

### Modified File: `app/api/utils/auth.ts`

Added the following check after line 137 (after verifying account exists):

```typescript
// Check if account is closed
if (account.closed) {
  console.log('Account authentication failed: Account is closed for ID:', decoded.accountId);
  return { authenticated: false, error: 'Account is closed' };
}

// Check account expiration in SAAS mode only
// Only check if account has a family (no point checking expiration during setup)
const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';
if (isSaasMode && account.family && !account.betaparticipant) {
  const now = new Date();
  let isExpired = false;

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

  if (isExpired) {
    console.log('Account authentication failed: Account subscription expired for ID:', decoded.accountId);
    return { authenticated: false, error: 'Account subscription has expired' };
  }
}
```

## Special Handling for Status Endpoint

### Why Status Endpoint Skips Expiration Check
The `/api/accounts/status` endpoint uses `getAuthenticatedUser(req, true)` with `skipExpirationCheck=true`. This is intentional because:

1. **Users need to see their expired status** - If the endpoint rejected expired accounts, they couldn't see that they're expired
2. **Still secure** - Requires valid JWT token, so only the account owner can access
3. **No brute force risk** - Can't enumerate accounts without valid tokens
4. **Enables proper UX** - Client can display expiration warnings and renewal options

This is the ONLY endpoint that should skip expiration checking. All other API endpoints enforce expiration.

## Impact on Client-Side Code

### Current Client-Side Check (`src/context/family.tsx`)
The client-side expiration check in `family.tsx` (lines 136-187) can now be considered a **secondary/fallback check**. It still serves a purpose:
- Provides immediate feedback without waiting for an API call to fail
- Handles the logout flow gracefully on the client side
- Shows appropriate UI messaging

However, the **primary** enforcement of expiration is now on the server.

### What Happens When a User is Logged Out

1. **Server-side check fails** → API returns 401
2. **Client receives 401** → Existing error handling triggers
3. **Layout.tsx handles 401** → Redirects to login (existing logic in lines 349-438)
4. **Client-side check (family.tsx)** → Also detects expiration and calls `onLogout()`

Both checks work together but the server-side check is the authoritative source.

## Performance Considerations

### Why This is Efficient
1. **No additional API calls**: The check happens during authentication, which already queries the database for account information
2. **Only runs in SAAS mode**: Self-hosted deployments skip this check entirely
3. **Single database query**: The existing `prisma.account.findUnique()` includes all necessary fields
4. **Conditional execution**: Only runs for account-based auth with families

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
1. **Active subscription**: User with valid `trialEnds` or `planExpires` should be authenticated
2. **Expired trial**: User with `trialEnds` in the past should receive 401
3. **Expired plan**: User with `planExpires` in the past should receive 401
4. **Beta participant**: User with `betaparticipant=true` should always be authenticated regardless of dates
5. **Self-hosted mode**: All users should be authenticated (expiration check skipped)
6. **During setup**: Users without families should be authenticated (to complete setup)
7. **Closed account**: User with `closed=true` should receive 401

### How to Test Manually
1. Set `DEPLOYMENT_MODE=saas` in `.env`
2. Create a test account with expired trial: Set `trialEnds` to yesterday
3. Log in with the test account
4. Attempt to access any API endpoint (e.g., `/api/diaper-log`)
5. Verify: Receives 401 with error message "Account subscription has expired"
6. Check: User is redirected to login page

## Security Benefits

1. **Server-side enforcement**: Cannot be bypassed by client-side manipulation
2. **Consistent across all API endpoints**: Every API call using `withAuthContext` automatically checks expiration
3. **Audit trail**: All expiration events are logged with account ID
4. **No token refresh**: Expired accounts cannot refresh their tokens to extend access

## Backward Compatibility

### Self-Hosted Deployments
- **No impact**: Check only runs when `DEPLOYMENT_MODE=saas`
- Self-hosted deployments continue to work without any changes

### Beta Participants
- **No impact**: Check skips beta participants (`betaparticipant=true`)
- Beta participants retain unlimited access

### PIN-Based Authentication
- **No impact**: Check only runs for account-based auth (`isAccountAuth=true`)
- Families using PIN-based login are unaffected

## Future Enhancements

### Potential Improvements
1. **Grace period**: Add a configurable grace period (e.g., 7 days) before enforcing expiration
2. **Custom error messages**: Different messages for trial vs. plan expiration
3. **Renewal links**: Include renewal URL in error response
4. **Email notifications**: Send warning emails before expiration
5. **Read-only mode**: Allow read-only access for expired accounts instead of full logout

### Configuration Options
Consider adding these environment variables:
- `EXPIRATION_GRACE_PERIOD_DAYS`: Grace period after expiration
- `EXPIRATION_WARNING_DAYS`: Days before expiration to show warning
- `EXPIRED_ACCOUNT_MODE`: `logout` | `readonly` | `limited`

## Related Files

- **Primary implementation**: `app/api/utils/auth.ts` (lines 139-171)
- **Client-side check**: `src/context/family.tsx` (lines 136-187)
- **Layout redirect logic**: `app/(app)/[slug]/layout.tsx` (lines 349-438)
- **Account status API**: `app/api/accounts/status/route.ts`
- **All API routes**: Any route using `withAuthContext`, `withAuth`, `withAccountOwner`

## Deployment Checklist

- [ ] Verify `DEPLOYMENT_MODE` environment variable is set correctly
- [ ] Test with expired account in staging environment
- [ ] Monitor logs for "Account subscription expired" messages
- [ ] Verify self-hosted deployments are not affected
- [ ] Test beta participant access
- [ ] Verify PIN-based authentication still works
- [ ] Check that setup flow allows unauthenticated accounts

## Rollback Plan

If issues arise, the change can be easily rolled back by:
1. Commenting out lines 139-171 in `app/api/utils/auth.ts`
2. Redeploying the application
3. Client-side check in `family.tsx` will continue to provide basic protection

No database changes are required for this feature.
