import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, FoodLogCreate, FoodLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { isValidEnjoyment } from '@/src/utils/foodLogUtils';

// Joined food fields returned with every food log
const foodInclude = {
  food: {
    select: { id: true, name: true, commonAllergen: true },
  },
} as const;

/** True when `value` is a usable amount (positive finite number) or empty (null/undefined). */
function isValidAmount(value: unknown): boolean {
  return value == null || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

/** Normalize a client-sent unitAbbr to a trimmed string or null. */
function normalizeUnitAbbr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Format a food log (with the joined food) into a FoodLogResponse
 */
function formatFoodLog(log: any): FoodLogResponse {
  return {
    ...log,
    time: formatForResponse(log.time) || '',
    createdAt: formatForResponse(log.createdAt) || '',
    updatedAt: formatForResponse(log.updatedAt) || '',
    deletedAt: formatForResponse(log.deletedAt),
  };
}

/**
 * Handle POST request to create a new food log entry
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId, caretakerId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body: FoodLogCreate = await req.json();

    // Validate that the baby belongs to the family
    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    // Validate that the food belongs to the family
    const food = await prisma.food.findFirst({
      where: { id: body.foodId, familyId: userFamilyId, deletedAt: null },
    });

    if (!food) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Food not found in this family.' }, { status: 404 });
    }

    if (body.enjoyment != null && !isValidEnjoyment(body.enjoyment)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid enjoyment value' },
        { status: 400 }
      );
    }

    if (!isValidAmount(body.amount)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const foodLog = await prisma.foodLog.create({
      data: {
        babyId: body.babyId,
        foodId: body.foodId,
        time: toUTC(body.time),
        amount: body.amount ?? null,
        unitAbbr: body.amount != null ? normalizeUnitAbbr(body.unitAbbr) : null,
        enjoyment: body.enjoyment ?? null,
        hadReaction: body.hadReaction === true,
        reactionDescription: body.reactionDescription && body.reactionDescription.trim() ? body.reactionDescription : null,
        notes: body.notes && body.notes.trim() ? body.notes : null,
        ...(body.feedLogId && { feedLogId: body.feedLogId }),
        caretakerId,
        familyId: userFamilyId,
      },
      include: foodInclude,
    });

    return NextResponse.json<ApiResponse<FoodLogResponse>>({
      success: true,
      data: formatFoodLog(foodLog),
    });
  } catch (error) {
    console.error('Error creating food log:', error);
    return NextResponse.json<ApiResponse<FoodLogResponse>>(
      {
        success: false,
        error: 'Failed to create food log',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT request to update a food log entry
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
    const body: Partial<FoodLogCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<FoodLogResponse>>(
        {
          success: false,
          error: 'Food log ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the food log exists and belongs to the family
    const existingFoodLog = await prisma.foodLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingFoodLog) {
      return NextResponse.json<ApiResponse<FoodLogResponse>>(
        {
          success: false,
          error: 'Food log not found or access denied',
        },
        { status: 404 }
      );
    }

    // If the food is being changed, validate the new food belongs to the family
    if (body.foodId && body.foodId !== existingFoodLog.foodId) {
      const food = await prisma.food.findFirst({
        where: { id: body.foodId, familyId: userFamilyId, deletedAt: null },
      });

      if (!food) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Food not found in this family.' }, { status: 404 });
      }
    }

    if (body.enjoyment != null && !isValidEnjoyment(body.enjoyment)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid enjoyment value' },
        { status: 400 }
      );
    }

    if (body.amount !== undefined && !isValidAmount(body.amount)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const foodLog = await prisma.foodLog.update({
      where: { id },
      data: {
        ...(body.time && { time: toUTC(body.time) }),
        ...(body.foodId && { foodId: body.foodId }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...((body.amount !== undefined || body.unitAbbr !== undefined) && {
          // Unit is only meaningful alongside an amount; clearing the amount clears the unit
          unitAbbr: (body.amount !== undefined ? body.amount : existingFoodLog.amount) != null
            ? normalizeUnitAbbr(body.unitAbbr)
            : null,
        }),
        ...(body.enjoyment !== undefined && { enjoyment: body.enjoyment }),
        ...(body.hadReaction !== undefined && { hadReaction: body.hadReaction === true }),
        ...(body.reactionDescription !== undefined && {
          reactionDescription: body.reactionDescription && body.reactionDescription.trim() ? body.reactionDescription : null,
        }),
        ...(body.notes !== undefined && { notes: body.notes && body.notes.trim() ? body.notes : null }),
        ...(body.feedLogId !== undefined && { feedLogId: body.feedLogId || null }),
      },
      include: foodInclude,
    });

    return NextResponse.json<ApiResponse<FoodLogResponse>>({
      success: true,
      data: formatFoodLog(foodLog),
    });
  } catch (error) {
    console.error('Error updating food log:', error);
    return NextResponse.json<ApiResponse<FoodLogResponse>>(
      {
        success: false,
        error: 'Failed to update food log',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET request to fetch food logs
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const babyId = searchParams.get('babyId');
    const foodId = searchParams.get('foodId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (id) {
      const foodLog = await prisma.foodLog.findFirst({
        where: { id, familyId: userFamilyId },
        include: foodInclude,
      });

      if (!foodLog) {
        return NextResponse.json<ApiResponse<FoodLogResponse>>(
          {
            success: false,
            error: 'Food log not found or access denied',
          },
          { status: 404 }
        );
      }

      return NextResponse.json<ApiResponse<FoodLogResponse>>({
        success: true,
        data: formatFoodLog(foodLog),
      });
    }

    const foodLogs = await prisma.foodLog.findMany({
      where: {
        familyId: userFamilyId,
        deletedAt: null,
        ...(babyId && { babyId }),
        ...(foodId && { foodId }),
        ...(startDate && endDate && {
          time: {
            gte: toUTC(startDate),
            lte: toUTC(endDate),
          },
        }),
      },
      include: foodInclude,
      orderBy: { time: 'desc' },
    });

    return NextResponse.json<ApiResponse<FoodLogResponse[]>>({
      success: true,
      data: foodLogs.map(formatFoodLog),
    });
  } catch (error) {
    console.error('Error fetching food logs:', error);
    return NextResponse.json<ApiResponse<FoodLogResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch food logs',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to soft delete a food log
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
          error: 'Food log ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the food log exists and belongs to the family
    const existingFoodLog = await prisma.foodLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingFoodLog) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Food log not found or access denied',
        },
        { status: 404 }
      );
    }

    // Soft delete by setting deletedAt
    await prisma.foodLog.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting food log:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete food log',
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
