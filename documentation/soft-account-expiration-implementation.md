# Soft Account Expiration Experience - Implementation Plan

## Overview

This document outlines the plan to convert the current "hard lockout" account expiration system to a "soft notification" system that allows expired users to:
- Log in and access their account
- View all historical data
- Receive persistent notifications about expiration status
- Understand what features are restricted
- Have a clear path to upgrade/renew

This replaces the current system documented in `AccountExpirationCheck.md` which completely locks users out of the application when their subscription or trial expires.

## Problem Statement

### Current Hard Lockout System Issues

1. **Completely blocks access**: Users with expired accounts cannot log in at all
2. **No data visibility**: Users cannot see their historical data, even in read-only mode
3. **Poor user experience**: Punitive rather than educational
4. **Lost conversion opportunity**: Users can't be reminded of the value of their data
5. **Multiple blocking points**: Expiration checked in 3+ places, all blocking access
6. **IP lockout side effect**: Failed login attempts from expired accounts trigger IP bans

### Current Implementation (To Be Changed)

The hard lockout is enforced at multiple layers:

1. **Login endpoint** (`app/api/auth/route.ts` lines 189-222)
   - Blocks authentication before PIN/password verification
   - Returns 403 error
   - Records as failed login attempt

2. **Authentication middleware** (`app/api/utils/auth.ts` lines 136-160)
   - Returns `authenticated: false` for expired accounts
   - All API calls return 401 Unauthorized

3. **Login screen** (`src/components/LoginSecurity/index.tsx` lines 116-125)
   - Shows `ExpiredAccountMessage` component
   - Prevents login form submission

4. **Layout auto-logout** (`app/(app)/[slug]/layout.tsx` lines 356-445)
   - Checks auth status every second
   - Auto-logs out on any 401 response

## Goals of Soft Expiration System

### Primary Goals
- Allow expired users to log in successfully
- Provide full read access to historical data
- Block write operations (creating/editing/deleting data)
- Show persistent, non-dismissible notification banners
- Provide clear upgrade/renewal call-to-action
- Maintain security and prevent abuse

### User Experience Goals
- **Respectful**: Treat expired accounts as customers who deserve access to their data
- **Educational**: Help users understand what they're missing
- **Conversion-focused**: Make it easy to upgrade/renew
- **Transparent**: Clear communication about account status

## Implementation Plan

---

## Phase 1: Backend Authentication Changes

### 1.1 Modify Login Endpoint (`app/api/auth/route.ts`)

**File**: `app/api/auth/route.ts`

**Changes**:
1. **Remove lines 189-222** (entire expiration check block)
2. **Remove IP lockout recording** for expired accounts (line 212)
3. **Keep JWT token generation** with subscription data (lines 308-313, 472-478)

**Impact**:
- Expired users can now complete login and receive JWT tokens
- JWT already contains `trialEnds`, `planExpires`, `planType`, `betaparticipant`
- No more IP lockout punishment for expired accounts
- Simplifies auth flow - single source of truth moves to middleware

**Code to Remove**:
```typescript
// Lines 189-222 - DELETE THIS ENTIRE BLOCK
const deploymentMode = process.env.DEPLOYMENT_MODE;
if (deploymentMode === 'saas' && targetFamily.account) {
  const account = targetFamily.account;
  if (!account.betaparticipant) {
    const now = new Date();
    let isExpired = false;
    // ... expiration checking logic
    if (isExpired) {
      recordFailedAttempt(ip);
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Family access has expired...' },
        { status: 403 }
      );
    }
  }
}
```

**Testing**:
- [ ] Expired account can log in with correct PIN/password
- [ ] JWT token is generated successfully
- [ ] Token contains subscription data fields
- [ ] No IP lockout triggered for expired accounts

---

### 1.2 Modify Authentication Middleware (`app/api/utils/auth.ts`)

**File**: `app/api/utils/auth.ts`

**Changes**:

#### A. Update `AuthResult` Type (add at top of file)
```typescript
export type AuthResult = {
  authenticated: boolean;
  error?: string;
  userId?: string;
  familyId?: string;
  caretakerId?: string;
  role?: 'admin' | 'caretaker';
  type?: string;
  isAccountAuth?: boolean;
  accountId?: string;

  // NEW: Add expiration status fields
  accountExpired?: boolean;
  expirationInfo?: {
    type: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED';
    date?: string; // ISO date string
    familySlug?: string;
    canRead: boolean;
    canWrite: boolean;
  };
};
```

