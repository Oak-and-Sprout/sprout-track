# Soft Account Expiration - Action List

## Overview

This action list breaks down the soft account expiration implementation into discrete, actionable tasks. Each task references the implementation plan and lists all files that need to be modified or used for context.

**Primary Documentation**: [soft-account-expiration-implementation.md](./soft-account-expiration-implementation.md)

**Endpoint Protection Details**: [phase-1-4-write-protected-endpoints.md](./phase-1-4-write-protected-endpoints.md)

**IMPORTANT: Deployment Mode Compatibility**

All soft expiration features are **only active in SaaS mode** (`DEPLOYMENT_MODE=saas`). In self-hosted mode, the system maintains backward compatibility with no expiration enforcement. This is enforced at:
- **Backend**: Via `process.env.DEPLOYMENT_MODE === 'saas'` checks in auth middleware
- **Frontend**: Via `useDeployment` hook from `app/context/deployment.tsx` (check `isSaasMode`)

In self-hosted mode, all accounts function normally regardless of expiration dates, and no UI elements related to expiration are shown.

---

## Phase 1: Backend Authentication Changes

### Task 1.1: Modify Login Endpoint to Allow Expired Account Login

**Goal**: Remove the hard lockout that prevents expired accounts from logging in at all.

**Documentation**: [Phase 1.1](./soft-account-expiration-implementation.md#11-modify-login-endpoint-appapiauthroutets)

**Primary File to Edit**:
- `app/api/auth/route.ts`

**Actions**:
1. Remove lines 189-222 that check for account expiration before authentication
2. Remove the `recordFailedAttempt(ip)` call for expired accounts (line 212)
3. Keep JWT token generation with subscription data (lines 308-313, 472-478) - no changes needed here
4. Verify that expired users can now complete login and receive JWT tokens

**Testing Checklist**:
- [ ] Expired account can log in with correct PIN/password
- [ ] JWT token is generated successfully
- [ ] Token contains subscription data fields (`trialEnds`, `planExpires`, `planType`, `betaparticipant`)
- [ ] No IP lockout triggered for expired accounts

---

### Task 1.2A: Update Authentication Type Definitions

**Goal**: Add new fields to `AuthResult` type to support expiration status without blocking authentication.

**Documentation**: [Phase 1.2 - Part A](./soft-account-expiration-implementation.md#a-update-authresult-type-add-at-top-of-file)

**Primary File to Edit**:
- `app/api/utils/auth.ts`

**Actions**:
1. Locate the `AuthResult` type definition (near top of file)
2. Add `accountExpired?: boolean` field
3. Add `expirationInfo` object with fields: `type`, `date`, `familySlug`, `canRead`, `canWrite`
4. Ensure TypeScript compilation succeeds

**Testing Checklist**:
- [ ] TypeScript compiles without errors
- [ ] Type definitions are available in IDE autocomplete

---

### Task 1.2B: Modify Account Auth Expiration Check

**Goal**: Change expiration check from blocking (returns `authenticated: false`) to permissive (returns `authenticated: true` with expiration metadata).

**Documentation**: [Phase 1.2 - Part B](./soft-account-expiration-implementation.md#b-modify-account-auth-expiration-check-lines-136-160)

**Primary File to Edit**:
- `app/api/utils/auth.ts` (lines 136-160)

**Files for Context**:
- `app/api/types.ts` (for understanding response types)

**Actions**:
1. Locate the account expiration check block (lines 136-160)
2. **Add SaaS mode check**: `const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';`
3. **Wrap expiration logic in SaaS check**: Only run expiration checks if `isSaasMode` is true
4. For closed accounts: Keep hard block but return `authenticated: true` with `accountExpired: true` and `canRead: false`, `canWrite: false`
5. For expired accounts (SaaS mode only): Change from returning `authenticated: false` to returning `authenticated: true`
6. Add expiration metadata to the return object: `accountExpired: true`, `expirationInfo` with type, date, slug, permissions
7. Set `canRead: true` and `canWrite: false` for expired accounts
8. Include all normal auth fields (`userId`, `familyId`, `caretakerId`, `role`, etc.)
9. **Important**: If not in SaaS mode, skip all expiration checks and continue with normal authentication

**Testing Checklist**:
- [ ] **SaaS mode**: Expired accounts return `authenticated: true` with `accountExpired: true`
- [ ] **SaaS mode**: `expirationInfo` contains correct type (`TRIAL_EXPIRED`, `PLAN_EXPIRED`, or `NO_PLAN`)
- [ ] **SaaS mode**: `expirationInfo` contains correct date and familySlug
- [ ] Beta participants still bypass all checks (all modes)
- [ ] Closed accounts return hard block with `canRead: false` (all modes)
- [ ] **Self-hosted mode**: All accounts authenticate normally, no expiration checks performed
- [ ] **Self-hosted mode**: No `accountExpired` or `expirationInfo` fields in AuthResult

---

### Task 1.2C: Modify Caretaker Auth Expiration Check

**Goal**: Apply the same expiration logic changes to caretaker authentication that was applied to account authentication.

**Documentation**: [Phase 1.2 - Part C](./soft-account-expiration-implementation.md#c-update-caretaker-auth-expiration-check-lines-236-292)

**Primary File to Edit**:
- `app/api/utils/auth.ts` (lines 236-292)

**Files for Context**:
- Same file, lines 136-160 (reference for the pattern established in Task 1.2B)

**Actions**:
1. Locate the caretaker auth expiration check block (lines 236-292)
2. **Add the same SaaS mode check** as in Task 1.2B: `const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';`
3. **Wrap expiration logic in SaaS check**: Only run expiration checks if `isSaasMode` is true
4. Apply the same changes made in Task 1.2B but for caretaker authentication flow
5. Change from returning `authenticated: false` to `authenticated: true` with expiration metadata
6. Ensure consistency with account auth expiration handling
7. **Important**: If not in SaaS mode, skip all expiration checks

**Testing Checklist**:
- [ ] Caretakers in expired families return `authenticated: true` with `accountExpired: true`
- [ ] Expiration info matches the family's account expiration status
- [ ] System administrators bypass checks (`isSysAdmin`)

---

### Task 1.2D: Update withAuth Wrappers

**Goal**: Ensure all authentication wrapper functions pass through the new `accountExpired` and `expirationInfo` fields.

**Documentation**: [Phase 1.2 - Part D](./soft-account-expiration-implementation.md#d-update-withauth-wrappers)

**Primary File to Edit**:
- `app/api/utils/auth.ts`

**Functions to Update**:
- `withAuth`
- `withAuthContext`
- `withAccountOwner`
- `withAdminAuth`

**Actions**:
1. Review each wrapper function to understand how they pass auth context
2. Ensure `accountExpired` and `expirationInfo` are passed through to handlers
3. Verify no data is lost when passing context to route handlers

**Testing Checklist**:
- [ ] Handlers receive `accountExpired` field in auth context
- [ ] Handlers receive `expirationInfo` object in auth context
- [ ] No breaking changes to existing handler signatures

---

### Task 1.3: Create Write Protection Middleware

**Goal**: Create a reusable middleware function that blocks write operations for expired accounts.

**Documentation**: [Phase 1.3](./soft-account-expiration-implementation.md#13-create-write-protection-middleware)

**Primary File to Create**:
- `app/api/utils/writeProtection.ts` (NEW FILE)

**Files for Context**:
- `app/api/utils/auth.ts` (for `getAuthenticatedUser` function)
- `app/api/types.ts` (for `ApiResponse` type)

**Actions**:
1. Create new file `app/api/utils/writeProtection.ts`
2. Import necessary types and functions from `auth.ts` and `types.ts`
3. Define `WriteProtectionResponse` type with `allowed`, `response`, and `authResult` fields
4. Implement `checkWritePermission()` async function
5. Check authentication status first - return 401 if not authenticated
6. Check if account is expired and `canWrite === false` - return 403 with expiration info
7. Return `allowed: true` with authResult for active accounts
8. Include user-friendly error messages based on expiration type
9. Include upgrade URL in 403 response data

**Testing Checklist**:
- [ ] Returns `allowed: false` for expired accounts
- [ ] Returns proper error message based on expiration type
- [ ] Includes `upgradeUrl` in response data (`/accounts/{slug}/billing`)
- [ ] Returns `allowed: true` for active accounts
- [ ] Beta participants bypass the check
- [ ] System admins bypass the check

---

### Task 1.4: Protect Write Endpoints - Phase 1 (Critical Log Endpoints)

**Goal**: Add write protection to the 8 critical log entry endpoints that users interact with daily.

**Documentation**:
- [Phase 1.4](./soft-account-expiration-implementation.md#14-protect-write-endpoints)
- [Endpoint Details](./phase-1-4-write-protected-endpoints.md#-high-priority---core-user-data-must-protect-first)

**Files to Edit** (8 files):
1. `app/api/diaper-log/route.ts`
2. `app/api/feed-log/route.ts`
3. `app/api/sleep-log/route.ts`
4. `app/api/bath-log/route.ts`
5. `app/api/pump-log/route.ts`
6. `app/api/medicine-log/route.ts`
7. `app/api/measurement-log/route.ts`
8. `app/api/milestone-log/route.ts`

**Files for Context**:
- `app/api/utils/writeProtection.ts` (the middleware created in Task 1.3)
- `app/api/utils/auth.ts` (for understanding auth context)

**Actions for Each File**:
1. Import `checkWritePermission` from `../utils/writeProtection`
2. In `handlePost` function: Add write check at the very top, return early if not allowed
3. In `handlePut` function: Add write check at the very top, return early if not allowed
4. In `handleDelete` function: Add write check at the very top, return early if not allowed
5. Do NOT modify `handleGet` function - expired accounts should be able to read data
6. Use `writeCheck.authResult` for auth context instead of re-fetching

**Testing Checklist** (per endpoint):
- [ ] Expired accounts can GET data successfully
- [ ] Expired accounts receive 403 on POST operations
- [ ] Expired accounts receive 403 on PUT operations
- [ ] Expired accounts receive 403 on DELETE operations
- [ ] Error message includes upgrade URL
- [ ] Active accounts can perform all operations normally
- [ ] Beta participants can perform all operations

---

### Task 1.5: Protect Write Endpoints - Phase 2 (Core Management)

**Goal**: Add write protection to baby, caretaker, and settings management endpoints.

**Documentation**:
- [Phase 1.4](./soft-account-expiration-implementation.md#14-protect-write-endpoints)
- [Endpoint Details](./phase-1-4-write-protected-endpoints.md#baby-management)

**Files to Edit** (5 files):
1. `app/api/baby/route.ts`
2. `app/api/baby/create/route.ts`
3. `app/api/caretaker/route.ts`
4. `app/api/settings/route.ts`
5. `app/api/activity-settings/route.ts`
6. `app/api/baby-last-activities/route.ts`
7. `app/api/baby-upcoming-events/route.ts`
8. `app/api/timeline/route.ts`

**Files for Context**:
- `app/api/utils/writeProtection.ts`

**Actions**:
1. Same pattern as Task 1.4 - add `checkWritePermission` to POST/PUT/DELETE handlers
2. Do not modify GET handlers
3. For `baby/route.ts`: Protect `handlePost`, `handlePut`, `handleDelete`
4. For `baby/create/route.ts`: Protect the POST handler
5. For `caretaker/route.ts`: Protect `postHandler`, `putHandler`, `deleteHandler`
6. For `settings/route.ts`: Protect `handlePut` (no POST/DELETE in this file)
7. For `activity-settings/route.ts`: Protect all write handlers
8. For `baby-last-activities/route.ts` allow all read actions
9. For `baby-upcoming-events/route.ts` allow all read actions
10. For `timeline/route.ts` allow all read actions

**Testing Checklist**:
- [ ] Cannot create babies with expired account
- [ ] Cannot edit babies with expired account
- [ ] Cannot delete babies with expired account
- [ ] Cannot create/edit/delete caretakers with expired account
- [ ] Cannot update settings with expired account
- [ ] Cannot update activity settings with expired account
- [ ] All read operations work normally

---

### Task 1.6: Protect Write Endpoints - Phase 3 (Extended Features)

**Goal**: Add write protection to calendar, notes, medicine, and family management endpoints.

**Documentation**:
- [Phase 1.4](./soft-account-expiration-implementation.md#14-protect-write-endpoints)
- [Endpoint Details](./phase-1-4-write-protected-endpoints.md#-medium-priority---extended-features)

**Files to Edit** (5 files):
1. `app/api/calendar-event/route.ts`
2. `app/api/note/route.ts`
3. `app/api/medicine/route.ts`
4. `app/api/family/route.ts`
5. `app/api/family/manage/route.ts`

**Files for Context**:
- `app/api/utils/writeProtection.ts`

**Actions**:
1. Same pattern as previous tasks - add `checkWritePermission` to POST/PUT/DELETE handlers
2. For `family/route.ts`: Protect `putHandler` only (no POST/DELETE)
3. For other files: Protect all write operations
4. Do not modify GET handlers

**Testing Checklist**:
- [ ] Cannot create/edit/delete calendar events with expired account
- [ ] Cannot create/edit/delete notes with expired account
- [ ] Cannot manage medicine inventory with expired account
- [ ] Cannot update family name/slug with expired account
- [ ] Can still read all data with expired account

---

### Task 1.7: Update API Response Types

**Goal**: Add expiration info fields to the main API response type for consistency.

**Documentation**: [Phase 5.2](./soft-account-expiration-implementation.md#52-update-api-response-types)

**Primary File to Edit**:
- `app/api/types.ts`

**Actions**:
1. Locate the `ApiResponse<T>` type definition
2. Add optional `expirationInfo` field to the type
3. Define the structure: `type`, `date`, `upgradeUrl`
4. Ensure TypeScript compilation succeeds

**Testing Checklist**:
- [ ] TypeScript compiles without errors
- [ ] New fields are available in IDE autocomplete
- [ ] No breaking changes to existing code

---

## Phase 2: Frontend Login Changes

### Task 2.1A: Remove Hard Block in Login Component

**Goal**: Stop blocking expired users from accessing the login form entirely.

**Documentation**: [Phase 2.1 - Part A](./soft-account-expiration-implementation.md#a-remove-hard-block-lines-116-125)

**Primary File to Edit**:
- `src/components/LoginSecurity/index.tsx` (lines 116-125)

**Files for Context**:
- `src/components/ExpiredAccountMessage/index.tsx` (to understand what's being replaced)

**Actions**:
1. Locate the conditional block that shows `<ExpiredAccountMessage>` (lines 116-125)
2. Remove the early return that renders only the expired account message
3. Replace with a state variable: `const showExpirationWarning = accountStatus?.isExpired;`
4. Allow the login form to render even when account is expired

**Testing Checklist**:
- [ ] Expired accounts see the login form
- [ ] Warning banner shows for expired accounts (next task)
- [ ] Active accounts don't see warning
- [ ] Login form remains functional

---

### Task 2.1B: Add Warning Banner Above Login Form

**Goal**: Show a non-blocking warning banner above the login form for expired accounts.

**Documentation**: [Phase 2.1 - Part B](./soft-account-expiration-implementation.md#b-add-warning-banner-above-login-form)

**Primary File to Edit**:
- `src/components/LoginSecurity/index.tsx`

**Files for Context**:
- Look at existing styling patterns in the file for consistency

**Actions**:
1. Add a conditional warning banner above the login form
2. Show banner only when `showExpirationWarning` is true
3. Style with amber/yellow colors (non-blocking, informative)
4. Include warning icon, title "Account Expired", and message
5. Differentiate message based on trial vs subscription expiration
6. Keep banner dismissible or persistent (decision point)

**Testing Checklist**:
- [ ] Warning banner shows for expired trial accounts
- [ ] Warning banner shows for expired subscription accounts
- [ ] Message differentiates between trial and subscription
- [ ] Banner styling matches app design system
- [ ] Banner is visible but doesn't block login

---

### Task 2.1C: Store Expiration Status After Login

**Goal**: Save expiration status to localStorage after successful login for use throughout the app.

**Documentation**: [Phase 2.1 - Part C](./soft-account-expiration-implementation.md#c-store-expiration-status-after-successful-login)

**Primary File to Edit**:
- `src/components/LoginSecurity/index.tsx`

**Actions**:
1. Locate the `handleLogin` function or similar login success handler
2. After successful login, check if `accountStatus?.isExpired` is true
3. If expired, store to localStorage: `accountExpirationStatus` key
4. Store: `isExpired`, `type` (reason), `expirationDate`
5. Ensure storage happens before redirect

**Testing Checklist**:
- [ ] localStorage contains expiration data after login for expired accounts
- [ ] localStorage does not contain expiration data for active accounts
- [ ] Data persists across page refreshes
- [ ] JSON is properly formatted

---

## Phase 3: Frontend Layout Changes

**IMPORTANT**: All frontend components in this phase should check deployment mode using the `useDeployment` hook from `app/context/deployment.tsx` and only render expiration-related UI in SaaS mode.

### Task 3.1A: Add Expiration State to Layout

**Goal**: Create state management for tracking account expiration status throughout the app.

**Documentation**: [Phase 3.1 - Part A](./soft-account-expiration-implementation.md#a-add-expiration-state-around-line-50)

**Primary File to Edit**:
- `app/(app)/[slug]/layout.tsx` (around line 50)

**Actions**:
1. **Import deployment context**: `import { useDeployment } from '@/app/context/deployment';`
2. **Get SaaS mode flag**: `const { isSaasMode } = useDeployment();`
3. Add state hook for `accountExpirationStatus`
4. Define type with fields: `isExpired`, `type`, `expirationDate`, `message`
5. Initialize as null

**Testing Checklist**:
- [ ] State variable is available throughout the layout component
- [ ] TypeScript types are correct

---

### Task 3.1B: Load Expiration Status from localStorage

**Goal**: Read expiration status from localStorage and set it in layout state on mount.

**Documentation**: [Phase 3.1 - Part B](./soft-account-expiration-implementation.md#b-modify-checkauthstatus-function-lines-356-445)

**Primary File to Edit**:
- `app/(app)/[slug]/layout.tsx` (lines 356-445, in `checkAuthStatus` function)

**Files for Context**:
- `src/components/LoginSecurity/index.tsx` (where the data is stored)

**Actions**:
1. Locate the `checkAuthStatus` function
2. After JWT token validation, check localStorage for `accountExpirationStatus`
3. Parse JSON and call `setAccountExpirationStatus`
4. Handle parsing errors gracefully

**Testing Checklist**:
- [ ] Expiration status loaded on page load
- [ ] State updates correctly
- [ ] No errors if localStorage is empty
- [ ] Works after login and page refresh

---

### Task 3.1C: Add Global API Error Handler

**Goal**: Intercept 403 expiration errors from API calls and update UI without logging out the user.

**Documentation**: [Phase 3.1 - Part C](./soft-account-expiration-implementation.md#c-add-api-error-interceptor)

**Primary File to Edit**:
- `app/(app)/[slug]/layout.tsx`

**Files for Context**:
- `app/api/utils/writeProtection.ts` (to see what errors look like)

**Actions**:
1. Add a `useEffect` hook to listen for custom `apiError` events
2. Check if error status is 403 and error code is `ACCOUNT_EXPIRED`
3. Update `accountExpirationStatus` state with expiration info from event
4. Show toast notification (if toast system exists)
5. Do NOT call `handleLogout()` - this is critical
6. Clean up event listener on unmount

**Testing Checklist**:
- [ ] 403 expiration errors trigger state update
- [ ] User remains logged in
- [ ] Toast/notification shows (if applicable)
- [ ] Event listener cleans up properly

---

### Task 3.1D: Modify Logout Logic for Expiration vs Auth Errors

**Goal**: Distinguish between real auth failures (401) and expiration errors (403) in error handling.

**Documentation**: [Phase 3.1 - Part D](./soft-account-expiration-implementation.md#d-remove-auto-logout-on-403-expiration-errors)

**Primary File to Edit**:
- `app/(app)/[slug]/layout.tsx`

**Files for Context**:
- May need to check if there's a centralized API client or fetch wrapper

**Actions**:
1. Locate existing error handling that triggers `handleLogout()`
2. Add conditional logic: if 403 AND error is `ACCOUNT_EXPIRED`, dispatch custom event instead of logout
3. Still call `handleLogout()` for 401 errors
4. Still call `handleLogout()` for JWT expiration
5. Document the distinction clearly in comments

**Testing Checklist**:
- [ ] 401 errors trigger logout
- [ ] JWT expiration triggers logout
- [ ] 403 expiration errors do NOT trigger logout
- [ ] 403 expiration errors trigger notification

---

### Task 3.2: Create Account Expiration Banner Component

**Goal**: Build a persistent, minimizable banner component that shows at the top of all pages for expired accounts.

**Documentation**: [Phase 3.2](./soft-account-expiration-implementation.md#32-create-account-expiration-banner-component)

**Primary File to Create**:
- `src/components/AccountExpirationBanner/index.tsx` (NEW FILE)

**Files for Context**:
- App design system/theme files for styling consistency
- `app/(app)/[slug]/layout.tsx` (where it will be used)

**Actions**:
1. Create new component file
2. Accept props: `type`, `expirationDate`, `familySlug`
3. Implement minimize/expand functionality with localStorage persistence
4. Create messaging for each expiration type (trial, plan, no plan, closed)
5. Add "Upgrade Now" CTA button that navigates to billing page
6. Style with amber/yellow warning colors
7. Make sticky positioned at top of viewport
8. Support dark mode

**Testing Checklist**:
- [ ] Banner shows at top of all pages
- [ ] Can minimize banner
- [ ] Can expand minimized banner
- [ ] Minimized state persists across page loads
- [ ] Upgrade button navigates to billing page
- [ ] Shows correct message for each expiration type
- [ ] Works in light and dark mode
- [ ] Responsive on mobile

---

### Task 3.3: Add Banner to Layout

**Goal**: Integrate the expiration banner component into the main layout so it appears on all pages.

**Documentation**: [Phase 3.3](./soft-account-expiration-implementation.md#33-add-banner-to-layout)

**Primary File to Edit**:
- `app/(app)/[slug]/layout.tsx`

**Files for Context**:
- `src/components/AccountExpirationBanner/index.tsx` (created in Task 3.2)

**Actions**:
1. Import `AccountExpirationBanner` component
2. Add conditional rendering right after `<body>` tag
3. **Check both SaaS mode AND expiration status**: Show banner only when `isSaasMode && accountExpirationStatus?.isExpired`
4. Pass required props: `type`, `expirationDate`, `familySlug`
5. Ensure banner appears above all other content
6. **Important**: Banner should never show in self-hosted mode

**Testing Checklist**:
- [ ] **SaaS mode**: Banner shows for expired accounts
- [ ] **SaaS mode**: Banner does not show for active accounts
- [ ] **SaaS mode**: Banner appears on all pages in the app
- [ ] **Self-hosted mode**: Banner never shows regardless of expiration status
- [ ] Props are passed correctly
- [ ] No layout shift or flashing

---

## Phase 4: UI Feedback Components

**IMPORTANT**: All UI components in this phase should also check deployment mode and only render in SaaS mode. Components should receive deployment context as a prop or use the `useDeployment` hook internally.

### Task 4.1: Create Upgrade Prompt Modal

**Goal**: Build a modal component that explains expiration and prompts for upgrade when users try to perform write operations.

**Documentation**: [Phase 4.1](./soft-account-expiration-implementation.md#41-create-upgrade-prompt-modal)

**Primary File to Create**:
- `src/components/UpgradePromptModal/index.tsx` (NEW FILE)

**Files for Context**:
- Existing modal components for styling patterns
- `src/components/AccountExpirationBanner/index.tsx` (for messaging consistency)

**Actions**:
1. Create modal component with props: `isOpen`, `onClose`, `familySlug`, `expirationType`, `actionAttempted`
2. Create different messaging for trial vs subscription vs no plan
3. List benefits of upgrading (bullet points)
4. Add "Upgrade Now" primary CTA that navigates to billing
5. Add "View Data Only" secondary button to close modal
6. Include backdrop that closes modal on click
7. Support dark mode
8. Make responsive

**Testing Checklist**:
- [ ] Modal opens when triggered
- [ ] Shows appropriate message based on expiration type
- [ ] Shows action attempted in message (e.g., "to create log entries")
- [ ] Upgrade button navigates to billing page
- [ ] Close button dismisses modal
- [ ] Backdrop click dismisses modal
- [ ] ESC key dismisses modal
- [ ] Works in light and dark mode
- [ ] Responsive on mobile

---

### Task 4.2: Create Read-Only Badge Component

**Goal**: Build small badge/icon components to indicate features are locked for expired accounts.

**Documentation**: [Phase 4.2](./soft-account-expiration-implementation.md#42-create-read-only-badge-component)

**Primary File to Create**:
- `src/components/ReadOnlyBadge/index.tsx` (NEW FILE)

**Actions**:
1. Create component with variants: `button`, `badge`, `icon`
2. Add optional onClick handler
3. Add optional tooltip showing "Upgrade to enable this feature"
4. Style consistently with amber/warning colors
5. Include lock icon
6. Support dark mode

**Testing Checklist**:
- [ ] Badge renders in all variants
- [ ] Tooltip shows on hover for icon variant
- [ ] onClick handler fires correctly
- [ ] Styles work in light and dark mode
- [ ] Accessible (keyboard navigation, screen readers)

---

### Task 4.3: Add Read-Only Indicators to Forms

**Goal**: Update form components throughout the app to check expiration status and show read-only indicators.

**Documentation**: [Phase 4.3](./soft-account-expiration-implementation.md#43-disable-write-actions-in-ui)

**Files to Edit** (examples - apply pattern to all form components):
- Components that create log entries
- Components that edit babies
- Components that manage settings
- Components that manage caretakers
- Any other forms that write data

**Files for Context**:
- `src/components/ReadOnlyBadge/index.tsx` (Task 4.2)
- `src/components/UpgradePromptModal/index.tsx` (Task 4.1)

**Actions** (per component):
1. Add state to track if account is expired (read from localStorage)
2. Add state for showing upgrade modal
3. Check expiration status in useEffect on mount
4. Add warning banner above form if expired
5. Disable submit button if expired
6. Change button text to show lock icon if expired
7. On submit attempt, show upgrade modal if expired
8. Don't make API call if expired

**Testing Checklist** (per component):
- [ ] Warning shows above form for expired accounts
- [ ] Submit button is disabled for expired accounts
- [ ] Button shows lock icon for expired accounts
- [ ] Clicking submit shows upgrade modal
- [ ] Active accounts see no changes
- [ ] Forms work normally for active accounts

---

## Phase 5: API Response Standardization

### Task 5.1: Create Centralized API Client

**Goal**: Build a centralized fetch wrapper that handles expiration errors globally.

**Documentation**: [Phase 5.1](./soft-account-expiration-implementation.md#51-create-centralized-api-client)

**Primary File to Create or Modify**:
- `src/lib/api-client.ts` (NEW or MODIFY EXISTING)

**Actions**:
1. Create `ApiError` class that extends Error
2. Create `apiRequest<T>` function as wrapper around fetch
3. Handle 403 + `ACCOUNT_EXPIRED` specifically - dispatch custom event
4. Handle 401 errors - dispatch auth error event
5. Include expiration info in error object
6. Throw typed errors
7. Handle network errors

**Testing Checklist**:
- [ ] 403 ACCOUNT_EXPIRED triggers custom event
- [ ] 401 errors trigger auth error event
- [ ] Expiration info passed through correctly
- [ ] Regular errors handled properly
- [ ] Network errors handled
- [ ] TypeScript types work correctly

---

## Phase 6: Testing

**CRITICAL**: All testing must be performed in BOTH deployment modes to ensure backward compatibility:
- **SaaS Mode** (`DEPLOYMENT_MODE=saas`): Verify all soft expiration features work correctly
- **Self-Hosted Mode** (`DEPLOYMENT_MODE=selfhosted`): Verify system works exactly as before with NO expiration enforcement

### Task 6.1: Backend Testing - Login Flow

**Goal**: Verify that the authentication changes work correctly for all account types.

**Documentation**: [Phase 6.1 - Test 1](./soft-account-expiration-implementation.md#61-backend-testing)

**Files for Context**:
- `app/api/auth/route.ts`
- `app/api/utils/auth.ts`

**Test Cases**:
- [ ] Expired trial account can log in
- [ ] Expired plan account can log in
- [ ] No plan account can log in
- [ ] Closed account cannot log in (hard block)
- [ ] Beta participant can log in regardless of dates
- [ ] JWT token contains subscription data fields

---

### Task 6.2: Backend Testing - Authentication Middleware

**Goal**: Verify that the middleware returns correct expiration metadata.

**Documentation**: [Phase 6.1 - Test 2](./soft-account-expiration-implementation.md#61-backend-testing)

**Files for Context**:
- `app/api/utils/auth.ts`

**Test Cases**:
- [ ] Expired account returns `authenticated: true, accountExpired: true`
- [ ] `expirationInfo` contains correct type, date, familySlug
- [ ] `canRead: true` and `canWrite: false` for expired
- [ ] Active account returns normal auth result
- [ ] `skipExpirationCheck: true` bypasses check (status endpoint)

---

### Task 6.3: Backend Testing - Write Protection

**Goal**: Verify that write operations are blocked for expired accounts.

**Documentation**: [Phase 6.1 - Test 3](./soft-account-expiration-implementation.md#61-backend-testing)

**Files for Context**:
- All protected endpoint files from Tasks 1.4, 1.5, 1.6
- `app/api/utils/writeProtection.ts`

**Test Cases** (test across all protected endpoints):
- [ ] Expired account POST returns 403 with expiration info
- [ ] Expired account PUT returns 403
- [ ] Expired account DELETE returns 403
- [ ] Active account can perform all write operations
- [ ] Error message includes upgrade URL
- [ ] Beta participants can perform all operations
- [ ] System admins can perform all operations

---

### Task 6.4: Backend Testing - Read Access

**Goal**: Verify that read operations still work for expired accounts.

**Documentation**: [Phase 6.1 - Test 4](./soft-account-expiration-implementation.md#61-backend-testing)

**Test Cases**:
- [ ] Expired account can GET log entries
- [ ] Expired account can GET baby data
- [ ] Expired account can GET caretaker list
- [ ] Expired account can GET settings
- [ ] Expired account can GET timeline
- [ ] All read operations work normally with no restrictions

---

### Task 6.5: Frontend Testing - Login Screen

**Goal**: Verify that login screen changes work correctly.

**Documentation**: [Phase 6.2 - Test 1](./soft-account-expiration-implementation.md#62-frontend-testing)

**Files for Context**:
- `src/components/LoginSecurity/index.tsx`

**Test Cases**:
- [ ] Warning banner shows for expired accounts
- [ ] Login form still works for expired accounts
- [ ] Active accounts don't see warning
- [ ] Expiration status stored in localStorage after login
- [ ] Redirect works after login

---

### Task 6.6: Frontend Testing - Layout

**Goal**: Verify layout changes and banner functionality.

**Documentation**: [Phase 6.2 - Test 2](./soft-account-expiration-implementation.md#62-frontend-testing)

**Files for Context**:
- `app/(app)/[slug]/layout.tsx`
- `src/components/AccountExpirationBanner/index.tsx`

**Test Cases**:
- [ ] Expiration banner shows on all pages for expired accounts
- [ ] Banner can be minimized
- [ ] Banner can be expanded
- [ ] Minimized state persists across page loads
- [ ] JWT expiration still triggers logout
- [ ] 401 errors still trigger logout
- [ ] 403 expiration errors don't trigger logout
- [ ] Expiration status persists across page refreshes

---

### Task 6.7: Frontend Testing - UI Components

**Goal**: Verify that UI feedback components work correctly.

**Documentation**: [Phase 6.2 - Test 3](./soft-account-expiration-implementation.md#62-frontend-testing)

**Files for Context**:
- `src/components/ReadOnlyBadge/index.tsx`
- `src/components/UpgradePromptModal/index.tsx`
- Form components modified in Task 4.3

**Test Cases**:
- [ ] ReadOnlyBadge renders correctly in all variants
- [ ] UpgradePromptModal shows on write attempts
- [ ] Modal shows correct message for expiration type
- [ ] Form submit buttons disabled when expired
- [ ] Forms show warning banners when expired
- [ ] Upgrade buttons navigate correctly
- [ ] All components work in dark mode

---

### Task 6.8: Frontend Testing - Data Access

**Goal**: Verify that expired users can access and view their data.

**Documentation**: [Phase 6.2 - Test 4](./soft-account-expiration-implementation.md#62-frontend-testing)

**Test Cases**:
- [ ] Can view all historical log entries
- [ ] Can view baby profiles
- [ ] Can view timeline
- [ ] Charts and analytics load and work
- [ ] Navigation works normally
- [ ] Settings page loads (read-only)
- [ ] Export functionality works (if read-only)

---

### Task 6.9: Integration Testing - Expired Trial User Journey

**Goal**: Test the complete end-to-end flow for an expired trial user.

**Documentation**: [Phase 6.3 - Test 1](./soft-account-expiration-implementation.md#63-integration-testing)

**Complete User Journey**:
1. [ ] User logs in successfully with expired trial
2. [ ] Sees warning on login screen
3. [ ] After login, sees banner at top of app
4. [ ] Can browse all pages
5. [ ] Can view all historical data
6. [ ] Tries to create new log entry
7. [ ] Sees 403 error or upgrade modal
8. [ ] Cannot save new entry
9. [ ] Clicks "Upgrade" button
10. [ ] Reaches billing/upgrade page
11. [ ] Billing page loads correctly

---

### Task 6.10: Integration Testing - Mid-Session Expiration

**Goal**: Test what happens when a subscription expires while user is logged in.

**Documentation**: [Phase 6.3 - Test 2](./soft-account-expiration-implementation.md#63-integration-testing)

**Test Scenario**:
1. [ ] User logged in with active subscription
2. [ ] Mock subscription expiration (update DB or mock system time)
3. [ ] User tries to create new entry
4. [ ] Next API call returns expiration error
5. [ ] Banner appears without logout
6. [ ] User remains logged in
7. [ ] User can continue viewing data
8. [ ] Write operations now blocked
9. [ ] localStorage updates with expiration status

---

### Task 6.11: Create Test Accounts in Database

**Goal**: Set up test accounts with different expiration states for manual testing.

**Documentation**: [Phase 6.4](./soft-account-expiration-implementation.md#64-manual-testing-checklist)

**Actions**:
1. Create expired trial account (set `trialEnds` to past date)
2. Create expired plan account (set `planExpires` to past date)
3. Create no plan account (null `trialEnds`, null `planType`)
4. Create active trial account (set `trialEnds` to future date)
5. Create active plan account (set `planExpires` to future date)
6. Create beta participant with expired date (should still work)
7. Document credentials for each test account

**SQL Reference**: See documentation for SQL commands

---

## Phase 7: Database

### Task 7.1: Verify Database Schema

**Goal**: Confirm that no database migrations are needed.

**Documentation**: [Phase 7.1](./soft-account-expiration-implementation.md#71-no-schema-changes-required)

**Files for Context**:
- `prisma/schema.prisma`

**Actions**:
1. Verify `Account` model has `trialEnds` field
2. Verify `Account` model has `planExpires` field
3. Verify `Account` model has `planType` field
4. Verify `Account` model has `betaparticipant` field
5. Verify `Account` model has `closed` field
6. Confirm no migrations needed

**Testing Checklist**:
- [ ] All required fields exist in schema
- [ ] Fields have correct types (DateTime, String, Boolean)
- [ ] No migration required

---

### Task 7.2: Data Integrity Check

**Goal**: Check for accounts with inconsistent expiration states before deployment.

**Documentation**: [Phase 7.2](./soft-account-expiration-implementation.md#72-data-integrity-checks)

**Actions**:
1. Run SQL query to find accounts with inconsistent states
2. Document any accounts that need manual review
3. Fix any data issues before deployment

**SQL Reference**: See documentation for query

---

## Phase 8: Deployment

### Task 8.1: Code Review

**Goal**: Review all changes before deployment.

**Documentation**: [Phase 8.1](./soft-account-expiration-implementation.md#81-pre-deployment)

**Review Checklist**:
- [ ] All backend changes reviewed
- [ ] All frontend changes reviewed
- [ ] Types updated consistently across frontend and backend
- [ ] Error messages are user-friendly
- [ ] No debug console.log statements left in code
- [ ] Dark mode styles verified for all new components
- [ ] Comments added for complex logic
- [ ] TODOs resolved or documented

---

### Task 8.2: Testing Checklist

**Goal**: Ensure all tests pass before deployment.

**Documentation**: [Phase 8.1](./soft-account-expiration-implementation.md#81-pre-deployment)

**Testing Checklist**:
- [ ] All backend unit tests passing
- [ ] All frontend unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed (all tasks in Phase 6)
- [ ] Mobile responsive verified
- [ ] Browser compatibility checked (Chrome, Firefox, Safari, Edge)
- [ ] Performance testing (no significant slowdown)

---

### Task 8.3: Deploy to Staging

**Goal**: Deploy all changes to staging environment for final verification.

**Documentation**: [Phase 8.2](./soft-account-expiration-implementation.md#82-deployment-steps)

**Actions**:
1. Deploy backend changes to staging
2. Deploy frontend changes to staging
3. Run full test suite in staging
4. Manual smoke testing with test accounts
5. Verify expiration banner appearance
6. Test upgrade flow navigation
7. Check error logging and monitoring

**Testing Checklist**:
- [ ] Staging deployment successful
- [ ] All tests pass in staging
- [ ] Manual testing complete
- [ ] No errors in logs
- [ ] Monitoring/analytics working

---

### Task 8.4: Deploy to Production

**Goal**: Deploy to production during low-traffic period with monitoring.

**Documentation**: [Phase 8.2](./soft-account-expiration-implementation.md#82-deployment-steps)

**Actions**:
1. Schedule deployment during low-traffic period
2. Deploy backend changes first
3. Monitor error rates for 5-10 minutes
4. Deploy frontend changes
5. Monitor user sessions
6. Verify no spike in errors
7. Check that active users are unaffected
8. Monitor for 1-2 hours post-deployment

**Monitoring Checklist**:
- [ ] Error rates normal
- [ ] No spike in 403 errors beyond expected
- [ ] No spike in support tickets
- [ ] Active users unaffected
- [ ] Login success rate maintained
- [ ] API response times normal

---

### Task 8.5: Post-Deployment Monitoring

**Goal**: Monitor key metrics for the first 24-48 hours after deployment.

**Documentation**: [Phase 8.3](./soft-account-expiration-implementation.md#83-post-deployment-monitoring)

**Metrics to Watch**:
- [ ] Login success rate for expired accounts
- [ ] API 403 error rates (should see increase for expired accounts)
- [ ] Write operation attempt rates from expired accounts
- [ ] Upgrade button click rates
- [ ] Upgrade conversion rate from banner/modal
- [ ] User complaints/support tickets
- [ ] Banner interaction rates (minimize/expand)
- [ ] Modal open rates
- [ ] Time-to-upgrade for expired users
- [ ] Read-only session duration

**Actions**:
1. Set up dashboard to monitor these metrics
2. Check metrics every few hours for first 24 hours
3. Document any unexpected behavior
4. Be ready to rollback if critical issues arise

---

## Phase 9: User Communication

### Task 9.1: Email Currently Expired Users

**Goal**: Notify currently expired users about new read-only access.

**Documentation**: [Phase 9.1](./soft-account-expiration-implementation.md#91-in-app-messaging)

**Actions**:
1. Write email copy explaining new read-only access
2. Highlight that they can now view their data
3. Include clear upgrade CTA
4. Send to all currently expired users
5. Track email open and click rates

---

### Task 9.2: Update Help Documentation

**Goal**: Update support docs to reflect new expiration behavior.

**Documentation**: [Phase 9.2](./soft-account-expiration-implementation.md#92-support-documentation)

**Docs to Update**:
- [ ] "What happens when my trial ends?"
- [ ] "Can I access my data after expiration?"
- [ ] "How do I upgrade my account?"
- [ ] "What features are available in read-only mode?"
- [ ] FAQ section
- [ ] Troubleshooting guide

---

## Summary

**Total Tasks**: 54 tasks across 9 phases

**Estimated Timeline**:
- Phase 1 (Backend): 2-3 days (Tasks 1.1 - 1.7)
- Phase 2 (Login): 1 day (Tasks 2.1A - 2.1C)
- Phase 3 (Layout): 1-2 days (Tasks 3.1A - 3.3)
- Phase 4 (UI Components): 1-2 days (Tasks 4.1 - 4.3)
- Phase 5 (API Client): 0.5 days (Task 5.1)
- Phase 6 (Testing): 2-3 days (Tasks 6.1 - 6.11)
- Phase 7 (Database): 0.5 days (Tasks 7.1 - 7.2)
- Phase 8 (Deployment): 1 day (Tasks 8.1 - 8.5)
- Phase 9 (Communication): 0.5 days (Tasks 9.1 - 9.2)

**Total**: 10-15 days

---

## Quick Reference Links

- **Main Implementation Plan**: [soft-account-expiration-implementation.md](./soft-account-expiration-implementation.md)
- **Endpoint Protection Details**: [phase-1-4-write-protected-endpoints.md](./phase-1-4-write-protected-endpoints.md)
- **Current Hard Lockout Docs**: [AccountExpirationCheck.md](./AccountExpirationCheck.md)
