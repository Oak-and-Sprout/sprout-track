import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FoodProgressResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { computeFoodProgress, deriveAllergens } from '@/src/utils/foodLogUtils';

/**
 * Handle GET request for a baby's all-time food-try progress
 * ("100 foods before 1" — cumulative, not date-range-bound):
 * unique-food count, total tries, enjoyment breakdown, and the
 * allergen/reaction profile derived from reaction-flagged logs.
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby ID is required' },
        { status: 400 }
      );
    }

    // Validate that the baby belongs to the family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    const [foodLogs, foods] = await Promise.all([
      prisma.foodLog.findMany({
        where: { babyId, familyId: userFamilyId, deletedAt: null },
        select: {
          foodId: true,
          time: true,
          enjoyment: true,
          hadReaction: true,
          reactionDescription: true,
        },
      }),
      // Include soft-deleted foods so historical reactions keep their names
      prisma.food.findMany({
        where: { familyId: userFamilyId },
        select: { id: true, name: true, commonAllergen: true },
      }),
    ]);

    const progress = computeFoodProgress(foodLogs);

    const response: FoodProgressResponse = {
      uniqueFoodCount: progress.uniqueFoodCount,
      totalTries: progress.totalTries,
      byEnjoyment: progress.countsByEnjoyment,
      allergens: deriveAllergens(foodLogs, foods),
    };

    return NextResponse.json<ApiResponse<FoodProgressResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching food progress:', error);
    return NextResponse.json<ApiResponse<FoodProgressResponse>>(
      {
        success: false,
        error: 'Failed to fetch food progress',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware
export const GET = withAuthContext(handleGet as any);
