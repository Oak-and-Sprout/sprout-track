import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyAllergenCreate, BabyAllergenUpdate, BabyAllergenResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { normalizeFoodName, foodNameKey, isValidAllergenType } from '@/src/utils/foodLogUtils';

/**
 * Format a BabyAllergen row into a BabyAllergenResponse
 */
function formatAllergen(allergen: any): BabyAllergenResponse {
  return {
    ...allergen,
    createdAt: formatForResponse(allergen.createdAt) || '',
    updatedAt: formatForResponse(allergen.updatedAt) || '',
    deletedAt: formatForResponse(allergen.deletedAt),
  };
}

/**
 * Check whether a name case-insensitively collides with another non-deleted
 * allergen for the same baby (optionally excluding the one being updated).
 */
async function isDuplicateForBaby(name: string, babyId: string, excludeId?: string): Promise<boolean> {
  const allergens = await prisma.babyAllergen.findMany({
    where: {
      babyId,
      deletedAt: null,
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { name: true },
  });
  const key = foodNameKey(name);
  return allergens.some(allergen => foodNameKey(allergen.name) === key);
}

/**
 * Handle POST request to record a new manual allergen for a baby
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

    const body: BabyAllergenCreate = await req.json();

    // Validate that the baby belongs to the family
    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    const name = normalizeFoodName(body.name || '');
    if (!name) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Allergen name is required' },
        { status: 400 }
      );
    }

    if (!isValidAllergenType(body.allergenType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid allergen type' },
        { status: 400 }
      );
    }

    if (await isDuplicateForBaby(name, body.babyId)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'An allergen with this name already exists' },
        { status: 400 }
      );
    }

    const allergen = await prisma.babyAllergen.create({
      data: {
        babyId: body.babyId,
        name,
        allergenType: body.allergenType,
        reactionDescription: body.reactionDescription && body.reactionDescription.trim() ? body.reactionDescription : null,
        notes: body.notes && body.notes.trim() ? body.notes : null,
        caretakerId,
        familyId: userFamilyId,
      },
    });

    return NextResponse.json<ApiResponse<BabyAllergenResponse>>({
      success: true,
      data: formatAllergen(allergen),
    });
  } catch (error) {
    console.error('Error creating baby allergen:', error);
    return NextResponse.json<ApiResponse<BabyAllergenResponse>>(
      {
        success: false,
        error: 'Failed to create allergen',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT request to update a manual allergen
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
    const body: BabyAllergenUpdate = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<BabyAllergenResponse>>(
        {
          success: false,
          error: 'Allergen ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the allergen exists and belongs to the family
    const existingAllergen = await prisma.babyAllergen.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingAllergen) {
      return NextResponse.json<ApiResponse<BabyAllergenResponse>>(
        {
          success: false,
          error: 'Allergen not found or access denied',
        },
        { status: 404 }
      );
    }

    let name: string | undefined;
    if (body.name !== undefined) {
      name = normalizeFoodName(body.name);
      if (!name) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'Allergen name is required' },
          { status: 400 }
        );
      }
      if (await isDuplicateForBaby(name, existingAllergen.babyId, id)) {
        return NextResponse.json<ApiResponse<null>>(
          { success: false, error: 'An allergen with this name already exists' },
          { status: 400 }
        );
      }
    }

    if (body.allergenType !== undefined && !isValidAllergenType(body.allergenType)) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Invalid allergen type' },
        { status: 400 }
      );
    }

    const allergen = await prisma.babyAllergen.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(body.allergenType !== undefined && { allergenType: body.allergenType }),
        ...(body.reactionDescription !== undefined && {
          reactionDescription: body.reactionDescription && body.reactionDescription.trim() ? body.reactionDescription : null,
        }),
        ...(body.notes !== undefined && { notes: body.notes && body.notes.trim() ? body.notes : null }),
      },
    });

    return NextResponse.json<ApiResponse<BabyAllergenResponse>>({
      success: true,
      data: formatAllergen(allergen),
    });
  } catch (error) {
    console.error('Error updating baby allergen:', error);
    return NextResponse.json<ApiResponse<BabyAllergenResponse>>(
      {
        success: false,
        error: 'Failed to update allergen',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET request to list a baby's manual allergens
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

    if (id) {
      const allergen = await prisma.babyAllergen.findFirst({
        where: { id, familyId: userFamilyId, deletedAt: null },
      });

      if (!allergen) {
        return NextResponse.json<ApiResponse<BabyAllergenResponse>>(
          {
            success: false,
            error: 'Allergen not found or access denied',
          },
          { status: 404 }
        );
      }

      return NextResponse.json<ApiResponse<BabyAllergenResponse>>({
        success: true,
        data: formatAllergen(allergen),
      });
    }

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

    const allergens = await prisma.babyAllergen.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json<ApiResponse<BabyAllergenResponse[]>>({
      success: true,
      data: allergens.map(formatAllergen),
    });
  } catch (error) {
    console.error('Error fetching baby allergens:', error);
    return NextResponse.json<ApiResponse<BabyAllergenResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch allergens',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to soft delete a manual allergen
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
          error: 'Allergen ID is required',
        },
        { status: 400 }
      );
    }

    // Check if the allergen exists and belongs to the family
    const existingAllergen = await prisma.babyAllergen.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingAllergen) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Allergen not found or access denied',
        },
        { status: 404 }
      );
    }

    // Soft delete by setting deletedAt
    await prisma.babyAllergen.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting baby allergen:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete allergen',
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
