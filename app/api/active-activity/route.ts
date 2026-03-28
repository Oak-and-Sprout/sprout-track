import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, ActiveActivityResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

function formatActiveActivity(record: any): ActiveActivityResponse {
  return {
    ...record,
    currentStartTime: formatForResponse(record.currentStartTime) || null,
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

    const activeSession = await prisma.activeActivity.findUnique({
      where: { babyId },
    });

    if (!activeSession || activeSession.familyId !== userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({
        success: true,
        data: null,
      });
    }

    return NextResponse.json<ApiResponse<ActiveActivityResponse>>({
      success: true,
      data: formatActiveActivity(activeSession),
    });
  } catch (error) {
    console.error('Error fetching active activity:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch active activity' }, { status: 500 });
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
    const { babyId, playType, subCategory, notes, existingDuration } = body;

    if (!babyId || !playType) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'babyId and playType are required' }, { status: 400 });
    }

    // Verify baby belongs to family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });
    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    // Check if there's already an active session
    const existing = await prisma.activeActivity.findUnique({ where: { babyId } });
    if (existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'An active activity session already exists for this baby.' }, { status: 409 });
    }

    const now = new Date();
    const session = await prisma.activeActivity.create({
      data: {
        babyId,
        playType,
        isPaused: false,
        duration: existingDuration || 0,
        currentStartTime: now,
        sessionStartTime: now,
        subCategory: subCategory || null,
        notes: notes || null,
        familyId: userFamilyId,
        caretakerId: caretakerId,
      },
    });

    return NextResponse.json<ApiResponse<ActiveActivityResponse>>({
      success: true,
      data: formatActiveActivity(session),
    });
  } catch (error) {
    console.error('Error creating active activity:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create active activity session' }, { status: 500 });
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
    const action = searchParams.get('action'); // pause, resume

    if (!id || !action) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'id and action are required' }, { status: 400 });
    }

    const session = await prisma.activeActivity.findFirst({
      where: { id, familyId: userFamilyId },
    });
    if (!session) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Active activity session not found' }, { status: 404 });
    }

    const now = new Date();

    // Calculate elapsed time (if not paused)
    let elapsedSeconds = 0;
    if (session.currentStartTime && !session.isPaused) {
      elapsedSeconds = Math.floor((now.getTime() - session.currentStartTime.getTime()) / 1000);
    }

    let updateData: any = {};

    switch (action) {
      case 'pause': {
        updateData = {
          duration: session.duration + elapsedSeconds,
          currentStartTime: null,
          isPaused: true,
        };
        break;
      }
      case 'resume': {
        // Optionally accept updated metadata
        const body = await req.json().catch(() => ({}));

        updateData = {
          currentStartTime: now,
          isPaused: false,
          ...(body.subCategory !== undefined && { subCategory: body.subCategory }),
          ...(body.notes !== undefined && { notes: body.notes }),
          ...(body.playType !== undefined && { playType: body.playType }),
        };
        break;
      }
      default:
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid action. Use pause or resume.' }, { status: 400 });
    }

    const updated = await prisma.activeActivity.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json<ApiResponse<ActiveActivityResponse>>({
      success: true,
      data: formatActiveActivity(updated),
    });
  } catch (error) {
    console.error('Error updating active activity:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update active activity session' }, { status: 500 });
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'id is required' }, { status: 400 });
    }

    const session = await prisma.activeActivity.findFirst({
      where: { id, familyId: userFamilyId },
    });
    if (!session) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Active activity session not found' }, { status: 404 });
    }

    const now = new Date();

    // Calculate final elapsed time (if not paused)
    let elapsedSeconds = 0;
    if (session.currentStartTime && !session.isPaused) {
      elapsedSeconds = Math.floor((now.getTime() - session.currentStartTime.getTime()) / 1000);
    }

    const finalDuration = session.duration + elapsedSeconds;

    // Delete the active session
    await prisma.activeActivity.delete({ where: { id } });

    // Return session data for form pre-fill (do NOT create PlayLog - user will save from form)
    return NextResponse.json<ApiResponse<{
      sessionStartTime: string;
      duration: number;
      playType: string;
      subCategory: string | null;
      notes: string | null;
    }>>({
      success: true,
      data: {
        sessionStartTime: formatForResponse(session.sessionStartTime) || '',
        duration: finalDuration,
        playType: session.playType,
        subCategory: session.subCategory,
        notes: session.notes,
      },
    });
  } catch (error) {
    console.error('Error ending active activity:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to end active activity session' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
