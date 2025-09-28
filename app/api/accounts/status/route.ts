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
  accountStatus: 'active' | 'inactive' | 'trial' | 'expired' | 'closed' | 'no_family';
}

async function handler(req: NextRequest): Promise<NextResponse<ApiResponse<AccountStatusResponse>>> {
  try {
    // Use the standard auth method
    const authResult = await getAuthenticatedUser(req);
    
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

    if (account.closed) {
      accountStatus = 'closed';
    } else if (!account.family) {
      // No family created yet
      accountStatus = 'no_family';
      // Check if they have a trial for when they do create a family
      if (account.trialEnds) {
        const trialEndDate = new Date(account.trialEnds);
        const now = new Date();
        if (now <= trialEndDate) {
          subscriptionActive = true; // Trial is still valid for when they create family
        }
      } else if (account.planType || account.betaparticipant) {
        subscriptionActive = true;
      }
    } else if (account.trialEnds) {
      const trialEndDate = new Date(account.trialEnds);
      const now = new Date();
      if (now > trialEndDate) {
        accountStatus = 'expired';
      } else {
        accountStatus = 'trial';
        subscriptionActive = true;
      }
    } else if (account.planExpires) {
      const planEndDate = new Date(account.planExpires);
      const now = new Date();
      if (now > planEndDate) {
        accountStatus = 'expired';
      } else {
        subscriptionActive = true;
      }
    } else if (account.betaparticipant) {
      subscriptionActive = true;
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
