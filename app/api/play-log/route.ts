import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, PlayLogCreate, PlayLogResponse } from '../types';
import { PlayType } from '@prisma/client';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { notifyActivityCreated } from '@/src/lib/notifications/activityHook';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const body: PlayLogCreate = await req.json();
    const { familyId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Baby not found in this family.' },
        { status: 404 }
      );
    }

    const startTimeUTC = toUTC(body.startTime);

    // Calculate endTime from startTime + duration (duration is in minutes)
    let endTimeUTC = null;
    if (body.duration && body.duration > 0) {
      endTimeUTC = new Date(startTimeUTC.getTime() + body.duration * 60 * 1000);
    }

    const playLog = await prisma.playLog.create({
      data: {
        startTime: startTimeUTC,
        endTime: endTimeUTC,
        duration: body.duration || null,
        type: body.type as PlayType,
        location: body.location || null,
        activities: body.activities || null,
        caretakerId: caretakerId,
        familyId,
        babyId: body.babyId,
      },
    });

    // Notify subscribers about activity creation (non-blocking)
    notifyActivityCreated(playLog.babyId, 'play', { accountId: authContext.accountId, caretakerId: authContext.caretakerId }, { type: body.type, activities: body.activities }).catch(console.error);

    const response: PlayLogResponse = {
      ...playLog,
      startTime: formatForResponse(playLog.startTime) || '',
      endTime: formatForResponse(playLog.endTime),
      createdAt: formatForResponse(playLog.createdAt) || '',
      updatedAt: formatForResponse(playLog.updatedAt) || '',
      deletedAt: formatForResponse(playLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<PlayLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating play log:', error);
    return NextResponse.json<ApiResponse<PlayLogResponse>>(
      { success: false, error: 'Failed to create play log' },
      { status: 500 }
    );
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: Partial<PlayLogCreate> = await req.json();
    const { familyId } = authContext;

    if (!id) {
      return NextResponse.json<ApiResponse<PlayLogResponse>>(
        { success: false, error: 'Play log ID is required' },
        { status: 400 }
      );
    }

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const existingPlayLog = await prisma.playLog.findFirst({
      where: { id, familyId },
    });

    if (!existingPlayLog) {
      return NextResponse.json<ApiResponse<PlayLogResponse>>(
        { success: false, error: 'Play log not found or access denied' },
        { status: 404 }
      );
    }

    const data: any = {};
    if (body.startTime) {
      data.startTime = toUTC(body.startTime);
    }
    if (body.duration !== undefined) {
      data.duration = body.duration;
      // Recalculate endTime
      const startTime = data.startTime || existingPlayLog.startTime;
      if (body.duration && body.duration > 0) {
        data.endTime = new Date(new Date(startTime).getTime() + body.duration * 60 * 1000);
      }
    }
    if (body.type !== undefined) data.type = body.type as PlayType;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.activities !== undefined) data.activities = body.activities || null;

    const playLog = await prisma.playLog.update({
      where: { id },
      data,
    });

    const response: PlayLogResponse = {
      ...playLog,
      startTime: formatForResponse(playLog.startTime) || '',
      endTime: formatForResponse(playLog.endTime),
      createdAt: formatForResponse(playLog.createdAt) || '',
      updatedAt: formatForResponse(playLog.updatedAt) || '',
      deletedAt: formatForResponse(playLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<PlayLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating play log:', error);
    return NextResponse.json<ApiResponse<PlayLogResponse>>(
      { success: false, error: 'Failed to update play log' },
      { status: 500 }
    );
  }
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const babyId = searchParams.get('babyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const categories = searchParams.get('categories');
    const typeFilter = searchParams.get('type');

    // Return distinct sub-categories for a given play type
    if (categories === 'true') {
      const whereClause: any = {
        familyId,
        activities: { not: null },
      };
      if (typeFilter) {
        whereClause.type = typeFilter as PlayType;
      }

      const playLogs = await prisma.playLog.findMany({
        where: whereClause,
        distinct: ['activities'],
        select: { activities: true },
      });

      const uniqueCategories = playLogs
        .map(log => log.activities)
        .filter((activities): activities is string => activities !== null);

      return NextResponse.json<ApiResponse<string[]>>({
        success: true,
        data: uniqueCategories,
      });
    }

    const queryParams: any = {
      familyId,
      ...(babyId && { babyId }),
      ...(startDate && endDate && {
        startTime: {
          gte: toUTC(startDate),
          lte: toUTC(endDate),
        },
      }),
    };

    if (id) {
      const playLog = await prisma.playLog.findFirst({
        where: { id, familyId },
      });

      if (!playLog) {
        return NextResponse.json<ApiResponse<PlayLogResponse>>(
          { success: false, error: 'Play log not found or access denied' },
          { status: 404 }
        );
      }

      const response: PlayLogResponse = {
        ...playLog,
        startTime: formatForResponse(playLog.startTime) || '',
        endTime: formatForResponse(playLog.endTime),
        createdAt: formatForResponse(playLog.createdAt) || '',
        updatedAt: formatForResponse(playLog.updatedAt) || '',
        deletedAt: formatForResponse(playLog.deletedAt),
      };

      return NextResponse.json<ApiResponse<PlayLogResponse>>({
        success: true,
        data: response,
      });
    }

    const playLogs = await prisma.playLog.findMany({
      where: queryParams,
      orderBy: { startTime: 'desc' },
    });

    const response: PlayLogResponse[] = playLogs.map(playLog => ({
      ...playLog,
      startTime: formatForResponse(playLog.startTime) || '',
      endTime: formatForResponse(playLog.endTime),
      createdAt: formatForResponse(playLog.createdAt) || '',
      updatedAt: formatForResponse(playLog.updatedAt) || '',
      deletedAt: formatForResponse(playLog.deletedAt),
    }));

    return NextResponse.json<ApiResponse<PlayLogResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching play logs:', error);
    return NextResponse.json<ApiResponse<PlayLogResponse[]>>(
      { success: false, error: 'Failed to fetch play logs' },
      { status: 500 }
    );
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) {
    return writeCheck.response!;
  }

  try {
    const { familyId } = authContext;
    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<void>>(
        { success: false, error: 'Play log ID is required' },
        { status: 400 }
      );
    }

    const existingPlayLog = await prisma.playLog.findFirst({
      where: { id, familyId },
    });

    if (!existingPlayLog) {
      return NextResponse.json<ApiResponse<void>>(
        { success: false, error: 'Play log not found or access denied' },
        { status: 404 }
      );
    }

    await prisma.playLog.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse<void>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting play log:', error);
    return NextResponse.json<ApiResponse<void>>(
      { success: false, error: 'Failed to delete play log' },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const POST = withAuthContext(handlePost as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const PUT = withAuthContext(handlePut as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
export const DELETE = withAuthContext(handleDelete as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>);
