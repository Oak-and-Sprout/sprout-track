import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';

async function putHandler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ setupStage: number }>>> {
  try {
    const body = await req.json();
    const { setupStage, familyId } = body;

    if (typeof setupStage !== 'number' || setupStage < 1 || setupStage > 3) {
      return NextResponse.json({
        success: false,
        error: 'setupStage must be a number between 1 and 3',
      }, { status: 400 });
    }

    if (!familyId || typeof familyId !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'familyId is required',
      }, { status: 400 });
    }

    // Resolve the authorized familyId
    let authorizedFamilyId = authContext.familyId;

    // For setup auth, look up family via the setup token
    if (!authorizedFamilyId && authContext.isSetupAuth && authContext.setupToken) {
      const setupToken = await prisma.familySetup.findUnique({
        where: { token: authContext.setupToken },
      });
      if (setupToken?.familyId) {
        authorizedFamilyId = setupToken.familyId;
      }
    }

    // Verify the requested familyId matches the authorized family
    if (authorizedFamilyId !== familyId) {
      return NextResponse.json({
        success: false,
        error: 'Not authorized for this family',
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

    // Only allow incrementing — can't go backwards
    if (setupStage <= family.setupStage) {
      return NextResponse.json({
        success: true,
        data: { setupStage: family.setupStage },
      });
    }

    const updated = await prisma.family.update({
      where: { id: familyId },
      data: { setupStage },
    });

    return NextResponse.json({
      success: true,
      data: { setupStage: updated.setupStage },
    });
  } catch (error) {
    console.error('Error updating setup stage:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update setup stage',
    }, { status: 500 });
  }
}

export const PUT = withAuthContext(putHandler);
