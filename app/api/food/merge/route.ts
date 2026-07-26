import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FoodMergeResult } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { checkWritePermission } from '../../utils/writeProtection';
import { validateFoodMerge } from '@/src/utils/foodLogUtils';

/**
 * Handle POST request to merge one catalog food into another (Settings >
 * Foods). Re-points every FoodLog row (soft-deleted ones included, so
 * history stays intact) from the source food to the target, ORs the
 * commonAllergen flag onto the target, and soft-deletes the source.
 * The target keeps its own name and notes.
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const validation = validateFoodMerge(body.sourceFoodId, body.targetFoodId);
    if (!validation.valid) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    const { sourceFoodId, targetFoodId } = validation;

    // Both foods must exist, be non-deleted, and belong to the family
    const foods = await prisma.food.findMany({
      where: {
        id: { in: [sourceFoodId, targetFoodId] },
        familyId: userFamilyId,
        deletedAt: null,
      },
    });
    const source = foods.find(food => food.id === sourceFoodId);
    const target = foods.find(food => food.id === targetFoodId);
    if (!source || !target) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Food not found or access denied' },
        { status: 404 }
      );
    }

    const movedCount = await prisma.$transaction(async (tx) => {
      const moved = await tx.foodLog.updateMany({
        where: { foodId: source.id },
        data: { foodId: target.id },
      });
      await tx.food.update({
        where: { id: target.id },
        data: { commonAllergen: source.commonAllergen || target.commonAllergen },
      });
      await tx.food.update({
        where: { id: source.id },
        data: { deletedAt: new Date() },
      });
      return moved.count;
    });

    return NextResponse.json<ApiResponse<FoodMergeResult>>({
      success: true,
      data: { movedCount },
    });
  } catch (error) {
    console.error('Error merging foods:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to merge foods',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const POST = withAuthContext(handlePost as any);
