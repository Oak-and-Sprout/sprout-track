import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, CaretakerCreate, CaretakerUpdate, CaretakerResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';
import { toCaretakerResponse } from '../utils/caretaker';
import { resolveFamilyScope } from '../utils/family-scope';

async function postHandler(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can create caretakers.' }, { status: 403 });
    }

    const requestBody = await req.json();
    const { familyId: bodyFamilyId, ...caretakerData } = requestBody;
    const body: CaretakerCreate = caretakerData;

    const { searchParams } = new URL(req.url);
    const queryFamilyId = searchParams.get('familyId');

    const scope = resolveFamilyScope(authContext, bodyFamilyId ?? queryFamilyId);
    if (!scope.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: scope.error }, { status: scope.status });
    }
    const targetFamilyId = scope.familyId;

    // Prevent creating system caretaker through API
    if (body.loginId === '00' || body.type === 'System Administrator') {
      return NextResponse.json<ApiResponse<CaretakerResponse>>(
        {
          success: false,
          error: 'System caretaker cannot be created through this API.',
        },
        { status: 403 }
      );
    }

    const existingCaretaker = await prisma.caretaker.findFirst({
      where: {
        loginId: body.loginId,
        deletedAt: null,
        familyId: targetFamilyId,
      },
    });

    if (existingCaretaker) {
      return NextResponse.json<ApiResponse<CaretakerResponse>>(
        {
          success: false,
          error: 'Login ID is already in use in this family. Please choose a different one.',
        },
        { status: 400 }
      );
    }

    const caretaker = await prisma.caretaker.create({
      data: {
        ...body,
        familyId: targetFamilyId,
      },
    });

    // Create the FamilyMember association for regular caretakers only
    // System caretakers (loginId '00') don't need FamilyMember associations
    if (targetFamilyId && caretaker.loginId !== '00') {
      await prisma.familyMember.create({
        data: {
          familyId: targetFamilyId,
          caretakerId: caretaker.id,
          role: caretaker.role === 'ADMIN' ? 'admin' : 'member',
        },
      });
    }

    const response: CaretakerResponse = toCaretakerResponse(caretaker);

    return NextResponse.json<ApiResponse<CaretakerResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating caretaker:', error);
    return NextResponse.json<ApiResponse<CaretakerResponse>>(
      {
        success: false,
        error: 'Failed to create caretaker',
      },
      { status: 500 }
    );
  }
}

async function putHandler(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can update caretakers.' }, { status: 403 });
    }

    const requestBody = await req.json();
    const { familyId: bodyFamilyId, id, ...updateData } = requestBody;
    const body: CaretakerUpdate = { id, ...updateData };

    // A blank/absent securityPin means "keep the existing PIN". Responses no longer
    // return PINs, so edit forms submit a blank field when the PIN is unchanged — never
    // overwrite the stored PIN with an empty value (which would break that caretaker's login).
    if (updateData.securityPin === '' || updateData.securityPin === undefined || updateData.securityPin === null) {
      delete updateData.securityPin;
    }

    const { searchParams } = new URL(req.url);
    const queryFamilyId = searchParams.get('familyId');

    const scope = resolveFamilyScope(authContext, bodyFamilyId ?? queryFamilyId);
    if (!scope.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: scope.error }, { status: scope.status });
    }
    const targetFamilyId = scope.familyId;

    // Note: System caretaker can be updated (e.g., for PIN changes during setup)

    const existingCaretaker = await prisma.caretaker.findFirst({
      where: {
        id,
        familyId: targetFamilyId,
      },
    });

    if (!existingCaretaker) {
      return NextResponse.json<ApiResponse<CaretakerResponse>>(
        {
          success: false,
          error: 'Caretaker not found or access denied.',
        },
        { status: 404 }
      );
    }

    if (updateData.loginId) {
      const duplicateLoginId = await prisma.caretaker.findFirst({
        where: {
          loginId: updateData.loginId,
          id: { not: id },
          deletedAt: null,
          familyId: targetFamilyId,
        },
      });

      if (duplicateLoginId) {
        return NextResponse.json<ApiResponse<CaretakerResponse>>(
          {
            success: false,
            error: 'Login ID is already in use in this family. Please choose a different one.',
          },
          { status: 400 }
        );
      }
    }

    const caretaker = await prisma.caretaker.update({
      where: { id },
      data: {
        ...updateData,
        familyId: targetFamilyId,
      },
    });

    const response: CaretakerResponse = toCaretakerResponse(caretaker);

    return NextResponse.json<ApiResponse<CaretakerResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating caretaker:', error);
    return NextResponse.json<ApiResponse<CaretakerResponse>>(
      {
        success: false,
        error: 'Failed to update caretaker',
      },
      { status: 500 }
    );
  }
}