#### B. Modify Account Auth Expiration Check (lines 136-160)
**Replace current block with**:
```typescript
// Check if account is closed (still a hard block)
if (account.closed) {
  console.log('Account authentication failed: Account is closed for ID:', decoded.accountId);
  return {
    authenticated: true,  // Changed from false
    accountExpired: true,
    expirationInfo: {
      type: 'CLOSED',
      canRead: false,
      canWrite: false,
      familySlug: account.family?.slug
    },
    error: 'Account is closed'
  };
}

// Check account expiration in SAAS mode only
const isSaasMode = process.env.DEPLOYMENT_MODE === 'saas';
if (!skipExpirationCheck && isSaasMode && account.family && !account.betaparticipant) {
  const now = new Date();
  let isExpired = false;
  let expirationType: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | undefined;
  let expirationDate: Date | undefined;

  // Check trial expiration
  if (account.trialEnds) {
    const trialEndDate = new Date(account.trialEnds);
    isExpired = now > trialEndDate;
    if (isExpired) {
      expirationType = 'TRIAL_EXPIRED';
      expirationDate = trialEndDate;
    }
  }
  // Check plan expiration (if no trial)
  else if (account.planExpires) {
    const planEndDate = new Date(account.planExpires);
    isExpired = now > planEndDate;
    if (isExpired) {
      expirationType = 'PLAN_EXPIRED';
      expirationDate = planEndDate;
    }
  }
  // No trial and no plan = expired
  else if (!account.planType) {
    isExpired = true;
    expirationType = 'NO_PLAN';
  }

  if (isExpired) {
    console.log('Account subscription expired for ID:', decoded.accountId, 'Type:', expirationType);

    // NEW: Return authenticated but with expiration data
    return {
      authenticated: true,  // Changed from false!
      accountExpired: true,
      expirationInfo: {
        type: expirationType!,
        date: expirationDate?.toISOString(),
        familySlug: account.family.slug,
        canRead: true,   // Allow read access
        canWrite: false  // Block write access
      },
      userId: account.family.slug,
      familyId: account.family.id,
      caretakerId: account.caretaker?.id,
      role: account.caretaker?.role as 'admin' | 'caretaker',
      type: account.caretaker?.type,
      isAccountAuth: true,
      accountId: account.id,
      error: 'Account subscription has expired'
    };
  }
}
```

#### C. Update Caretaker Auth Expiration Check (lines 236-292)
Apply similar changes to the caretaker auth block.

#### D. Update withAuth Wrappers
Modify `withAuth`, `withAuthContext`, `withAccountOwner`, `withAdminAuth` to pass through `accountExpired` and `expirationInfo` in the request context.

**Testing**:
- [ ] Expired accounts return `authenticated: true` with `accountExpired: true`
- [ ] `expirationInfo` contains correct type, date, and permissions
- [ ] Beta participants still bypass all checks
- [ ] Closed accounts still return hard block
- [ ] Status endpoint with `skipExpirationCheck: true` still works

---

### 1.3 Create Write-Protection Middleware

**File**: `app/api/utils/writeProtection.ts` (NEW FILE)

**Purpose**: Reusable middleware to block write operations for expired accounts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from './auth';
import type { ApiResponse } from '../types';

export type WriteProtectionResponse = {
  allowed: boolean;
  response?: NextResponse<ApiResponse<null>>;
  authResult?: any;
};

/**
 * Check if a write operation should be allowed based on account expiration status
 * Use this at the top of POST/PUT/DELETE endpoints
 */
