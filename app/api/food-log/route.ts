import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, FoodLogCreate, FoodLogItemInput, FoodLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import {
  buildFoodLogFoodFields,
  expandFoodItems,
  foodsJsonReferencesFoodId,
  isValidEnjoyment,
  type FoodLogItem,
} from '@/src/utils/foodLogUtils';

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

function normalizeItemInputs(body: Partial<FoodLogCreate>): FoodLogItem[] | null {
  if (Array.isArray(body.foods) && body.foods.length > 0) {
    const items: FoodLogItem[] = [];
    for (const entry of body.foods as FoodLogItemInput[]) {
      if (!entry || typeof entry.foodId !== 'string' || entry.foodId === '') continue;
      items.push({
        foodId: entry.foodId,
        hadReaction: entry.hadReaction === true,
        reactionDescription:
          entry.reactionDescription && entry.reactionDescription.trim()
            ? entry.reactionDescription.trim()
            : null,
      });
    }
    return items.length > 0 ? items : null;
  }
  if (typeof body.foodId === 'string' && body.foodId !== '') {
    return [
      {
        foodId: body.foodId,
        hadReaction: body.hadReaction === true,
        reactionDescription:
          body.reactionDescription && body.reactionDescription.trim()
            ? body.reactionDescription.trim()
            : null,
      },
    ];
  }
  return null;
}

/**
 * Format a food log into a FoodLogResponse, attaching parsed foodItems with names.
 */
function formatFoodLog(
  log: any,
  catalogById?: Map<string, { id: string; name: string; commonAllergen: boolean }>
): FoodLogResponse {
  const items = expandFoodItems(log);
  const foodItems = items.map(item => {
    const meta =
      catalogById?.get(item.foodId) ||
      (log.food?.id === item.foodId ? log.food : undefined);
    return {
      foodId: item.foodId,
      hadReaction: item.hadReaction === true,
      reactionDescription: item.reactionDescription ?? null,
      ...(meta
        ? { name: meta.name, commonAllergen: meta.commonAllergen === true }
        : {}),
    };
  });

  return {
    ...log,
    time: formatForResponse(log.time) || '',
    createdAt: formatForResponse(log.createdAt) || '',
    updatedAt: formatForResponse(log.updatedAt) || '',
    deletedAt: formatForResponse(log.deletedAt),
    foodItems,
  };
}

