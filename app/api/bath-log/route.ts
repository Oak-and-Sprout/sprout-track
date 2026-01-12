import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BathLogCreate, BathLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { notifyActivityCreated } from '@/src/lib/notifications/activityHook';

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

    const body: BathLogCreate = await req.json();

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }
    
    const timeUTC = toUTC(body.time);
    
    const bathLog = await prisma.bathLog.create({
      data: {
        ...body,
        time: timeUTC,
        caretakerId: caretakerId,
        soapUsed: body.soapUsed ?? true,
        shampooUsed: body.shampooUsed ?? true,
        familyId: userFamilyId,
      },
    });

    // Format dates as ISO strings for response
    const response: BathLogResponse = {
      ...bathLog,
      time: formatForResponse(bathLog.time) || '',
      createdAt: formatForResponse(bathLog.createdAt) || '',
      updatedAt: formatForResponse(bathLog.updatedAt) || '',
      deletedAt: formatForResponse(bathLog.deletedAt),
    };

    // Notify subscribers about activity creation (non-blocking)
    notifyActivityCreated(bathLog.babyId, 'bath').catch(console.error);

    return NextResponse.json<ApiResponse<BathLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating bath log:', error);
    return NextResponse.json<ApiResponse<BathLogResponse>>(
      {
        success: false,
        error: 'Failed to create bath log',
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
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: Partial<BathLogCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<BathLogResponse>>(
        {
          success: false,
          error: 'Bath log ID is required',
        },
        { status: 400 }
      );
    }

    const existingBathLog = await prisma.bathLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingBathLog) {
      return NextResponse.json<ApiResponse<BathLogResponse>>(
        {
          success: false,
          error: 'Bath log not found or access denied',
        },
        { status: 404 }
      );
    }

    // Process date fields - convert to UTC
    const data = {
      ...(body.time ? { time: toUTC(body.time) } : {}),
      ...Object.entries(body)
        .filter(([key]) => !['time'].includes(key))
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
    };

    const bathLog = await prisma.bathLog.update({
      where: { id },
      data,
    });

    // Format dates as ISO strings for response
    const response: BathLogResponse = {
      ...bathLog,
      time: formatForResponse(bathLog.time) || '',
      createdAt: formatForResponse(bathLog.createdAt) || '',
      updatedAt: formatForResponse(bathLog.updatedAt) || '',
      deletedAt: formatForResponse(bathLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<BathLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating bath log:', error);
    return NextResponse.json<ApiResponse<BathLogResponse>>(
      {
        success: false,
        error: 'Failed to update bath log',
      },
      { status: 500 }
    );
  }
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const babyId = searchParams.get('babyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (id) {
      const bathLog = await prisma.bathLog.findFirst({
        where: { id, familyId: userFamilyId },
      });

      if (!bathLog) {
        return NextResponse.json<ApiResponse<BathLogResponse>>(
          {
            success: false,
            error: 'Bath log not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates as ISO strings for response
      const response: BathLogResponse = {
        ...bathLog,
        time: formatForResponse(bathLog.time) || '',
        createdAt: formatForResponse(bathLog.createdAt) || '',
        updatedAt: formatForResponse(bathLog.updatedAt) || '',
        deletedAt: formatForResponse(bathLog.deletedAt),
      };

      return NextResponse.json<ApiResponse<BathLogResponse>>({
        success: true,
        data: response,
      });
    }

    const bathLogs = await prisma.bathLog.findMany({
      where: {
        familyId: userFamilyId,
        ...(babyId && { babyId }),
        ...(startDate && endDate && {
          time: {
            gte: toUTC(startDate),
            lte: toUTC(endDate),
          },
        }),
      },
      orderBy: {
        time: 'desc',
      },
    });

    // Format dates as ISO strings for response
    const response: BathLogResponse[] = bathLogs.map(bathLog => ({
      ...bathLog,
      time: formatForResponse(bathLog.time) || '',
      createdAt: formatForResponse(bathLog.createdAt) || '',
      updatedAt: formatForResponse(bathLog.updatedAt) || '',
      deletedAt: formatForResponse(bathLog.deletedAt),
    }));

    return NextResponse.json<ApiResponse<BathLogResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching bath logs:', error);
    return NextResponse.json<ApiResponse<BathLogResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch bath logs',
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
          error: 'Bath log ID is required',
        },
        { status: 400 }
      );
    }

    const existingBathLog = await prisma.bathLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingBathLog) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Bath log not found or access denied',
        },
        { status: 404 }
      );
    }

    await prisma.bathLog.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse<void>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting bath log:', error);
    return NextResponse.json<ApiResponse<void>>(
      {
        success: false,
        error: 'Failed to delete bath log',
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

// OPTIONAL: If you want to add logging, import withLogging and wrap handlers like this:
// import { withLogging } from '../utils/with-logging';
// export const GET = withAuthContext(withLogging(handleGet) as ...);
