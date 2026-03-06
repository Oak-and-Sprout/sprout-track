import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BreastMilkAdjustmentCreate, BreastMilkAdjustmentResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

function formatAdjustmentResponse(adj: any): BreastMilkAdjustmentResponse {
  return {
    ...adj,
    time: formatForResponse(adj.time) || '',
    createdAt: formatForResponse(adj.createdAt) || '',
    updatedAt: formatForResponse(adj.updatedAt) || '',
    deletedAt: formatForResponse(adj.deletedAt),
  };
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId: userFamilyId, caretakerId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const body: BreastMilkAdjustmentCreate = await req.json();

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    const timeUTC = toUTC(body.time);

    const adjustment = await prisma.breastMilkAdjustment.create({
      data: {
        time: timeUTC,
        amount: body.amount,
        unitAbbr: body.unitAbbr,
        reason: body.reason,
        notes: body.notes,
        babyId: body.babyId,
        caretakerId: caretakerId,
        familyId: userFamilyId,
      },
    });

    return NextResponse.json<ApiResponse<BreastMilkAdjustmentResponse>>({
      success: true,
      data: formatAdjustmentResponse(adjustment),
    });
  } catch (error) {
    console.error('Error creating breast milk adjustment:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create breast milk adjustment' }, { status: 500 });
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

    if (id) {
      const adjustment = await prisma.breastMilkAdjustment.findFirst({
        where: { id, familyId: userFamilyId },
      });

      if (!adjustment) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Adjustment not found or access denied' }, { status: 404 });
      }

      return NextResponse.json<ApiResponse<BreastMilkAdjustmentResponse>>({
        success: true,
        data: formatAdjustmentResponse(adjustment),
      });
    }

    const adjustments = await prisma.breastMilkAdjustment.findMany({
      where: {
        familyId: userFamilyId,
        ...(babyId && { babyId }),
        deletedAt: null,
      },
      orderBy: { time: 'desc' },
    });

    return NextResponse.json<ApiResponse<BreastMilkAdjustmentResponse[]>>({
      success: true,
      data: adjustments.map(formatAdjustmentResponse),
    });
  } catch (error) {
    console.error('Error fetching breast milk adjustments:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch adjustments' }, { status: 500 });
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
    const body: Partial<BreastMilkAdjustmentCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Adjustment ID is required' }, { status: 400 });
    }

    const existing = await prisma.breastMilkAdjustment.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Adjustment not found or access denied' }, { status: 404 });
    }

    const data: any = {};
    if (body.time) data.time = toUTC(body.time);
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.unitAbbr !== undefined) data.unitAbbr = body.unitAbbr;
    if (body.reason !== undefined) data.reason = body.reason;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.babyId !== undefined) data.babyId = body.babyId;

    const adjustment = await prisma.breastMilkAdjustment.update({
      where: { id },
      data,
    });

    return NextResponse.json<ApiResponse<BreastMilkAdjustmentResponse>>({
      success: true,
      data: formatAdjustmentResponse(adjustment),
    });
  } catch (error) {
    console.error('Error updating breast milk adjustment:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update adjustment' }, { status: 500 });
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
      return NextResponse.json<ApiResponse<void>>({ success: false, error: 'Adjustment ID is required' }, { status: 400 });
    }

    const existing = await prisma.breastMilkAdjustment.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existing) {
      return NextResponse.json<ApiResponse<void>>({ success: false, error: 'Adjustment not found or access denied' }, { status: 404 });
    }

    await prisma.breastMilkAdjustment.delete({ where: { id } });

    return NextResponse.json<ApiResponse<void>>({ success: true });
  } catch (error) {
    console.error('Error deleting breast milk adjustment:', error);
    return NextResponse.json<ApiResponse<void>>({ success: false, error: 'Failed to delete adjustment' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