async function deleteHandler(req: NextRequest, authContext: AuthResult) {
  // Check write permissions for expired accounts
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can delete caretakers.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const queryFamilyId = searchParams.get('familyId');

    const scope = resolveFamilyScope(authContext, queryFamilyId);
    if (!scope.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: scope.error }, { status: scope.status });
    }
    const targetFamilyId = scope.familyId;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Caretaker ID is required' }, { status: 400 });
    }

    // Check if this is the system caretaker
    const isSystemCaretaker = await prisma.caretaker.findFirst({
      where: {
        id,
        loginId: '00',
        familyId: targetFamilyId
      }
    });

    if (isSystemCaretaker) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'System caretaker cannot be deleted.',
        },
        { status: 403 }
      );
    }

    const existingCaretaker = await prisma.caretaker.findFirst({
      where: { id, familyId: targetFamilyId },
    });

    if (!existingCaretaker) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Caretaker not found or access denied.' }, { status: 404 });
    }

    await prisma.caretaker.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Also remove the FamilyMember association for regular caretakers only
    // System caretakers don't have FamilyMember associations
    if (existingCaretaker.loginId !== '00' && targetFamilyId) {
      await prisma.familyMember.deleteMany({
        where: {
          caretakerId: id,
          familyId: targetFamilyId,
        },
      });
    }

    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (error) {
    console.error('Error deleting caretaker:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to delete caretaker' }, { status: 500 });
  }
}

async function getHandler(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId, isAccountAuth, caretakerId, accountId } = authContext;

    // Debug logging for account users
    if (isAccountAuth) {
      console.log('Caretaker API GET - Account user auth context:', {
        userFamilyId,
        isAccountAuth,
        caretakerId,
        accountId,
        hasAllRequiredFields: !!userFamilyId
      });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const queryFamilyId = searchParams.get('familyId');

    const scope = resolveFamilyScope(authContext, queryFamilyId);
    if (!scope.ok) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: scope.error }, { status: scope.status });
    }
    const targetFamilyId = scope.familyId;

    if (id) {
      const caretaker = await prisma.caretaker.findFirst({
        where: {
          id,
          deletedAt: null,
          familyId: targetFamilyId,
        },
      });

      if (!caretaker) {
        return NextResponse.json<ApiResponse<CaretakerResponse>>(
          { success: false, error: 'Caretaker not found or access denied.' },
          { status: 404 }
        );
      }

      const response: CaretakerResponse = toCaretakerResponse(caretaker);

      return NextResponse.json<ApiResponse<CaretakerResponse>>({ success: true, data: response });
    }

    const caretakers = await prisma.caretaker.findMany({
      where: {
        deletedAt: null,
        familyId: targetFamilyId,
        loginId: { not: '00' }, // Exclude system caretaker from lists
      },
      orderBy: {
        name: 'asc',
      },
    });

    const response: CaretakerResponse[] = caretakers.map(toCaretakerResponse);

    return NextResponse.json<ApiResponse<CaretakerResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching caretakers:', error);
    return NextResponse.json<ApiResponse<CaretakerResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch caretakers',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(postHandler as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const GET = withAuthContext(getHandler as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const PUT = withAuthContext(putHandler as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const DELETE = withAuthContext(deleteHandler as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
