import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, ActiveBreastFeedResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';

function formatActiveBreastFeed(record: any): ActiveBreastFeedResponse {
  return {
    ...record,
    currentSideStartTime: formatForResponse(record.currentSideStartTime) || null,
    sessionStartTime: formatForResponse(record.sessionStartTime) || '',
    createdAt: formatForResponse(record.createdAt) || '',
    updatedAt: formatForResponse(record.updatedAt) || '',
  };
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'babyId is required' }, { status: 400 });
    }

    const activeSession = await prisma.activeBreastFeed.findUnique({
      where: { babyId },
    });

    if (!activeSession || activeSession.familyId !== userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({
        success: true,
        data: null,
      });
    }

    return NextResponse.json<ApiResponse<ActiveBreastFeedResponse>>({
      success: true,
      data: formatActiveBreastFeed(activeSession),
    });
  } catch (error) {
    console.error('Error fetching active breastfeed:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch active breastfeed' }, { status: 500 });
  }
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId: userFamilyId, caretakerId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body = await req.json();
    const { babyId, side } = body;

    if (!babyId || !side) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'babyId and side are required' }, { status: 400 });
    }

    // Verify baby belongs to family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });
    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    // Check if there's already an active session
    const existing = await prisma.activeBreastFeed.findUnique({ where: { babyId } });
    if (existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'An active breastfeed session already exists for this baby.' }, { status: 409 });
    }

    const now = new Date();
    const session = await prisma.activeBreastFeed.create({
      data: {
        babyId,
        activeSide: side,
        isPaused: false,
        leftDuration: 0,
        rightDuration: 0,
        currentSideStartTime: now,
        sessionStartTime: now,
        familyId: userFamilyId,
        caretakerId: caretakerId,
      },
    });

    return NextResponse.json<ApiResponse<ActiveBreastFeedResponse>>({
      success: true,
      data: formatActiveBreastFeed(session),
    });
  } catch (error) {
    console.error('Error creating active breastfeed:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create active breastfeed session' }, { status: 500 });
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action'); // switch, pause, resume

    if (!id || !action) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'id and action are required' }, { status: 400 });
    }

    const session = await prisma.activeBreastFeed.findFirst({
      where: { id, familyId: userFamilyId },
    });
    if (!session) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Active breastfeed session not found' }, { status: 404 });
    }

    const now = new Date();

    // Calculate elapsed time on current side (if not paused)
    let elapsedSeconds = 0;
    if (session.currentSideStartTime && !session.isPaused) {
      elapsedSeconds = Math.floor((now.getTime() - session.currentSideStartTime.getTime()) / 1000);
    }

    let updateData: any = {};

    switch (action) {
      case 'switch': {
        // Accumulate time on current side, switch to other side
        const newLeftDuration = session.activeSide === 'LEFT'
          ? session.leftDuration + elapsedSeconds
          : session.leftDuration;
        const newRightDuration = session.activeSide === 'RIGHT'
          ? session.rightDuration + elapsedSeconds
          : session.rightDuration;
        const newSide = session.activeSide === 'LEFT' ? 'RIGHT' : 'LEFT';

        updateData = {
          activeSide: newSide,
          leftDuration: newLeftDuration,
          rightDuration: newRightDuration,
          currentSideStartTime: now,
          isPaused: false,
        };
        break;
      }
      case 'pause': {
        // Accumulate time on current side, pause
        const newLeftDuration = session.activeSide === 'LEFT'
          ? session.leftDuration + elapsedSeconds
          : session.leftDuration;
        const newRightDuration = session.activeSide === 'RIGHT'
          ? session.rightDuration + elapsedSeconds
          : session.rightDuration;

        updateData = {
          leftDuration: newLeftDuration,
          rightDuration: newRightDuration,
          currentSideStartTime: null,
          isPaused: true,
        };
        break;
      }
      case 'resume': {
        // Optionally accept a side to resume on
        const body = await req.json().catch(() => ({}));
        const resumeSide = body.side || session.activeSide;

        updateData = {
          activeSide: resumeSide,
          currentSideStartTime: now,
          isPaused: false,
        };
        break;
      }
      default:
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action. Use switch, pause, or resume.' }, { status: 400 });
    }

    const updated = await prisma.activeBreastFeed.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json<ApiResponse<ActiveBreastFeedResponse>>({
      success: true,
      data: formatActiveBreastFeed(updated),
    });
  } catch (error) {
    console.error('Error updating active breastfeed:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update active breastfeed session' }, { status: 500 });
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId: userFamilyId, caretakerId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'id is required' }, { status: 400 });
    }

    const session = await prisma.activeBreastFeed.findFirst({
      where: { id, familyId: userFamilyId },
    });
    if (!session) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Active breastfeed session not found' }, { status: 404 });
    }

    const now = new Date();

    // Calculate final elapsed time on current side (if not paused)
    let elapsedSeconds = 0;
    if (session.currentSideStartTime && !session.isPaused) {
      elapsedSeconds = Math.floor((now.getTime() - session.currentSideStartTime.getTime()) / 1000);
    }

    const finalLeftDuration = session.activeSide === 'LEFT'
      ? session.leftDuration + elapsedSeconds
      : session.leftDuration;
    const finalRightDuration = session.activeSide === 'RIGHT'
      ? session.rightDuration + elapsedSeconds
      : session.rightDuration;

    // Check if caller wants to override durations (from form adjustments)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }

    const leftDur = body.leftDuration !== undefined ? body.leftDuration : finalLeftDuration;
    const rightDur = body.rightDuration !== undefined ? body.rightDuration : finalRightDuration;

    // Create FeedLog records for each side that has duration
    const feedLogs = [];

    if (leftDur > 0) {
      const leftEndTime = now;
      const leftStartTime = session.sessionStartTime;

      const leftLog = await prisma.feedLog.create({
        data: {
          babyId: session.babyId,
          time: leftEndTime,
          type: 'BREAST',
          side: 'LEFT',
          startTime: leftStartTime,
          endTime: leftEndTime,
          feedDuration: leftDur,
          caretakerId: caretakerId,
          familyId: userFamilyId,
        },
      });
      feedLogs.push(leftLog);
    }

    if (rightDur > 0) {
      const rightEndTime = now;
      const rightStartTime = session.sessionStartTime;

      const rightLog = await prisma.feedLog.create({
        data: {
          babyId: session.babyId,
          time: rightEndTime,
          type: 'BREAST',
          side: 'RIGHT',
          startTime: rightStartTime,
          endTime: rightEndTime,
          feedDuration: rightDur,
          caretakerId: caretakerId,
          familyId: userFamilyId,
        },
      });
      feedLogs.push(rightLog);
    }

    // Delete the active session
    await prisma.activeBreastFeed.delete({ where: { id } });

    // Notify subscribers about completed breastfeed and reset feed timer (non-blocking)
    notifyActivityCreated(session.babyId, 'feed', { accountId: authContext.accountId, caretakerId: authContext.caretakerId }, { type: 'BREAST' }).catch(console.error);
    resetTimerNotificationState(session.babyId, 'feed').catch(console.error);

    return NextResponse.json<ApiResponse<{ feedLogsCreated: number }>>({
      success: true,
      data: { feedLogsCreated: feedLogs.length },
    });
  } catch (error) {
    console.error('Error ending active breastfeed:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to end active breastfeed session' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