export async function checkWritePermission(
  req: NextRequest,
  skipExpirationCheck: boolean = false
): Promise<WriteProtectionResponse> {

  const authResult = await getAuthenticatedUser(req, skipExpirationCheck);

  if (!authResult.authenticated) {
    return {
      allowed: false,
      response: NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: authResult.error || 'Authentication required',
        },
        { status: 401 }
      ),
      authResult
    };
  }

  // Check if account is expired and write operations are blocked
  if (authResult.accountExpired && authResult.expirationInfo?.canWrite === false) {
    const { expirationInfo } = authResult;

    let errorMessage = 'Your account has expired. Please upgrade to continue.';
    if (expirationInfo.type === 'TRIAL_EXPIRED') {
      errorMessage = 'Your free trial has ended. Upgrade to continue tracking.';
    } else if (expirationInfo.type === 'PLAN_EXPIRED') {
      errorMessage = 'Your subscription has expired. Please renew to continue.';
    } else if (expirationInfo.type === 'NO_PLAN') {
      errorMessage = 'No active subscription found. Please subscribe to continue.';
    }

    return {
      allowed: false,
      response: NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'ACCOUNT_EXPIRED',
          message: errorMessage,
          data: {
            expirationInfo: {
              type: expirationInfo.type,
              date: expirationInfo.date,
              upgradeUrl: `/accounts/${expirationInfo.familySlug}/billing`
            }
          }
        } as any,
        { status: 403 }
      ),
      authResult
    };
  }

  return {
    allowed: true,
    authResult
  };
}
```

**Testing**:
- [ ] Returns `allowed: false` for expired accounts on write endpoints
- [ ] Returns proper error message based on expiration type
- [ ] Includes `upgradeUrl` in response data
- [ ] Returns `allowed: true` for active accounts

---

### 1.4 Protect Write Endpoints

**Files to Modify**: All write operation endpoints

#### Priority Endpoints (Must protect):

1. **Log Entry Creation** (`app/api/log-entry/route.ts`)
2. **Baby Management** (`app/api/baby/route.ts`, `app/api/baby/[id]/route.ts`)
3. **Settings Updates** (`app/api/settings/route.ts`)
4. **Caretaker Management** (`app/api/caretaker/route.ts`)
5. **Family Settings** (`app/api/family/route.ts`)
6. **Milestone Tracking** (any milestone endpoints)

#### Implementation Pattern:

**Before**:
```typescript
export async function POST(req: NextRequest) {
  const authResult = await getAuthenticatedUser(req);
  if (!authResult.authenticated) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of endpoint
}
```

**After**:
```typescript
import { checkWritePermission } from '../utils/writeProtection';

export async function POST(req: NextRequest) {
  const writeCheck = await checkWritePermission(req);
  if (!writeCheck.allowed) {
    return writeCheck.response; // Returns 401 or 403 with expiration info
  }

  const authResult = writeCheck.authResult;
  // ... rest of endpoint
}
```

#### Read Endpoints (No changes needed):
- GET requests can continue using `getAuthenticatedUser()` directly
- Expired users can read all data normally

**Testing**:
- [ ] Expired accounts can GET data successfully
- [ ] Expired accounts receive 403 on POST operations
- [ ] Error messages include upgrade URL
- [ ] Active accounts can perform all operations

---

## Phase 2: Frontend Login Changes

### 2.1 Modify LoginSecurity Component

**File**: `src/components/LoginSecurity/index.tsx`

**Changes**:

#### A. Remove Hard Block (lines 116-125)
**Before**:
```typescript
// Lines 116-125
if (accountStatus?.isExpired) {
  return (
    <div className="login-container">
      <ExpiredAccountMessage slug={params.slug} />
    </div>
  );
}
```

**After**:
```typescript
// Show warning but allow login
const showExpirationWarning = accountStatus?.isExpired;
```

#### B. Add Warning Banner Above Login Form
```typescript
{showExpirationWarning && (
  <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
    <div className="flex items-start">
      <svg className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 mr-3" /* warning icon */>
        {/* warning icon SVG */}
      </svg>
      <div>
        <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Account Expired
        </h3>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          Your {accountStatus.expirationReason === 'TRIAL_EXPIRED' ? 'free trial' : 'subscription'} has ended.
          You can still log in to view your data, but you'll need to upgrade to add new entries.
        </p>
      </div>
    </div>
  </div>
)}
```

#### C. Store Expiration Status After Successful Login
```typescript
const handleLogin = async () => {
  // ... existing login logic

  // After successful login, store expiration status
  if (accountStatus?.isExpired) {
    localStorage.setItem('accountExpirationStatus', JSON.stringify({
      isExpired: true,
      type: accountStatus.expirationReason,
      expirationDate: accountStatus.expirationDate
    }));
  }
};
```

**Testing**:
- [ ] Warning banner shows for expired accounts
- [ ] Login form remains functional
- [ ] Expiration status stored in localStorage
- [ ] Active accounts don't see warning

---

## Phase 3: Frontend Layout Changes

### 3.1 Modify Layout Authentication Logic

**File**: `app/(app)/[slug]/layout.tsx`

**Changes**:

#### A. Add Expiration State (around line 50)
```typescript
const [accountExpirationStatus, setAccountExpirationStatus] = useState<{
  isExpired: boolean;
  type?: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED';
  expirationDate?: string;
  message?: string;
} | null>(null);
```

#### B. Modify checkAuthStatus Function (lines 356-445)
```typescript
const checkAuthStatus = useCallback(async () => {
  try {
    const token = cookies.get('token');
    const accountToken = cookies.get('accountToken');

    if (!token && !accountToken) {
      handleLogout();
      return;
    }

    const currentToken = accountToken || token;
    if (!currentToken) {
      handleLogout();
      return;
    }

    // Check JWT expiration
    try {
      const payload = JSON.parse(atob(currentToken.split('.')[1]));
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        handleLogout();
        return;
      }
    } catch (e) {
      console.error('Error parsing token:', e);
      handleLogout();
      return;
    }

    // NEW: Check for stored expiration status
    const storedStatus = localStorage.getItem('accountExpirationStatus');
    if (storedStatus) {
      try {
        const status = JSON.parse(storedStatus);
        setAccountExpirationStatus(status);
      } catch (e) {
        console.error('Error parsing expiration status:', e);
      }
    }

  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}, [cookies, handleLogout]);
