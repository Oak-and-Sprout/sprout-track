import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, CaretakerCreate, CaretakerUpdate, CaretakerResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';

async function postHandler(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId, caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    // System administrators, setup auth, and account auth need a family context for caretakers
    if (!userFamilyId && !isSysAdmin && !isSetupAuth && !isAccountAuth) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }
    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can create caretakers.' }, { status: 403 });
    }

    const requestBody = await req.json();
    const { familyId: bodyFamilyId, ...caretakerData } = requestBody;
    const body: CaretakerCreate = caretakerData;

    // For system administrators, setup auth, and account auth, require familyId to be passed as query parameter or in body
    let targetFamilyId = userFamilyId;
    if (isSysAdmin || isSetupAuth || isAccountAuth) {
      const { searchParams } = new URL(req.url);
      const queryFamilyId = searchParams.get('familyId');
      
      if (bodyFamilyId) {
        targetFamilyId = bodyFamilyId;
      } else if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      } else if (!userFamilyId) {
        const userType = isSysAdmin ? 'System administrators' : isSetupAuth ? 'Setup authentication' : 'Account authentication';
        return NextResponse.json<ApiResponse<null>>({ 
          success: false, 
          error: `${userType} must specify familyId parameter or in request body.` 
        }, { status: 400 });
      }
    }

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

    const response: CaretakerResponse = {
      ...caretaker,
      createdAt: formatForResponse(caretaker.createdAt) || '',
      updatedAt: formatForResponse(caretaker.updatedAt) || '',
      deletedAt: formatForResponse(caretaker.deletedAt),
    };

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
  try {
    const { familyId: userFamilyId, caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    // System administrators, setup auth, and account auth need a family context for caretakers
    if (!userFamilyId && !isSysAdmin && !isSetupAuth && !isAccountAuth) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }
    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can update caretakers.' }, { status: 403 });
    }

    const requestBody = await req.json();
    const { familyId: bodyFamilyId, id, ...updateData } = requestBody;
    const body: CaretakerUpdate = { id, ...updateData };

    // For system administrators, setup auth, and account auth, require familyId to be passed as query parameter or in body
    let targetFamilyId = userFamilyId;
    if (isSysAdmin || isSetupAuth || isAccountAuth) {
      const { searchParams } = new URL(req.url);
      const queryFamilyId = searchParams.get('familyId');

      if (bodyFamilyId) {
        targetFamilyId = bodyFamilyId;
      } else if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      } else if (!userFamilyId) {
        const userType = isSysAdmin ? 'System administrators' : isSetupAuth ? 'Setup authentication' : 'Account authentication';
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `${userType} must specify familyId parameter or in request body.`
        }, { status: 400 });
      }
    }

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

    const response: CaretakerResponse = {
      ...caretaker,
      createdAt: formatForResponse(caretaker.createdAt) || '',
      updatedAt: formatForResponse(caretaker.updatedAt) || '',
      deletedAt: formatForResponse(caretaker.deletedAt),
    };

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
  try {
    const { familyId: userFamilyId, caretakerRole, isSysAdmin, isSetupAuth, isAccountAuth } = authContext;

    // System administrators, setup auth, and account auth need a family context for caretakers
    if (!userFamilyId && !isSysAdmin && !isSetupAuth && !isAccountAuth) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }
    if (!isSysAdmin && !isSetupAuth && !isAccountAuth && caretakerRole !== 'ADMIN') {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Only admins can delete caretakers.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // For system administrators, setup auth, and account auth, require familyId to be passed as query parameter
    let targetFamilyId = userFamilyId;
    if (isSysAdmin || isSetupAuth || isAccountAuth) {
      const queryFamilyId = searchParams.get('familyId');

      if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      } else if (!userFamilyId) {
        const userType = isSysAdmin ? 'System administrators' : isSetupAuth ? 'Setup authentication' : 'Account authentication';
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `${userType} must specify familyId parameter.`
        }, { status: 400 });
      }
    }

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
    const { familyId: userFamilyId, isAccountAuth, caretakerId, accountId, isSysAdmin, isSetupAuth } = authContext;

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

    // System administrators, setup auth, and account auth need a family context for caretakers
    if (!userFamilyId && !isSysAdmin && !isSetupAuth && !isAccountAuth) {
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'User is not associated with a family.'
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // For system administrators, setup auth, and account auth, require familyId to be passed as query parameter
    let targetFamilyId = userFamilyId;
    if (isSysAdmin || isSetupAuth || isAccountAuth) {
      const queryFamilyId = searchParams.get('familyId');

      if (queryFamilyId) {
        targetFamilyId = queryFamilyId;
      } else if (!userFamilyId) {
        const userType = isSysAdmin ? 'System administrators' : isSetupAuth ? 'Setup authentication' : 'Account authentication';
        return NextResponse.json<ApiResponse<null>>({
          success: false,
          error: `${userType} must specify familyId parameter.`
        }, { status: 400 });
      }
    }

    // Handle incomplete account setup
    if (!targetFamilyId && isAccountAuth) {
      console.log('Caretaker API: Account user missing familyId - possible setup incomplete');
      return NextResponse.json<ApiResponse<null>>({
        success: false,
        error: 'Account setup incomplete. Please complete family setup.'
      }, { status: 403 });
    }

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

      const response: CaretakerResponse = {
        ...caretaker,
        createdAt: formatForResponse(caretaker.createdAt) || '',
        updatedAt: formatForResponse(caretaker.updatedAt) || '',
        deletedAt: formatForResponse(caretaker.deletedAt),
      };

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

    const response: CaretakerResponse[] = caretakers.map(caretaker => ({
      ...caretaker,
      createdAt: formatForResponse(caretaker.createdAt) || '',
      updatedAt: formatForResponse(caretaker.updatedAt) || '',
      deletedAt: formatForResponse(caretaker.deletedAt),
    }));

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
