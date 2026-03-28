import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';

interface SetupStatusData {
  setupStage: number;
  canSetup: boolean;
  currentStage: 2 | 3;
  familyData: {
    id: string;
    name: string;
    slug: string;
    authType: string | null;
    securityPin: string | null;
    caretakers: Array<{
      loginId: string;
      name: string;
      type: string;
      role: 'ADMIN' | 'USER';
      securityPin: string;
    }>;
  };
}

async function getHandler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<SetupStatusData>>> {
  try {
    let familyId = authContext.familyId;

    // For setup auth, look up family via the setup token
    if (!familyId && authContext.isSetupAuth && authContext.setupToken) {
      const setupToken = await prisma.familySetup.findUnique({
        where: { token: authContext.setupToken },
      });
      if (setupToken?.familyId) {
        familyId = setupToken.familyId;
      }
    }

    if (!familyId) {
      return NextResponse.json({
        success: false,
        error: 'No family context available',
      }, { status: 403 });
    }

    const family = await prisma.family.findUnique({
      where: { id: familyId },
    });

    if (!family) {
      return NextResponse.json({
        success: false,
        error: 'Family not found',
      }, { status: 404 });
    }

    // Determine if user can setup this family
    let canSetup = false;

    // Setup auth users (token-based) — already validated by withAuthContext
    if (authContext.isSetupAuth) {
      canSetup = true;
    }
    // Account owner
    else if (authContext.accountId && family.accountId === authContext.accountId) {
      canSetup = true;
    }
    // System administrator
    else if (authContext.isSysAdmin) {
      canSetup = true;
    }
    // Family admin caretaker
    else if (authContext.caretakerRole === 'ADMIN' && authContext.familyId === family.id) {
      canSetup = true;
    }

    // Fetch settings for this family
    const settings = await prisma.settings.findFirst({
      where: { familyId: family.id },
    });

    // Fetch non-system caretakers for pre-filling Stage 2
    const caretakers = await prisma.caretaker.findMany({
      where: {
        familyId: family.id,
        loginId: { not: '00' },
        deletedAt: null,
      },
      select: {
        loginId: true,
        name: true,
        type: true,
        role: true,
        securityPin: true,
      },
    });

    const setupStage = family.setupStage;
    const currentStage = Math.max(setupStage + 1, 2) as 2 | 3;

    return NextResponse.json({
      success: true,
      data: {
        setupStage,
        canSetup,
        currentStage: currentStage > 3 ? 3 : currentStage as 2 | 3,
        familyData: {
          id: family.id,
          name: family.name,
          slug: family.slug,
          authType: settings?.authType ?? null,
          securityPin: settings?.securityPin ?? null,
          caretakers: caretakers.map(c => ({
            loginId: c.loginId,
            name: c.name,
            type: c.type || '',
            role: c.role as 'ADMIN' | 'USER',
            securityPin: c.securityPin,
          })),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching setup status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch setup status',
    }, { status: 500 });
  }
}

export const GET = withAuthContext(getHandler);
