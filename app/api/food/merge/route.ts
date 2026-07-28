import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FoodMergeResult } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { checkWritePermission } from '../../utils/writeProtection';
import {
  buildFoodLogFoodFields,
  expandFoodItems,
  foodsJsonReferencesFoodId,
  rewriteFoodsJsonIds,
  validateFoodMerge,
} from '@/src/utils/foodLogUtils';

/**
 * Handle POST request to merge one catalog food into another (Settings >
 * Foods). Re-points FoodLog.foodId FK rows and rewrites foods JSON that
 * reference the source id, ORs commonAllergen onto the target, and
 * soft-deletes the source.
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
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

      // Rewrite foods JSON that reference the source (including multi-food meals
      // where foodId FK is null).
      const candidates = await tx.foodLog.findMany({
        where: {
          familyId: userFamilyId,
          OR: [
            { foods: { contains: source.id } },
            { foodId: source.id },
            { foodId: target.id },
          ],
        },
        select: { id: true, foodId: true, foods: true, hadReaction: true, reactionDescription: true },
      });

      let jsonMoved = 0;
      for (const log of candidates) {
        if (!foodsJsonReferencesFoodId(log.foods, source.id) && log.foodId !== source.id) {
          // Still may need to refresh foods JSON after FK remount for dual-write N=1
          if (log.foodId === target.id && !log.foods) {
            const fields = buildFoodLogFoodFields([
              {
                foodId: target.id,
                hadReaction: log.hadReaction === true,
                reactionDescription: log.reactionDescription,
              },
            ]);
            await tx.foodLog.update({
              where: { id: log.id },
              data: { foods: fields.foods },
            });
          }
          continue;
        }

        const rewritten = rewriteFoodsJsonIds(log.foods, source.id, target.id);
        const items = expandFoodItems({
          foodId: log.foodId === source.id ? target.id : log.foodId,
          foods: rewritten,
          time: new Date(),
          hadReaction: log.hadReaction,
          reactionDescription: log.reactionDescription,
        });
        // If foods was null but foodId pointed at source, synthesize after FK remount
        const nextItems =
          items.length > 0
            ? items
            : [
                {
                  foodId: target.id,
                  hadReaction: log.hadReaction === true,
                  reactionDescription: log.reactionDescription,
                },
              ];
        const fields = buildFoodLogFoodFields(nextItems);
        await tx.foodLog.update({
          where: { id: log.id },
          data: {
            foodId: fields.foodId,
            foods: fields.foods,
            hadReaction: fields.hadReaction,
            reactionDescription: fields.reactionDescription,
          },
        });
        jsonMoved += 1;
      }

      await tx.food.update({
        where: { id: target.id },
        data: { commonAllergen: source.commonAllergen || target.commonAllergen },
      });
      await tx.food.update({
        where: { id: source.id },
        data: { deletedAt: new Date() },
      });
      return moved.count + jsonMoved;
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

export const POST = withAuthContext(handlePost as any);
