import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, ActiveBreastFeedResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { startBreastfeedSession, updateBreastfeedSession, endBreastfeedSession, SESSION_UPDATE_ACTIONS, SessionUpdateAction } from '../utils/activeBreastFeed';

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

    const session = await startBreastfeedSession({ babyId, side, familyId: userFamilyId, caretakerId });

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
    const action = searchParams.get('action'); // switch, pause, resume, swap

    if (!id || !action) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'id and action are required' }, { status: 400 });
    }

    if (!SESSION_UPDATE_ACTIONS.includes(action as SessionUpdateAction)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action. Use switch, pause, resume, or swap.' }, { status: 400 });
    }

    const session = await prisma.activeBreastFeed.findFirst({
      where: { id, familyId: userFamilyId },
    });
    if (!session) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Active breastfeed session not found' }, { status: 404 });
    }

    // resume optionally accepts a side to resume on
    const body = action === 'resume' ? await req.json().catch(() => ({})) : {};

    const updated = await updateBreastfeedSession(session, action as SessionUpdateAction, body.side);
    if (!updated) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action. Use switch, pause, resume, or swap.' }, { status: 400 });
    }

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

    // Check if caller wants to override durations (from form adjustments)
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine
    }

    const { feedLogs } = await endBreastfeedSession(session, {
      familyId: userFamilyId,
      caretakerId,
      accountId: authContext.accountId,
      leftDuration: body.leftDuration,
      rightDuration: body.rightDuration,
    });

    return NextResponse.json<ApiResponse<{ feedLogsCreated: number; feedLogIds: string[] }>>({
      success: true,
      data: { feedLogsCreated: feedLogs.length, feedLogIds: feedLogs.map(log => log.id) },
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