```

#### C. Add API Error Interceptor
```typescript
// NEW: Global API error handler for expiration
useEffect(() => {
  const handleApiError = (event: CustomEvent) => {
    const { status, error, expirationInfo } = event.detail;

    if (status === 403 && error === 'ACCOUNT_EXPIRED') {
      setAccountExpirationStatus({
        isExpired: true,
        type: expirationInfo?.type,
        expirationDate: expirationInfo?.date,
        message: 'Your account has expired. Upgrade to continue.'
      });

      // Show toast notification but DON'T logout
      // (Assuming you have a toast system)
      showToast({
        type: 'warning',
        message: 'Account expired. Please upgrade to make changes.',
        duration: 5000
      });
    }
  };

  window.addEventListener('apiError', handleApiError as EventListener);
  return () => window.removeEventListener('apiError', handleApiError as EventListener);
}, []);
```

#### D. Remove Auto-Logout on 403 Expiration Errors
Modify existing error handling to distinguish between auth errors and expiration errors:

```typescript
// In your API fetch wrapper or axios interceptor
if (response.status === 403 && response.data?.error === 'ACCOUNT_EXPIRED') {
  // Dispatch custom event for expiration handling
  window.dispatchEvent(new CustomEvent('apiError', {
    detail: {
      status: 403,
      error: 'ACCOUNT_EXPIRED',
      expirationInfo: response.data?.data?.expirationInfo
    }
  }));
  return; // Don't logout, just notify
}

// Still handle real 401 auth errors
if (response.status === 401) {
  handleLogout(); // This is a real auth failure
}
```

**Testing**:
- [ ] Expired accounts stay logged in
- [ ] JWT expiration still triggers logout
- [ ] 401 errors still trigger logout
- [ ] 403 expiration errors show notification only
- [ ] Expiration status persists across page refreshes

---

### 3.2 Create Account Expiration Banner Component

**File**: `src/components/AccountExpirationBanner/index.tsx` (NEW FILE)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react'; // Or your icon library

interface AccountExpirationBannerProps {
  type: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED';
  expirationDate?: string;
  familySlug: string;
}

export default function AccountExpirationBanner({
  type,
  expirationDate,
  familySlug
}: AccountExpirationBannerProps) {
  const router = useRouter();
  const [isDismissed, setIsDismissed] = useState(false);

  // Banner is non-dismissible, but can be minimized
  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('expirationBannerMinimized') === 'true';
  });

  const handleUpgradeClick = () => {
    router.push(`/accounts/${familySlug}/billing`);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    localStorage.setItem('expirationBannerMinimized', 'true');
  };

  const handleExpand = () => {
    setIsMinimized(false);
    localStorage.removeItem('expirationBannerMinimized');
  };

  const getMessage = () => {
    switch (type) {
      case 'TRIAL_EXPIRED':
        return {
          title: 'Free Trial Ended',
          message: 'Your free trial has ended. Upgrade now to continue tracking your baby\'s milestones.',
          ctaText: 'Upgrade Now'
        };
      case 'PLAN_EXPIRED':
        return {
          title: 'Subscription Expired',
          message: 'Your subscription has expired. Renew now to continue adding new entries.',
          ctaText: 'Renew Subscription'
        };
      case 'NO_PLAN':
        return {
          title: 'No Active Subscription',
          message: 'Subscribe now to continue tracking your baby\'s activities and milestones.',
          ctaText: 'Subscribe Now'
        };
      case 'CLOSED':
        return {
          title: 'Account Closed',
          message: 'This account has been closed. Contact support for assistance.',
          ctaText: 'Contact Support'
        };
      default:
        return {
          title: 'Account Issue',
          message: 'There is an issue with your account. Please contact support.',
          ctaText: 'Contact Support'
        };
    }
  };

  const { title, message, ctaText } = getMessage();

  if (isMinimized) {
    return (
      <div
        className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600 px-4 py-2 cursor-pointer hover:bg-amber-600 dark:hover:bg-amber-700 transition-colors"
        onClick={handleExpand}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between text-white text-sm">
          <span className="font-medium">⚠️ Account Expired - Click to expand</span>
          <svg className="w-4 h-4" /* chevron down icon */>
            {/* chevron icon */}
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 bg-amber-500 dark:bg-amber-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center flex-1 min-w-0">
            <svg className="w-5 h-5 text-white mr-3 flex-shrink-0" /* warning icon */>
              {/* warning icon SVG */}
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {title}
              </p>
              <p className="text-sm text-amber-100 mt-0.5">
                {message}
                {expirationDate && (
                  <span className="ml-1">
                    (Expired: {new Date(expirationDate).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpgradeClick}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-amber-600 bg-white hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors"
            >
              {ctaText}
            </button>
            <button
              onClick={handleMinimize}
              className="p-1 text-white hover:text-amber-100 transition-colors"
              aria-label="Minimize banner"
            >
              <svg className="w-5 h-5" /* chevron up icon */>
                {/* minimize icon */}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Testing**:
- [ ] Banner shows at top of all pages when account expired
- [ ] Can minimize/expand banner
- [ ] Minimized state persists across page loads
- [ ] Upgrade button navigates to billing page
- [ ] Shows correct message for each expiration type

---

### 3.3 Add Banner to Layout

**File**: `app/(app)/[slug]/layout.tsx`

Add the banner component right after the `<body>` tag:

```typescript
<body className={inter.className}>
  {accountExpirationStatus?.isExpired && (
    <AccountExpirationBanner
      type={accountExpirationStatus.type || 'NO_PLAN'}
      expirationDate={accountExpirationStatus.expirationDate}
      familySlug={params.slug}
    />
  )}

  {/* Rest of layout */}
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    {/* ... */}
  </div>
