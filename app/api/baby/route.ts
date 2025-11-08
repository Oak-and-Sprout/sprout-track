import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BabyCreate, BabyUpdate, BabyResponse } from '../types';
import { Gender } from '@prisma/client';
import { toUTC, formatForResponse } from '../utils/timezone';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId, isSetupAuth, isSysAdmin, isAccountAuth } = authContext;
    
    const requestBody = await req.json();
    const { familyId: bodyFamilyId, ...babyData } = requestBody;
    const body: BabyCreate = babyData;
    
    // Determine target family ID - prefer auth context, but allow body override for setup auth, account auth, and sysadmin
    let targetFamilyId = userFamilyId;
    if (!userFamilyId && (isSetupAuth || isSysAdmin || isAccountAuth) && bodyFamilyId) {
      targetFamilyId = bodyFamilyId;
    }
    
    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const baby = await prisma.baby.create({
      data: {
        ...body,
        birthDate: toUTC(body.birthDate),
        familyId: targetFamilyId, // Set family ID from trusted context or setup auth
      },
    });

    // Format response with ISO strings
    const response: BabyResponse = {
      ...baby,
      birthDate: formatForResponse(baby.birthDate) || '',
      createdAt: formatForResponse(baby.createdAt) || '',
      updatedAt: formatForResponse(baby.updatedAt) || '',
      deletedAt: formatForResponse(baby.deletedAt),
    };

    return NextResponse.json<ApiResponse<BabyResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating baby:', error);
    return NextResponse.json<ApiResponse<BabyResponse>>(
      {
        success: false,
        error: 'Failed to create baby',
      },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId, isSysAdmin } = authContext;
    
    const requestBody = await req.json();
    const { id, familyId: bodyFamilyId, ...updateData } = requestBody;
    const body: BabyUpdate = { id, ...updateData };
    
    // For system administrators, allow familyId to be specified in request body
    let targetFamilyId = userFamilyId;
    if (!userFamilyId && isSysAdmin && bodyFamilyId) {
      targetFamilyId = bodyFamilyId;
    }
    
    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const existingBaby = await prisma.baby.findFirst({
      where: { id, familyId: targetFamilyId },
    });

    if (!existingBaby) {
      return NextResponse.json<ApiResponse<BabyResponse>>(
        {
          success: false,
          error: 'Baby not found or access denied',
        },
        { status: 404 }
      );
    }

    const baby = await prisma.baby.update({
      where: { id },
      data: {
        ...updateData,
        birthDate: updateData.birthDate ? toUTC(updateData.birthDate) : existingBaby.birthDate,
      },
    });

    // Format response with ISO strings
    const response: BabyResponse = {
      ...baby,
      birthDate: formatForResponse(baby.birthDate) || '',
      createdAt: formatForResponse(baby.createdAt) || '',
      updatedAt: formatForResponse(baby.updatedAt) || '',
      deletedAt: formatForResponse(baby.deletedAt),
    };

    return NextResponse.json<ApiResponse<BabyResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating baby:', error);
    return NextResponse.json<ApiResponse<BabyResponse>>(
      {
        success: false,
        error: 'Failed to update baby',
      },
      { status: 500 }
    );
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId: userFamilyId, isSysAdmin } = authContext;
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const familyId = searchParams.get('familyId');

    if (!id) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Baby ID is required',
        },
        { status: 400 }
      );
    }

    // For system administrators, allow familyId to be specified as query parameter
    let targetFamilyId = userFamilyId;
    if (!userFamilyId && isSysAdmin && familyId) {
      targetFamilyId = familyId;
    }
    
    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    // Verify baby belongs to user's family before deleting
    const existingBaby = await prisma.baby.findFirst({
      where: { id, familyId: targetFamilyId },
    });

    if (!existingBaby) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Baby not found or access denied',
        },
        { status: 404 }
      );
    }

    // Soft delete by setting deletedAt
    await prisma.baby.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting baby:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete baby',
      },
      { status: 500 }
    );
  }
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId, isSysAdmin } = authContext;
    
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const familyId = searchParams.get('familyId');
    
    // For system administrators, allow familyId to be specified as query parameter
    let targetFamilyId = userFamilyId;
    if (!userFamilyId && isSysAdmin && familyId) {
      targetFamilyId = familyId;
    }
    
    if (!targetFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }
    
    if (id) {
      const baby = await prisma.baby.findFirst({
        where: { 
          id,
          deletedAt: null,
          familyId: targetFamilyId, // Filter by family ID from context
        },
      });

      if (!baby) {
        return NextResponse.json<ApiResponse<BabyResponse>>(
          {
            success: false,
            error: 'Baby not found',
          },
          { status: 404 }
        );
      }

      // Format response with ISO strings
      const response: BabyResponse = {
        ...baby,
        birthDate: formatForResponse(baby.birthDate) || '',
        createdAt: formatForResponse(baby.createdAt) || '',
        updatedAt: formatForResponse(baby.updatedAt) || '',
        deletedAt: formatForResponse(baby.deletedAt),
      };

      return NextResponse.json<ApiResponse<BabyResponse>>({
        success: true,
        data: response,
      });
    }

    const babies = await prisma.baby.findMany({
      where: {
        deletedAt: null,
        familyId: targetFamilyId, // Filter by family ID from context
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format response with ISO strings
    const response: BabyResponse[] = babies.map(baby => ({
      ...baby,
      birthDate: formatForResponse(baby.birthDate) || '',
      createdAt: formatForResponse(baby.createdAt) || '',
      updatedAt: formatForResponse(baby.updatedAt) || '',
      deletedAt: formatForResponse(baby.deletedAt),
    }));

    return NextResponse.json<ApiResponse<BabyResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching babies:', error);
    return NextResponse.json<ApiResponse<BabyResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch babies',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware to all handlers
// Use type assertions to handle the multiple return types
export const GET = withAuthContext(handleGet as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const POST = withAuthContext(handlePost as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const PUT = withAuthContext(handlePut as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const DELETE = withAuthContext(handleDelete as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
