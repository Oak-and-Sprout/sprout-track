import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, FoodCreate, FoodResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { normalizeFoodName, foodNameKey } from '@/src/utils/foodLogUtils';

/**
 * Format a Food catalog row into a FoodResponse
 */
function formatFood(food: any): FoodResponse {
  const { _count, ...rest } = food;
  return {
    ...rest,
    ...(_count !== undefined && { foodLogCount: _count.foodLogs }),
    createdAt: formatForResponse(food.createdAt) || '',
    updatedAt: formatForResponse(food.updatedAt) || '',
    deletedAt: formatForResponse(food.deletedAt),
  };
}

/**
 * Check whether a name case-insensitively collides with another non-deleted
 * food in the family (optionally excluding the food being updated).
 */
async function isDuplicateInFamily(name: string, familyId: string, excludeId?: string): Promise<boolean> {
  const foods = await prisma.food.findMany({
    where: {
      familyId,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { name: true },
  });
  const key = foodNameKey(name);
  return foods.some(food => foodNameKey(food.name) === key);
}

/**
 * Handle POST request to create a new food in the family catalog
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

    const body: FoodCreate = await req.json();
    const name = normalizeFoodName(body.name || '');

    if (!name) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Food name is required' },
        { status: 400 }
      );
    }

    if (await isDuplicateInFamily(name, userFamilyId)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'A food with this name already exists' },
        { status: 400 }
      );
    }

    const food = await prisma.food.create({
      data: {
        name,
        commonAllergen: body.commonAllergen === true,
        notes: body.notes && body.notes.trim() ? body.notes : null,
        familyId: userFamilyId,
      },
    });

    return NextResponse.json<ApiResponse<FoodResponse>>({
      success: true,
      data: formatFood(food),
    });
  } catch (error) {
    console.error('Error creating food:', error);
    return NextResponse.json<ApiResponse<FoodResponse>>(
      {
        success: false,
        error: 'Failed to create food',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT request to update a food
 */
async function handlePut(req: NextRequest, authContext: AuthResult) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: Partial<FoodCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<FoodResponse>>(
        {
          success: false,
          error: 'Food ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the food exists and belongs to the family
    const existingFood = await prisma.food.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingFood) {
      return NextResponse.json<ApiResponse<FoodResponse>>(
        {
          success: false,
          error: 'Food not found or access denied',
        },
        { status: 404 }
      );
    }

    let name: string | undefined;
    if (body.name !== undefined) {
      name = normalizeFoodName(body.name);
      if (!name) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Food name is required' },
          { status: 400 }
        );
      }
      if (await isDuplicateInFamily(name, userFamilyId, id)) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'A food with this name already exists' },
          { status: 400 }
        );
      }
    }

    const food = await prisma.food.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(body.commonAllergen !== undefined && { commonAllergen: body.commonAllergen === true }),
        ...(body.notes !== undefined && { notes: body.notes && body.notes.trim() ? body.notes : null }),
      },
    });

    return NextResponse.json<ApiResponse<FoodResponse>>({
      success: true,
      data: formatFood(food),
    });
  } catch (error) {
    console.error('Error updating food:', error);
    return NextResponse.json<ApiResponse<FoodResponse>>(
      {
        success: false,
        error: 'Failed to update food',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET request to fetch the family food catalog
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      const food = await prisma.food.findFirst({
        where: { id, familyId: userFamilyId, deletedAt: null },
      });

      if (!food) {
        return NextResponse.json<ApiResponse<FoodResponse>>(
          {
            success: false,
            error: 'Food not found or access denied',
          },
          { status: 404 }
        );
      }

      return NextResponse.json<ApiResponse<FoodResponse>>({
        success: true,
        data: formatFood(food),
      });
    }

    const foods = await prisma.food.findMany({
      where: {
        familyId: userFamilyId,
        deletedAt: null,
      },
      include: {
        _count: { select: { foodLogs: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json<ApiResponse<FoodResponse[]>>({
      success: true,
      data: foods.map(formatFood),
    });
  } catch (error) {
    console.error('Error fetching foods:', error);
    return NextResponse.json<ApiResponse<FoodResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch foods',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to soft delete a food
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Food ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the food exists and belongs to the family
    const existingFood = await prisma.food.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingFood) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Food not found or access denied',
        },
        { status: 404 }
      );
    }

    // Foods with logs must be merged, not deleted, so history keeps a live food
    const inUse = await prisma.foodLog.count({
      where: { foodId: id, deletedAt: null },
    });
    if (inUse > 0) {
      return NextResponse.json<ApiResponse<void>>(
        { success: false, error: 'This food is still in use. Merge it into another food instead.' },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt
    await prisma.food.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting food:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete food',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware to all handlers
export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
