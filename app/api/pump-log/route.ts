import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, PumpLogCreate, PumpLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse, calculateDurationMinutes } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { notifyActivityCreated } from '@/src/lib/notifications/activityHook';
import {
  autoPumpFeedNotes,
  AUTO_PUMP_FEED_PREFIX,
  planAutoFeedSync,
  shouldHaveAutoPumpFeed,
} from '@/src/utils/breastMilkInventory';
import { normalizeVolumeUnit } from '@/src/utils/unit-conversion';

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

    const body: PumpLogCreate = await req.json();

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }
    
    // Convert times to UTC for storage
    const startTimeUTC = toUTC(body.startTime);
    const endTimeUTC = body.endTime ? toUTC(body.endTime) : undefined;
    
    // Calculate duration if not provided but start and end times are available
    let duration = body.duration;
    if (!duration && startTimeUTC && endTimeUTC) {
      duration = calculateDurationMinutes(startTimeUTC, endTimeUTC);
    }
    
    // Calculate total amount if not provided but left and right amounts are
    let totalAmount = body.totalAmount;
    if (totalAmount === undefined && (body.leftAmount !== undefined || body.rightAmount !== undefined)) {
      totalAmount = (body.leftAmount || 0) + (body.rightAmount || 0);
    }
    
    // Validate pumpAction
    const pumpAction = body.pumpAction || 'STORED';
    if (!['STORED', 'FED', 'DISCARDED'].includes(pumpAction)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid pump action. Must be STORED, FED, or DISCARDED.' }, { status: 400 });
    }

    // Validate/normalize the volume unit — an unknown unit silently corrupts
    // breast-milk balances (convertVolume no-ops on units it can't convert).
    let unitAbbr = body.unitAbbr;
    if (unitAbbr !== undefined) {
      const normalizedUnit = normalizeVolumeUnit(unitAbbr);
      if (!normalizedUnit) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid unit. Supported units are OZ and ML.' }, { status: 400 });
      }
      unitAbbr = normalizedUnit;
    }

    const familySettings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      select: { enableBreastMilkTracking: true },
    });
    const trackingEnabled = familySettings?.enableBreastMilkTracking !== false;

    const pumpLog = await prisma.$transaction(async (tx) => {
      const createdPumpLog = await tx.pumpLog.create({
        data: {
          babyId: body.babyId,
          startTime: startTimeUTC,
          endTime: endTimeUTC,
          duration,
          leftAmount: body.leftAmount,
          rightAmount: body.rightAmount,
          totalAmount,
          unitAbbr,
          pumpAction,
          notes: body.notes,
          caretakerId: caretakerId,
          familyId: userFamilyId,
        },
      });

      // Keep the feeding record for reports, but link it to the pump so it can
      // be synchronized and excluded from stored-inventory consumption.
      if (shouldHaveAutoPumpFeed({ trackingEnabled, pumpAction, totalAmount })) {
        await tx.feedLog.create({
          data: {
            time: startTimeUTC,
            type: 'BOTTLE',
            amount: totalAmount,
            unitAbbr: unitAbbr || 'OZ',
            bottleType: 'Breast Milk',
            notes: autoPumpFeedNotes(body.notes),
            sourcePumpId: createdPumpLog.id,
            babyId: body.babyId,
            caretakerId: caretakerId,
            familyId: userFamilyId,
          },
        });
      }

      return createdPumpLog;
    });

    // Format dates as ISO strings for response
    const response: PumpLogResponse = {
      ...pumpLog,
      startTime: formatForResponse(pumpLog.startTime) || '',
      endTime: formatForResponse(pumpLog.endTime) || null,
      createdAt: formatForResponse(pumpLog.createdAt) || '',
      updatedAt: formatForResponse(pumpLog.updatedAt) || '',
      deletedAt: formatForResponse(pumpLog.deletedAt),
    };

    // Notify subscribers about activity creation (non-blocking)
    notifyActivityCreated(pumpLog.babyId, 'pump', { accountId: authContext.accountId, caretakerId: authContext.caretakerId }, { totalAmount, unitAbbr }).catch(console.error);

    return NextResponse.json<ApiResponse<PumpLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating pump log:', error);
    return NextResponse.json<ApiResponse<PumpLogResponse>>(
      {
        success: false,
        error: 'Failed to create pump log',
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
    const body: Partial<PumpLogCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<PumpLogResponse>>(
        {
          success: false,
          error: 'Pump log ID is required',
        },
        { status: 400 }
      );
    }

    const existingPumpLog = await prisma.pumpLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingPumpLog) {
      return NextResponse.json<ApiResponse<PumpLogResponse>>(
        {
          success: false,
          error: 'Pump log not found or access denied',
        },
        { status: 404 }
      );
    }

    // If the caller is reassigning the pump to a baby, that baby must belong to
    // their family — never trust a client-sent babyId across families.
    if (body.babyId !== undefined && body.babyId !== existingPumpLog.babyId) {
      const targetBaby = await prisma.baby.findFirst({
        where: { id: body.babyId, familyId: userFamilyId },
      });
      if (!targetBaby) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
      }
    }

    // Validate/normalize the volume unit before it reaches the balance math.
    if (body.unitAbbr !== undefined) {
      const normalizedUnit = normalizeVolumeUnit(body.unitAbbr);
      if (!normalizedUnit) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid unit. Supported units are OZ and ML.' }, { status: 400 });
      }
      body.unitAbbr = normalizedUnit;
    }

    // Process date fields and prepare data for update
    const data: any = {};
    
    if (body.startTime) {
      data.startTime = toUTC(body.startTime);
    }
    
    if (body.endTime) {
      data.endTime = toUTC(body.endTime);
    }
    
    // Calculate duration if not provided but start and end times are available
    if (body.duration !== undefined) {
      data.duration = body.duration;
    } else if ((body.startTime || existingPumpLog.startTime) && 
              (body.endTime || existingPumpLog.endTime)) {
      const start = body.startTime ? toUTC(body.startTime) : existingPumpLog.startTime;
      const end = body.endTime ? toUTC(body.endTime) : existingPumpLog.endTime;
      if (start && end) {
        data.duration = calculateDurationMinutes(start, end);
      }
    }
    
    // Calculate total amount if left or right amounts are updated
    if (body.totalAmount !== undefined) {
      data.totalAmount = body.totalAmount;
    } else if (body.leftAmount !== undefined || body.rightAmount !== undefined) {
      const leftAmount = body.leftAmount !== undefined ? body.leftAmount : existingPumpLog.leftAmount || 0;
      const rightAmount = body.rightAmount !== undefined ? body.rightAmount : existingPumpLog.rightAmount || 0;
      data.totalAmount = leftAmount + rightAmount;
    }
    
    // Add other fields
    if (body.leftAmount !== undefined) data.leftAmount = body.leftAmount;
    if (body.rightAmount !== undefined) data.rightAmount = body.rightAmount;
    if (body.unitAbbr !== undefined) data.unitAbbr = body.unitAbbr;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.babyId !== undefined) data.babyId = body.babyId;
    if (body.pumpAction !== undefined) {
      if (!['STORED', 'FED', 'DISCARDED'].includes(body.pumpAction)) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid pump action. Must be STORED, FED, or DISCARDED.' }, { status: 400 });
      }
      data.pumpAction = body.pumpAction;
    }

    const finalStartTime = body.startTime ? toUTC(body.startTime) : existingPumpLog.startTime;
    const finalTotalAmount = body.totalAmount !== undefined
      ? body.totalAmount
      : (body.leftAmount !== undefined || body.rightAmount !== undefined)
        ? (body.leftAmount !== undefined ? body.leftAmount : existingPumpLog.leftAmount || 0) +
          (body.rightAmount !== undefined ? body.rightAmount : existingPumpLog.rightAmount || 0)
        : existingPumpLog.totalAmount;
    const finalPumpAction = body.pumpAction ?? existingPumpLog.pumpAction;
    const finalUnitAbbr = body.unitAbbr !== undefined ? body.unitAbbr : existingPumpLog.unitAbbr;
    const finalNotes = body.notes !== undefined ? body.notes : existingPumpLog.notes;
    const finalBabyId = body.babyId !== undefined ? body.babyId : existingPumpLog.babyId;

    const familySettings = await prisma.settings.findFirst({
      where: { familyId: userFamilyId },
      select: { enableBreastMilkTracking: true },
    });
    const trackingEnabled = familySettings?.enableBreastMilkTracking !== false;

    const pumpLog = await prisma.$transaction(async (tx) => {
      const linkedAutoFeed = await tx.feedLog.findFirst({
        where: {
          sourcePumpId: id,
          familyId: userFamilyId,
          babyId: existingPumpLog.babyId,
        },
      });
      const legacyAutoFeed = linkedAutoFeed ? null : await tx.feedLog.findFirst({
        where: {
          sourcePumpId: null,
          babyId: existingPumpLog.babyId,
          familyId: userFamilyId,
          time: existingPumpLog.startTime,
          type: 'BOTTLE',
          bottleType: 'Breast Milk',
          ...(existingPumpLog.totalAmount != null ? { amount: existingPumpLog.totalAmount } : {}),
          notes: { startsWith: AUTO_PUMP_FEED_PREFIX },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const updatedPumpLog = await tx.pumpLog.update({
        where: { id },
        data,
      });

      const plan = planAutoFeedSync({
        shouldHaveAutoFeed: shouldHaveAutoPumpFeed({
          trackingEnabled,
          pumpAction: finalPumpAction,
          totalAmount: finalTotalAmount,
        }),
        linkedAutoFeedId: linkedAutoFeed?.id,
        legacyAutoFeedId: legacyAutoFeed?.id,
      });

      if (plan.action === 'upsert') {
        const feedData = {
          time: finalStartTime,
          type: 'BOTTLE' as const,
          amount: finalTotalAmount,
          unitAbbr: finalUnitAbbr || 'OZ',
          bottleType: 'Breast Milk',
          notes: autoPumpFeedNotes(finalNotes),
          sourcePumpId: id,
          deletedAt: null,
          babyId: finalBabyId,
          caretakerId: existingPumpLog.caretakerId,
          familyId: userFamilyId,
        };

        if (plan.updateId) {
          await tx.feedLog.update({ where: { id: plan.updateId }, data: feedData });
        } else {
          await tx.feedLog.create({ data: feedData });
        }
      } else if (plan.action === 'delete') {
        for (const feedId of plan.deleteIds) {
          await tx.feedLog.delete({ where: { id: feedId } });
        }
      }

      return updatedPumpLog;
    });

    // Format dates as ISO strings for response
    const response: PumpLogResponse = {
      ...pumpLog,
      startTime: formatForResponse(pumpLog.startTime) || '',
      endTime: formatForResponse(pumpLog.endTime) || null,
      createdAt: formatForResponse(pumpLog.createdAt) || '',
      updatedAt: formatForResponse(pumpLog.updatedAt) || '',
      deletedAt: formatForResponse(pumpLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<PumpLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating pump log:', error);
    return NextResponse.json<ApiResponse<PumpLogResponse>>(
      {
        success: false,
        error: 'Failed to update pump log',
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
    
    const queryParams: any = {
      familyId: userFamilyId,
      ...(babyId && { babyId }),
    };
    
    // Add date range filter if both start and end dates are provided
    if (startDate && endDate) {
      queryParams.startTime = {
        gte: toUTC(startDate),
        lte: toUTC(endDate),
      };
    }

    // If ID is provided, fetch a single pump log
    if (id) {
      const pumpLog = await prisma.pumpLog.findFirst({
        where: { 
          id,
          familyId: userFamilyId,
        },
      });

      if (!pumpLog) {
        return NextResponse.json<ApiResponse<PumpLogResponse>>(
          {
            success: false,
            error: 'Pump log not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates as ISO strings for response
      const response: PumpLogResponse = {
        ...pumpLog,
        startTime: formatForResponse(pumpLog.startTime) || '',
        endTime: formatForResponse(pumpLog.endTime) || null,
        createdAt: formatForResponse(pumpLog.createdAt) || '',
        updatedAt: formatForResponse(pumpLog.updatedAt) || '',
        deletedAt: formatForResponse(pumpLog.deletedAt),
      };

      return NextResponse.json<ApiResponse<PumpLogResponse>>({
        success: true,
        data: response,
      });
    }

    // Otherwise, fetch multiple pump logs based on query parameters
    const pumpLogs = await prisma.pumpLog.findMany({
      where: queryParams,
      orderBy: {
        startTime: 'desc',
      },
    });

    // Format dates as ISO strings for response
    const response: PumpLogResponse[] = pumpLogs.map(pumpLog => ({
      ...pumpLog,
      startTime: formatForResponse(pumpLog.startTime) || '',
      endTime: formatForResponse(pumpLog.endTime) || null,
      createdAt: formatForResponse(pumpLog.createdAt) || '',
      updatedAt: formatForResponse(pumpLog.updatedAt) || '',
      deletedAt: formatForResponse(pumpLog.deletedAt),
    }));

    return NextResponse.json<ApiResponse<PumpLogResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching pump logs:', error);
    return NextResponse.json<ApiResponse<PumpLogResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch pump logs',
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
          error: 'Pump log ID is required',
        },
        { status: 400 }
      );
    }

    const existingPumpLog = await prisma.pumpLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingPumpLog) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Pump log not found or access denied',
        },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const linkedAutoFeed = await tx.feedLog.findFirst({
        where: {
          sourcePumpId: id,
          familyId: userFamilyId,
          babyId: existingPumpLog.babyId,
        },
      });
      const legacyAutoFeed = linkedAutoFeed ? null : await tx.feedLog.findFirst({
        where: {
          sourcePumpId: null,
          babyId: existingPumpLog.babyId,
          familyId: userFamilyId,
          time: existingPumpLog.startTime,
          type: 'BOTTLE',
          bottleType: 'Breast Milk',
          ...(existingPumpLog.totalAmount != null ? { amount: existingPumpLog.totalAmount } : {}),
          notes: { startsWith: AUTO_PUMP_FEED_PREFIX },
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      const plan = planAutoFeedSync({
        shouldHaveAutoFeed: false,
        linkedAutoFeedId: linkedAutoFeed?.id,
        legacyAutoFeedId: legacyAutoFeed?.id,
      });

      if (plan.action === 'delete') {
        for (const feedId of plan.deleteIds) {
          await tx.feedLog.delete({ where: { id: feedId } });
        }
      }

      await tx.pumpLog.delete({ where: { id } });
    });

    return NextResponse.json<ApiResponse<void>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting pump log:', error);
    return NextResponse.json<ApiResponse<void>>(
      {
        success: false,
        error: 'Failed to delete pump log',
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