</body>
```

---

## Phase 4: UI Feedback Components

### 4.1 Create Upgrade Prompt Modal

**File**: `src/components/UpgradePromptModal/index.tsx` (NEW FILE)

```typescript
'use client';

import { useRouter } from 'next/navigation';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  familySlug: string;
  expirationType: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN';
  actionAttempted?: string; // e.g., "create log entry", "add baby"
}

export default function UpgradePromptModal({
  isOpen,
  onClose,
  familySlug,
  expirationType,
  actionAttempted
}: UpgradePromptModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    router.push(`/accounts/${familySlug}/billing`);
  };

  const getContent = () => {
    switch (expirationType) {
      case 'TRIAL_EXPIRED':
        return {
          title: 'Free Trial Ended',
          message: `Your free trial has ended. Upgrade to continue ${actionAttempted || 'using all features'}.`,
          benefits: [
            'Unlimited log entries',
            'Track multiple babies',
            'Export your data',
            'Advanced insights and charts',
            'Mobile app access'
          ]
        };
      case 'PLAN_EXPIRED':
        return {
          title: 'Subscription Expired',
          message: `Your subscription has expired. Renew now to ${actionAttempted || 'continue tracking'}.`,
          benefits: [
            'Continue tracking activities',
            'Access all your historical data',
            'Share with caretakers',
            'Export reports',
            'Priority support'
          ]
        };
      default:
        return {
          title: 'Upgrade Required',
          message: `Subscribe to ${actionAttempted || 'access this feature'}.`,
          benefits: [
            'Full tracking capabilities',
            'Unlimited babies',
            'Data export',
            'Advanced features',
            'Mobile app'
          ]
        };
    }
  };

  const { title, message, benefits } = getContent();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-amber-600 dark:text-amber-500" /* icon */>
                  {/* Upgrade icon */}
                </svg>
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-white">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {message}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300">
                        <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" /* checkmark */>
                          {/* checkmark icon */}
                        </svg>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
            <button
              type="button"
              onClick={handleUpgrade}
              className="inline-flex w-full justify-center rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-500 sm:w-auto"
            >
              Upgrade Now
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 sm:mt-0 sm:w-auto"
            >
              View Data Only
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Testing**:
- [ ] Modal opens when write operation attempted
- [ ] Shows appropriate message based on expiration type
- [ ] Upgrade button navigates to billing
- [ ] Close button dismisses modal
- [ ] Backdrop click dismisses modal

---

### 4.2 Create Read-Only Badge Component

**File**: `src/components/ReadOnlyBadge/index.tsx` (NEW FILE)

