import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, ApiResponse } from '../../utils/auth';
import prisma from '../../db';

interface AccountStatusResponse {
  accountId: string;
  email: string;
  firstName: string;
  lastName?: string;
  verified: boolean;
  hasFamily: boolean;
  familySlug?: string;
  familyName?: string;
  betaparticipant: boolean;
  closed: boolean;
  closedAt?: string;
  planType?: string;
  planExpires?: string;
  trialEnds?: string;
  subscriptionActive: boolean;
  subscriptionId?: string;
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
}

async function handler(req: NextRequest): Promise<NextResponse<ApiResponse<AccountStatusResponse>>> {
  try {
    // Use the standard auth method but skip expiration check
    // This allows expired accounts to see their status
    const authResult = await getAuthenticatedUser(req, true);

    if (!authResult.authenticated) {
      return NextResponse.json<ApiResponse<AccountStatusResponse>>(
        {
          success: false,
          error: 'Authentication required'
        },
        { status: 401 }
      );
    }

    // Only allow account authentication for this endpoint
    if (!authResult.isAccountAuth || !authResult.accountId) {
      return NextResponse.json<ApiResponse<AccountStatusResponse>>(
        {
          success: false,
          error: 'Account authentication required'
        },
        { status: 403 }
      );
    }

    // Fetch account with family information
    const account = await prisma.account.findUnique({
      where: { id: authResult.accountId },
      include: {
        family: {
          select: {
            slug: true,
            name: true
          }
        }
      }
    });

    if (!account) {
      return NextResponse.json<ApiResponse<AccountStatusResponse>>(
        {
          success: false,
          error: 'Account not found'
        },
        { status: 404 }
      );
    }

    // Determine account status
    let accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family' = 'active';
    let subscriptionActive = false;
    const now = new Date();

    if (account.closed) {
      accountStatus = 'closed';
    } else if (!account.family) {
      // No family created yet
      accountStatus = 'no_family';
      // Check subscription status (trial does NOT count as active subscription)
      if (account.planType === 'full') {
        // Full license (lifetime) is always active
        subscriptionActive = true;
      } else if (account.planType === 'sub' && account.planExpires) {
        // Subscription - check if not expired
        const planEndDate = new Date(account.planExpires);
        subscriptionActive = now <= planEndDate;
      } else if (account.betaparticipant) {
        subscriptionActive = true;
      }
      // Note: Trial is NOT considered an active subscription
    } else if (account.trialEnds) {
      // Account has family and is in trial
      const trialEndDate = new Date(account.trialEnds);
      if (now > trialEndDate) {
        accountStatus = 'expired';
        subscriptionActive = false;
      } else {
        accountStatus = 'trial';
        subscriptionActive = false; // Trial is NOT considered an active subscription
      }
    } else if (account.planType === 'full') {
      // Full license (lifetime) is always active
      subscriptionActive = true;
    } else if (account.planType === 'sub') {
      // Subscription - check expiration
      if (account.planExpires) {
        const planEndDate = new Date(account.planExpires);
        if (now > planEndDate) {
          accountStatus = 'expired';
          subscriptionActive = false;
        } else {
          subscriptionActive = true;
        }
      } else {
        // Subscription with no expiration date = expired
        accountStatus = 'expired';
        subscriptionActive = false;
      }
    } else if (account.betaparticipant) {
      // Beta participants have lifetime access
      subscriptionActive = true;
    } else {
      // No trial, no plan, not beta = expired
      accountStatus = 'expired';
      subscriptionActive = false;
    }

    return NextResponse.json<ApiResponse<AccountStatusResponse>>({
      success: true,
      data: {
        accountId: account.id,
        email: account.email,
        firstName: account.firstName || '',
        lastName: account.lastName || undefined,
        verified: account.verified,
        hasFamily: !!account.family,
        familySlug: account.family?.slug,
        familyName: account.family?.name,
        betaparticipant: account.betaparticipant,
        closed: account.closed,
        closedAt: account.closedAt?.toISOString(),
        planType: account.planType || undefined,
        planExpires: account.planExpires?.toISOString(),
        trialEnds: account.trialEnds?.toISOString(),
        subscriptionActive,
        subscriptionId: account.subscriptionId || undefined,
        accountStatus
      }
    });

  } catch (error) {
    console.error('Account status error:', error);
    return NextResponse.json<ApiResponse<AccountStatusResponse>>(
      {
        success: false,
        error: 'Failed to fetch account status'
      },
      { status: 500 }
    );
  }
}

export const GET = handler;
