import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, SleepLogCreate, SleepLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse, calculateDurationMinutes } from '../utils/timezone';
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

    const body: SleepLogCreate = await req.json();

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }
    
    // Convert times to UTC for storage
    const startTimeUTC = toUTC(body.startTime);
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : null;
    
    // Calculate duration if both start and end times are present
    const duration = endTimeUTC ? calculateDurationMinutes(startTimeUTC, endTimeUTC) : undefined;

    const sleepLog = await prisma.sleepLog.create({
      data: {
        ...body,
        startTime: startTimeUTC,
        ...(endTimeUTC && { endTime: endTimeUTC }),
        duration,
        caretakerId: caretakerId,
        familyId: userFamilyId,
      },
    });

    // Format dates as ISO strings for response
    const response: SleepLogResponse = {
      ...sleepLog,
      startTime: formatForResponse(sleepLog.startTime) || '',
      endTime: formatForResponse(sleepLog.endTime) || null,
      createdAt: formatForResponse(sleepLog.createdAt) || '',
      updatedAt: formatForResponse(sleepLog.updatedAt) || '',
      deletedAt: formatForResponse(sleepLog.deletedAt),
    };

    // Notify subscribers about activity creation (non-blocking)
    notifyActivityCreated(sleepLog.babyId, 'sleep', { type: body.type }).catch(console.error);

    return NextResponse.json<ApiResponse<SleepLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating sleep log:', error);
    return NextResponse.json<ApiResponse<SleepLogResponse>>(
      {
        success: false,
        error: 'Failed to create sleep log',
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
    const body: Partial<SleepLogCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<SleepLogResponse>>(
        {
          success: false,
          error: 'Sleep log ID is required',
        },
        { status: 400 }
      );
    }

    const existingSleepLog = await prisma.sleepLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingSleepLog) {
      return NextResponse.json<ApiResponse<SleepLogResponse>>(
        {
          success: false,
          error: 'Sleep log not found or access denied',
        },
        { status: 404 }
      );
    }

    // Convert times to UTC for storage
    const startTimeUTC = body.startTime ? toUTC(body.startTime) : undefined;
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : undefined;
    
    // Calculate duration if end time is provided
    const duration = endTimeUTC 
      ? calculateDurationMinutes(startTimeUTC || existingSleepLog.startTime, endTimeUTC) 
      : undefined;

    const sleepLog = await prisma.sleepLog.update({
      where: { id },
      data: {
        ...body,
        ...(startTimeUTC && { startTime: startTimeUTC }),
        ...(endTimeUTC && { endTime: endTimeUTC }),
        ...(duration !== undefined && { duration }),
      },
    });

    // Format dates as ISO strings for response
    const response: SleepLogResponse = {
      ...sleepLog,
      startTime: formatForResponse(sleepLog.startTime) || '',
      endTime: formatForResponse(sleepLog.endTime) || null,
      createdAt: formatForResponse(sleepLog.createdAt) || '',
      updatedAt: formatForResponse(sleepLog.updatedAt) || '',
      deletedAt: formatForResponse(sleepLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<SleepLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating sleep log:', error);
    return NextResponse.json<ApiResponse<SleepLogResponse>>(
      {
        success: false,
        error: 'Failed to update sleep log',
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
    const locations = searchParams.get('locations');
    
    // If locations flag is present, return unique custom locations
    if (locations === 'true') {
      const defaultLocations = ['Bassinet', 'Stroller', 'Crib', 'Car Seat', 'Parents Room', 'Contact', 'Other'];
      
      const sleepLogs = await prisma.sleepLog.findMany({
        where: {
          familyId: userFamilyId,
          location: {
            not: null
          },
        },
        distinct: ['location'],
        select: {
          location: true
        }
      });
      
      const uniqueLocations = sleepLogs
        .map(log => log.location)
        .filter((location): location is string => location !== null && location.trim() !== '')
        .filter(location => !defaultLocations.includes(location));

      return NextResponse.json<ApiResponse<string[]>>({
        success: true,
        data: uniqueLocations
      });
    }
    
    const queryParams: any = {
      familyId: userFamilyId,
      ...(babyId && { babyId }),
      ...(startDate && endDate && {
        startTime: {
          gte: toUTC(startDate),
          lte: toUTC(endDate),
        },
      }),
    };

    if (id) {
      const sleepLog = await prisma.sleepLog.findFirst({
        where: { 
          id,
          familyId: userFamilyId,
        },
      });

      if (!sleepLog) {
        return NextResponse.json<ApiResponse<SleepLogResponse>>(
          {
            success: false,
            error: 'Sleep log not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates as ISO strings for response
      const response: SleepLogResponse = {
        ...sleepLog,
        startTime: formatForResponse(sleepLog.startTime) || '',
        endTime: formatForResponse(sleepLog.endTime) || null,
        createdAt: formatForResponse(sleepLog.createdAt) || '',
        updatedAt: formatForResponse(sleepLog.updatedAt) || '',
        deletedAt: formatForResponse(sleepLog.deletedAt),
      };

      return NextResponse.json<ApiResponse<SleepLogResponse>>({
        success: true,
        data: response,
      });
    }

    const sleepLogs = await prisma.sleepLog.findMany({
      where: queryParams,
      orderBy: {
        startTime: 'desc',
      },
    });

    // Format dates as ISO strings for response
    const response: SleepLogResponse[] = sleepLogs.map(sleepLog => ({
      ...sleepLog,
      startTime: formatForResponse(sleepLog.startTime) || '',
      endTime: formatForResponse(sleepLog.endTime) || null,
      createdAt: formatForResponse(sleepLog.createdAt) || '',
      updatedAt: formatForResponse(sleepLog.updatedAt) || '',
      deletedAt: formatForResponse(sleepLog.deletedAt),
    }));

    return NextResponse.json<ApiResponse<SleepLogResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching sleep logs:', error);
    return NextResponse.json<ApiResponse<SleepLogResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch sleep logs',
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
          error: 'Sleep log ID is required',
        },
        { status: 400 }
      );
    }

    const existingSleepLog = await prisma.sleepLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingSleepLog) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Sleep log not found or access denied',
        },
        { status: 404 }
      );
    }

    await prisma.sleepLog.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse<void>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting sleep log:', error);
    return NextResponse.json<ApiResponse<void>>(
      {
        success: false,
        error: 'Failed to delete sleep log',
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