```typescript
'use client';

interface ReadOnlyBadgeProps {
  onClick?: () => void;
  variant?: 'button' | 'badge' | 'icon';
  showTooltip?: boolean;
}

export default function ReadOnlyBadge({
  onClick,
  variant = 'badge',
  showTooltip = true
}: ReadOnlyBadgeProps) {

  if (variant === 'icon') {
    return (
      <div className="relative group">
        <svg
          className="w-5 h-5 text-amber-500 cursor-help"
          onClick={onClick}
          /* lock icon */
        >
          {/* lock icon SVG */}
        </svg>
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Upgrade to enable this feature
          </div>
        )}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors disabled:cursor-not-allowed"
      >
        <svg className="w-4 h-4 mr-1.5" /* lock icon */>
          {/* lock icon */}
        </svg>
        Read-Only Mode
      </button>
    );
  }

  // badge variant (default)
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      <svg className="w-3 h-3 mr-1" /* lock icon */>
        {/* lock icon */}
      </svg>
      Read-Only
    </span>
  );
}
```

**Testing**:
- [ ] Badge renders in all variants
- [ ] Tooltip shows on hover for icon variant
- [ ] onClick handler fires correctly
- [ ] Styles work in light and dark mode

---

### 4.3 Disable Write Actions in UI

**Example: Log Entry Form**

Modify components that create/edit data to disable actions when account is expired:

```typescript
'use client';

import { useState, useEffect } from 'react';
import ReadOnlyBadge from '@/components/ReadOnlyBadge';
import UpgradePromptModal from '@/components/UpgradePromptModal';

export default function LogEntryForm({ familySlug }: { familySlug: string }) {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    // Check if account is expired
    const status = localStorage.getItem('accountExpirationStatus');
    if (status) {
      const parsed = JSON.parse(status);
      setIsReadOnly(parsed.isExpired === true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReadOnly) {
      setShowUpgradeModal(true);
      return;
    }

    // ... normal submit logic
  };

  return (
    <div>
      {isReadOnly && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center">
            <ReadOnlyBadge variant="icon" showTooltip={false} />
            <span className="ml-2 text-sm text-amber-800 dark:text-amber-200">
              Upgrade to add new entries
            </span>
          </div>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
          >
            Learn More
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Form fields */}

        <button
          type="submit"
          disabled={isReadOnly}
          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isReadOnly ? (
            <>
              <ReadOnlyBadge variant="icon" showTooltip={false} />
              <span className="ml-2">Upgrade to Save</span>
            </>
          ) : (
            'Save Entry'
          )}
        </button>
      </form>

      <UpgradePromptModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        familySlug={familySlug}
        expirationType="TRIAL_EXPIRED" // Get from actual status
        actionAttempted="create log entries"
      />
    </div>
  );
}
```

**Apply similar patterns to:**
- Baby creation forms
- Settings forms
- Caretaker management
- Milestone tracking
- Any other write operations

---

## Phase 5: API Response Standardization

### 5.1 Create Centralized API Client

**File**: `src/lib/api-client.ts` (NEW OR MODIFY EXISTING)

```typescript
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public expirationInfo?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle account expiration specifically
      if (response.status === 403 && data.error === 'ACCOUNT_EXPIRED') {
        // Dispatch custom event for global handling
        window.dispatchEvent(new CustomEvent('apiError', {
          detail: {
            status: 403,
            error: 'ACCOUNT_EXPIRED',
            message: data.message,
            expirationInfo: data.data?.expirationInfo
          }
        }));

        throw new ApiError(
          data.message || 'Account expired',
          403,
          'ACCOUNT_EXPIRED',
          data.data?.expirationInfo
        );
      }

      // Handle regular auth errors
      if (response.status === 401) {
        window.dispatchEvent(new CustomEvent('authError', {
          detail: { status: 401, message: data.error }
        }));
        throw new ApiError(data.error || 'Unauthorized', 401);
      }

      throw new ApiError(
        data.error || data.message || 'An error occurred',
        response.status
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0);
  }
}
```

**Testing**:
- [ ] 403 ACCOUNT_EXPIRED triggers custom event
- [ ] 401 errors trigger auth error event
- [ ] Expiration info passed through correctly
- [ ] Regular errors handled properly

---

### 5.2 Update API Response Types

**File**: `app/api/types.ts` (MODIFY EXISTING)

```typescript
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;

  // NEW: For expiration-related responses
  expirationInfo?: {
    type: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED';
    date?: string;
    upgradeUrl?: string;
  };
};
```

---

## Phase 6: Testing Strategy

### 6.1 Backend Testing

**Test Scenarios**:

1. **Login Flow**
   - [ ] Expired trial account can log in
   - [ ] Expired plan account can log in
   - [ ] No plan account can log in
   - [ ] Closed account cannot log in
   - [ ] Beta participant can log in (any status)
   - [ ] JWT token contains subscription data

