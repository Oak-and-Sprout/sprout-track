import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { ApiResponse } from '@/app/api/utils/auth';
import { validateSlug } from '@/app/api/utils/slug-validation';

// This endpoint is unauthenticated (used for slug resolution/availability before login),
// so it returns only the fields callers actually use: identity for the family context and
// slug-uniqueness checks, plus the derived account status. No timestamps, setupStage,
// accountId, or raw account record are exposed.
interface PublicFamily {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  accountStatus?: {
    isExpired: boolean;
    isTrialExpired: boolean;
    expirationDate?: string;
    betaparticipant: boolean;
  };
}

// This endpoint doesn't require authentication as it's used for the initial family selection
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse<ApiResponse<PublicFamily | null>>> {
  try {
    const { slug } = await params;
    
    if (!slug) {
      return NextResponse.json({
        success: false,
        error: 'Family slug is required',
      }, { status: 400 });
    }
    
    // Validate the slug format and check for reserved words
    const validation = validateSlug(slug);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.error,
        data: null,
      }, { status: 400 });
    }
    
    const family = await prisma.family.findFirst({
      where: {
        slug: slug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        account: {
          select: {
            betaparticipant: true,
            trialEnds: true,
            planType: true,
            planExpires: true,
          }
        }
      }
    });

    if (!family) {
      // Return 200 OK with success: false to indicate the slug is available.
      // This avoids a 404 error in the browser console for a simple availability check.
      return NextResponse.json({ success: false, data: null }, { status: 200 });
    }

    // Build the public response with only the exposed fields (drops the raw account record)
    let familyWithStatus: PublicFamily = {
      id: family.id,
      name: family.name,
      slug: family.slug,
      isActive: family.isActive,
    };

    if (family.account) {
      const account = family.account;
      const now = new Date();
      let isExpired = false;
      let isTrialExpired = false;
      let expirationDate: string | undefined;

      // Check if beta participant (always allow access)
      if (account.betaparticipant) {
        familyWithStatus.accountStatus = {
          isExpired: false,
          isTrialExpired: false,
          betaparticipant: true
        };
      } else {
        // Check subscription/trial status
        if (account.trialEnds) {
          const trialEndDate = new Date(account.trialEnds);
          if (now > trialEndDate) {
            isTrialExpired = true;
            isExpired = true;
            expirationDate = account.trialEnds.toISOString();
          }
        } else if (account.planExpires) {
          const planEndDate = new Date(account.planExpires);
          if (now > planEndDate) {
            isExpired = true;
            expirationDate = account.planExpires.toISOString();
          }
        } else if (!account.planType) {
          // No trial, no plan, and not beta - expired
          isExpired = true;
        }

        familyWithStatus.accountStatus = {
          isExpired,
          isTrialExpired,
          expirationDate,
          betaparticipant: false
        };
      }
    }

    // Return 200 OK with success: true to indicate slug is taken.
    return NextResponse.json({
      success: true,
      data: familyWithStatus,
    });
  } catch (error) {
    console.error('Error fetching family by slug:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch family',
      data: null,
    }, { status: 500 });
  }
}
