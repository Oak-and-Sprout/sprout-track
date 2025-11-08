import { NextResponse } from 'next/server';
import { AuthResult } from './auth';
import type { ApiResponse } from '../types';

export type WriteProtectionResponse = {
  allowed: boolean;
  response?: NextResponse<ApiResponse<any>>;
};

/**
 * Check if a write operation should be allowed based on account expiration status
 * Use this with an existing authContext (from withAuthContext wrapper)
 *
 * IMPORTANT: This only enforces write protection in SaaS mode.
 * In self-hosted mode, all write operations are allowed (maintains backward compatibility).
 *
 * @param authContext - The authentication context (from withAuthContext)
 * @returns WriteProtectionResponse with allowed flag and response (if blocked)
 *
 * @example
 * ```typescript
 * async function handlePost(req: NextRequest, authContext: AuthResult) {
 *   const writeCheck = checkWritePermission(authContext);
 *   if (!writeCheck.allowed) {
 *     return writeCheck.response; // Returns 403 with expiration info
 *   }
 *   // ... rest of endpoint
 * }
 * ```
 */
export function checkWritePermission(
  authContext: AuthResult
): WriteProtectionResponse {

  if (!authContext.authenticated) {
    return {
      allowed: false,
      response: NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: authContext.error || 'Authentication required',
        },
        { status: 401 }
      )
    };
  }

  // Check if account is expired and write operations are blocked
  // This will only happen in SaaS mode, as auth.ts only sets isExpired in SaaS mode
  if (authContext.isExpired) {
    const { trialEnds, planExpires } = authContext;

    // Determine expiration type for user-friendly messaging
    let expirationType: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' = 'NO_PLAN';
    let expirationDate: string | undefined;

    if (trialEnds) {
      expirationType = 'TRIAL_EXPIRED';
      expirationDate = trialEnds;
    } else if (planExpires) {
      expirationType = 'PLAN_EXPIRED';
      expirationDate = planExpires;
    }

    // Generate user-friendly error message
    let errorMessage = 'Your account has expired. Please upgrade to continue.';
    if (expirationType === 'TRIAL_EXPIRED') {
      errorMessage = 'Your free trial has ended. Upgrade to continue tracking.';
    } else if (expirationType === 'PLAN_EXPIRED') {
      errorMessage = 'Your subscription has expired. Please renew to continue.';
    } else if (expirationType === 'NO_PLAN') {
      errorMessage = 'No active subscription found. Please subscribe to continue.';
    }

    return {
      allowed: false,
      response: NextResponse.json<ApiResponse<any>>(
        {
          success: false,
          error: errorMessage,
          data: {
            expirationInfo: {
              type: expirationType,
              date: expirationDate,
              familySlug: authContext.familySlug
            }
          }
        },
        { status: 403 }
      )
    };
  }

  return {
    allowed: true
  };
}