2. **Authentication Middleware**
   - [ ] Expired account returns `authenticated: true, accountExpired: true`
   - [ ] `expirationInfo` contains correct data
   - [ ] Active account returns normal auth result
   - [ ] `skipExpirationCheck: true` bypasses check

3. **Write Protection**
   - [ ] Expired account POST returns 403 with expiration info
   - [ ] Expired account PUT returns 403
   - [ ] Expired account DELETE returns 403
   - [ ] Active account can perform all write operations
   - [ ] Error message includes upgrade URL

4. **Read Access**
   - [ ] Expired account can GET log entries
   - [ ] Expired account can GET baby data
   - [ ] Expired account can GET settings
   - [ ] All read operations work normally

### 6.2 Frontend Testing

**Test Scenarios**:

1. **Login Screen**
   - [ ] Warning banner shows for expired accounts
   - [ ] Login still works for expired accounts
   - [ ] Active accounts don't see warning
   - [ ] Expiration status stored in localStorage

2. **Layout**
   - [ ] Expiration banner shows on all pages
   - [ ] Banner can be minimized/expanded
   - [ ] Minimized state persists
   - [ ] JWT expiration still triggers logout
   - [ ] 401 errors trigger logout
   - [ ] 403 expiration errors don't trigger logout

3. **UI Components**
   - [ ] ReadOnlyBadge renders correctly
   - [ ] UpgradePromptModal shows on write attempts
   - [ ] Form submit buttons disabled when expired
   - [ ] Upgrade buttons navigate correctly

4. **Data Access**
   - [ ] Can view all historical data
   - [ ] Charts and analytics work
   - [ ] Export functionality works (if read-only)
   - [ ] Navigation works normally

### 6.3 Integration Testing

**End-to-End Scenarios**:

1. **Expired Trial User Journey**
   - [ ] User logs in successfully
   - [ ] Sees warning banner
   - [ ] Can browse all pages
   - [ ] Can view all historical data
   - [ ] Cannot create new log entry
   - [ ] Sees upgrade modal on write attempt
   - [ ] Can click upgrade and reach billing page

2. **Mid-Session Expiration**
   - [ ] User logged in with active subscription
   - [ ] Subscription expires (mock server time)
   - [ ] Next API call returns expiration error
   - [ ] Banner appears without logout
   - [ ] User can continue viewing data
   - [ ] Write operations now blocked

3. **Active User Journey** (Control)
   - [ ] Normal login
   - [ ] No banners or warnings
   - [ ] All features work normally
   - [ ] Can perform all operations

### 6.4 Manual Testing Checklist

**Setup**:
```sql
-- Create test accounts in database
-- Expired trial
UPDATE Account SET trialEnds = '2024-01-01' WHERE email = 'expired-trial@test.com';

-- Expired plan
UPDATE Account
SET planType = 'monthly', planExpires = '2024-01-01'
WHERE email = 'expired-plan@test.com';

-- No plan
UPDATE Account
SET trialEnds = NULL, planType = NULL, planExpires = NULL
WHERE email = 'no-plan@test.com';

-- Active trial
UPDATE Account SET trialEnds = '2026-12-31' WHERE email = 'active-trial@test.com';

-- Active plan
UPDATE Account
SET planType = 'monthly', planExpires = '2026-12-31'
WHERE email = 'active-plan@test.com';

-- Beta participant (should never expire)
UPDATE Account
SET betaparticipant = true, trialEnds = '2020-01-01'
WHERE email = 'beta@test.com';
```

**Manual Test Plan**:
- [ ] Test each account type login
- [ ] Test read operations for each type
- [ ] Test write operations for each type
- [ ] Test banner display
- [ ] Test modal interactions
- [ ] Test upgrade flow navigation
- [ ] Test dark mode appearance
- [ ] Test mobile responsive design

---

## Phase 7: Database Considerations

### 7.1 No Schema Changes Required

The existing Prisma schema already has all necessary fields:
- `trialEnds`
- `planExpires`
- `planType`
- `betaparticipant`
- `closed`

**No migrations needed** for this implementation.

### 7.2 Data Integrity Checks

Before deployment, verify:
```sql
-- Check for accounts with inconsistent states
SELECT
  id,
  email,
  trialEnds,
  planExpires,
  planType,
  betaparticipant,
  closed
FROM Account
WHERE
  (trialEnds IS NOT NULL AND trialEnds < NOW() AND planType IS NULL)
  OR (planExpires IS NOT NULL AND planExpires < NOW() AND trialEnds IS NULL)
  OR (trialEnds IS NULL AND planType IS NULL AND betaparticipant = false);
```

