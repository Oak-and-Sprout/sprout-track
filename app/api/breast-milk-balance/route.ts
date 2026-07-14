import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BreastMilkBalanceResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { calculateBreastMilkBalance } from '@/src/utils/breastMilkInventory';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');
    const targetUnit = (searchParams.get('unit') || 'OZ').toUpperCase();

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby ID is required' }, { status: 400 });
    }

    // Verify baby belongs to family
    const baby = await prisma.baby.findFirst({
      where: { id: babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    // 1. Sum of pump logs where pumpAction is "STORED"
    const pumpLogs = await prisma.pumpLog.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        pumpAction: 'STORED',
        deletedAt: null,
      },
      select: { totalAmount: true, unitAbbr: true, pumpAction: true },
    });

    // 2. Sum of breast milk adjustments
    const adjustments = await prisma.breastMilkAdjustment.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        deletedAt: null,
      },
      select: { amount: true, unitAbbr: true },
    });

    // 3. Sum of bottle feeds with bottleType "Breast Milk" or "Formula\Breast"
    const feedLogs = await prisma.feedLog.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        type: 'BOTTLE',
        bottleType: { in: ['Breast Milk', 'Formula\\Breast'] },
        deletedAt: null,
      },
      select: { amount: true, unitAbbr: true, bottleType: true, breastMilkAmount: true, sourcePumpId: true, notes: true },
    });

    const balance = calculateBreastMilkBalance({
      pumpLogs,
      adjustments,
      feedLogs,
      targetUnit,
    });

    return NextResponse.json<ApiResponse<BreastMilkBalanceResponse>>({
      success: true,
      data: { balance, unit: targetUnit },
    });
  } catch (error) {
    console.error('Error calculating breast milk balance:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to calculate balance' }, { status: 500 });
  }
}

export const GET = withAuthContext(handleGet as any);