async function loadCatalogMap(
  familyId: string,
  foodIds: string[]
): Promise<Map<string, { id: string; name: string; commonAllergen: boolean }>> {
  const unique = Array.from(new Set(foodIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const foods = await prisma.food.findMany({
    where: { id: { in: unique }, familyId },
    select: { id: true, name: true, commonAllergen: true },
  });
  return new Map(foods.map(f => [f.id, f]));
}

async function validateFoodIdsInFamily(
  foodIds: string[],
  familyId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const unique = Array.from(new Set(foodIds));
  const foods = await prisma.food.findMany({
    where: { id: { in: unique }, familyId, deletedAt: null },
    select: { id: true },
  });
  if (foods.length !== unique.length) {
    return {
      ok: false,
      response: NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Food not found in this family.' },
        { status: 404 }
      ),
    };
  }
  return { ok: true };
}

/**
 * Handle POST request to create a new food log entry
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
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

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    const items = normalizeItemInputs(body);
    if (!items) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'At least one food is required' },
        { status: 400 }
      );
    }

    const foodCheck = await validateFoodIdsInFamily(
      items.map(i => i.foodId),
      userFamilyId
    );
    if (!foodCheck.ok) return foodCheck.response;

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

    const foodFields = buildFoodLogFoodFields(items);

    const foodLog = await prisma.foodLog.create({
      data: {
        babyId: body.babyId,
        foodId: foodFields.foodId,
        foods: foodFields.foods,
        time: toUTC(body.time),
        amount: body.amount ?? null,
        unitAbbr: body.amount != null ? normalizeUnitAbbr(body.unitAbbr) : null,
        enjoyment: body.enjoyment ?? null,
        hadReaction: foodFields.hadReaction,
        reactionDescription: foodFields.reactionDescription,
        notes: body.notes && body.notes.trim() ? body.notes : null,
        ...(body.feedLogId && { feedLogId: body.feedLogId }),
        caretakerId,
        familyId: userFamilyId,
      },
      include: foodInclude,
    });

    const catalog = await loadCatalogMap(
      userFamilyId,
      items.map(i => i.foodId)
    );

    return NextResponse.json<ApiResponse<FoodLogResponse>>({
      success: true,
      data: formatFoodLog(foodLog, catalog),
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

    const items = normalizeItemInputs(body);
    let foodFields: ReturnType<typeof buildFoodLogFoodFields> | null = null;
    if (items) {
      const foodCheck = await validateFoodIdsInFamily(
        items.map(i => i.foodId),
        userFamilyId
      );
      if (!foodCheck.ok) return foodCheck.response;
      foodFields = buildFoodLogFoodFields(items);
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
        ...(foodFields && {
          foodId: foodFields.foodId,
          foods: foodFields.foods,
          hadReaction: foodFields.hadReaction,
          reactionDescription: foodFields.reactionDescription,
        }),
        ...(body.amount !== undefined && { amount: body.amount }),
        ...((body.amount !== undefined || body.unitAbbr !== undefined) && {
          unitAbbr: (body.amount !== undefined ? body.amount : existingFoodLog.amount) != null
            ? normalizeUnitAbbr(body.unitAbbr)
            : null,
        }),
        ...(body.enjoyment !== undefined && { enjoyment: body.enjoyment }),
        // Legacy single-field reaction updates only when foods[] was not sent
        ...(!foodFields && body.hadReaction !== undefined && { hadReaction: body.hadReaction === true }),
        ...(!foodFields && body.reactionDescription !== undefined && {
          reactionDescription: body.reactionDescription && body.reactionDescription.trim() ? body.reactionDescription : null,
        }),
        ...(body.notes !== undefined && { notes: body.notes && body.notes.trim() ? body.notes : null }),
        ...(body.feedLogId !== undefined && { feedLogId: body.feedLogId || null }),
      },
      include: foodInclude,
    });

    const catalog = await loadCatalogMap(
      userFamilyId,
      expandFoodItems(foodLog).map(i => i.foodId)
    );

    return NextResponse.json<ApiResponse<FoodLogResponse>>({
      success: true,
      data: formatFoodLog(foodLog, catalog),
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

      const catalog = await loadCatalogMap(
        userFamilyId,
        expandFoodItems(foodLog).map(i => i.foodId)
      );

      return NextResponse.json<ApiResponse<FoodLogResponse>>({
        success: true,
        data: formatFoodLog(foodLog, catalog),
      });
    }

    const foodLogs = await prisma.foodLog.findMany({
      where: {
        familyId: userFamilyId,
        deletedAt: null,
        ...(babyId && { babyId }),
        ...(startDate && endDate && {
          time: {
            gte: toUTC(startDate),
            lte: toUTC(endDate),
          },
        }),
        // Narrow by FK when possible; multi-food JSON refs filtered below
        ...(foodId && {
          OR: [
            { foodId },
            { foods: { contains: foodId } },
          ],
        }),
      },
      include: foodInclude,
      orderBy: { time: 'desc' },
    });

    const filtered = foodId
      ? foodLogs.filter(
          log =>
            log.foodId === foodId || foodsJsonReferencesFoodId(log.foods, foodId)
        )
      : foodLogs;

    const allIds = filtered.flatMap(log => expandFoodItems(log).map(i => i.foodId));
    const catalog = await loadCatalogMap(userFamilyId, allIds);

    return NextResponse.json<ApiResponse<FoodLogResponse[]>>({
      success: true,
      data: filtered.map(log => formatFoodLog(log, catalog)),
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

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