---

## Phase 8: Deployment Plan

### 8.1 Pre-Deployment

**Code Review Checklist**:
- [ ] All backend changes reviewed
- [ ] All frontend changes reviewed
- [ ] Types updated consistently
- [ ] Error messages are user-friendly
- [ ] No console.log statements left
- [ ] Dark mode styles verified

**Testing Checklist**:
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Mobile responsive verified
- [ ] Browser compatibility checked

**Documentation**:
- [ ] Update this document with any changes
- [ ] Document new API error responses
- [ ] Update component documentation

### 8.2 Deployment Steps

**Staging Deployment**:
1. Deploy to staging environment
2. Run full test suite
3. Manual smoke testing with test accounts
4. Verify expiration banner appearance
5. Test upgrade flow navigation
6. Check analytics/monitoring setup

**Production Deployment**:
1. Schedule during low-traffic period
2. Deploy backend changes first
3. Monitor error rates
4. Deploy frontend changes
5. Monitor user sessions
6. Verify no spike in errors

**Rollback Plan**:
If critical issues arise:
1. Revert frontend to previous version (priority)
2. Revert backend to previous version
3. Check for any users stuck in bad state
4. Communicate with affected users

### 8.3 Post-Deployment Monitoring

**Metrics to Watch**:
- [ ] Login success rate for expired accounts
- [ ] API 403 error rates
- [ ] Write operation attempt rates from expired accounts
- [ ] Upgrade conversion rate from banner/modal
- [ ] User complaints/support tickets

**Analytics to Track**:
- Banner interaction rates (minimize/expand)
- Upgrade button click rates
- Modal open rates
- Time-to-upgrade for expired users
- Read-only session duration

---

## Phase 9: User Communication

### 9.1 In-App Messaging

**For Currently Expired Users**:
- Email notification about new read-only access
- Highlight that they can now view their data
- Clear upgrade CTA

**For All Users**:
- No action required for active subscriptions
- Change is invisible to active users
- Better experience when subscription expires

### 9.2 Support Documentation

Update help docs:
- "What happens when my trial ends?"
- "Can I access my data after expiration?"
- "How do I upgrade my account?"
- "What features are available in read-only mode?"

---

## Phase 10: Future Enhancements

### 10.1 Potential Improvements

**Grace Period**:
- Add 7-day grace period after expiration
- Full access during grace period
- Daily reminders to upgrade

**Partial Access**:
- Allow 1-2 log entries per day for expired accounts
- "Freemium" tier with limited features

**Export Before Expiration**:
- One-time data export for expired accounts
- CSV/PDF download of historical data

**Referral Credits**:
- Extend expiration for successful referrals
- Loyalty rewards for long-term subscribers

### 10.2 Technical Debt

**Refactoring Opportunities**:
- Create `useAccountStatus` hook to centralize expiration checks
- Extract expiration logic into dedicated service class
- Create reusable UI component library for expiration states
- Implement React Query for account status caching

---

## Summary

This implementation converts the punitive "hard lockout" system into a respectful "soft notification" system that:

1. ✅ Allows expired users to log in
2. ✅ Provides full read access to historical data
3. ✅ Blocks write operations with clear upgrade prompts
4. ✅ Shows persistent but non-intrusive expiration notifications
5. ✅ Maintains security and prevents abuse
6. ✅ Creates conversion opportunities for upgrades
7. ✅ Treats users' data with respect

### Files Modified (Summary)

**Backend**:
- `app/api/auth/route.ts` - Remove login blocking
- `app/api/utils/auth.ts` - Return authenticated with expiration data
- `app/api/utils/writeProtection.ts` - NEW: Write protection middleware
- `app/api/types.ts` - Add expiration types
- All write endpoint routes - Add write protection

**Frontend**:
- `src/components/LoginSecurity/index.tsx` - Remove hard block
- `app/(app)/[slug]/layout.tsx` - Remove auto-logout, add banner
- `src/components/AccountExpirationBanner/index.tsx` - NEW
- `src/components/UpgradePromptModal/index.tsx` - NEW
- `src/components/ReadOnlyBadge/index.tsx` - NEW
- `src/lib/api-client.ts` - Centralized error handling
- All form components - Add read-only mode

### Estimated Effort

- **Backend**: 2-3 days
- **Frontend UI**: 2-3 days
- **Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: 7-10 days

### Success Criteria

- [ ] Expired users can log in and view data
- [ ] Write operations properly blocked with clear messaging
- [ ] No increase in support tickets
- [ ] Positive user feedback
- [ ] Increased upgrade conversion rate
- [ ] No security vulnerabilities introduced
