import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, BreastMilkBalanceResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { convertVolume } from '@/src/utils/unit-conversion';

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
      select: { totalAmount: true, unitAbbr: true },
    });

    let storedTotal = 0;
    for (const log of pumpLogs) {
      if (log.totalAmount) {
        storedTotal += convertVolume(log.totalAmount, log.unitAbbr || 'OZ', targetUnit);
      }
    }

    // 2. Sum of breast milk adjustments
    const adjustments = await prisma.breastMilkAdjustment.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        deletedAt: null,
      },
      select: { amount: true, unitAbbr: true },
    });

    let adjustmentTotal = 0;
    for (const adj of adjustments) {
      adjustmentTotal += convertVolume(adj.amount, adj.unitAbbr || 'OZ', targetUnit);
    }

    // 3. Sum of bottle feeds with bottleType "Breast Milk" or "Formula\Breast"
    const feedLogs = await prisma.feedLog.findMany({
      where: {
        babyId,
        familyId: userFamilyId,
        type: 'BOTTLE',
        bottleType: { in: ['Breast Milk', 'Formula\\Breast'] },
        deletedAt: null,
      },
      select: { amount: true, unitAbbr: true, bottleType: true, breastMilkAmount: true },
    });

    let consumedTotal = 0;
    for (const log of feedLogs) {
      if (log.bottleType === 'Breast Milk' && log.amount) {
        consumedTotal += convertVolume(log.amount, log.unitAbbr || 'OZ', targetUnit);
      } else if (log.bottleType === 'Formula\\Breast' && log.breastMilkAmount) {
        consumedTotal += convertVolume(log.breastMilkAmount, log.unitAbbr || 'OZ', targetUnit);
      }
    }

    // Calculate balance: stored + adjustments - consumed
    const balance = Math.round((storedTotal + adjustmentTotal - consumedTotal) * 100) / 100;

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
