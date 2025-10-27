import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, SleepLogResponse, FeedLogResponse, DiaperLogResponse, NoteResponse, BathLogResponse, PumpLogResponse, MilestoneResponse, MeasurementResponse, MedicineLogResponse, MedicineResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';

// Extended activity types with caretaker information
type ActivityTypeWithCaretaker = (
  SleepLogResponse | FeedLogResponse | DiaperLogResponse | NoteResponse | BathLogResponse | PumpLogResponse | MilestoneResponse | MeasurementResponse | MedicineLogResponse
) & {
  caretakerId?: string | null;
  caretakerName?: string;
  medicine?: MedicineResponse;
};

type ActivityType = ActivityTypeWithCaretaker;

const getActivityTime = (activity: any): number => {
  // For activities with a simple time field (feed, diaper, note, bath)
  if ('time' in activity && activity.time) {
    return new Date(activity.time).getTime();
  }
  
  // For activities with startTime/endTime (sleep, pump)
  if ('startTime' in activity && activity.startTime) {
    // For sleep activities, use endTime if available
    if ('type' in activity && ['NAP', 'NIGHT'].includes(activity.type) && activity.endTime) {
      return new Date(activity.endTime).getTime();
    }
    // For pump activities, always use startTime for sorting
    if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
      return new Date(activity.startTime).getTime();
    }
    // Default to startTime for any other activities with startTime
    return new Date(activity.startTime).getTime();
  }
  
  // For activities with a date field (milestone, measurement)
  if ('date' in activity && activity.date) {
    return new Date(activity.date).getTime();
  }
  
  // Fallback
  return new Date().getTime();
};

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { caretakerId, familyId: caretakerFamilyId } = authContext;

    if (!caretakerFamilyId) {
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: 'User is not associated with a family.' },
            { status: 403 }
        );
    }
    
    const url = new URL(req.url);
    const { searchParams } = url;
    
    const babyId = searchParams.get('babyId');

    if (!babyId) {
      return NextResponse.json<ApiResponse<ActivityType[]>>(
        {
          success: false,
          error: 'Baby ID is required',
        },
        { status: 400 }
      );
    }

    // Verify that the baby belongs to the caretaker's family
    const baby = await prisma.baby.findFirst({
        where: {
            id: babyId,
            familyId: caretakerFamilyId,
        },
        select: {
            familyId: true,
        },
    });

    if (!baby) {
        return NextResponse.json<ApiResponse<null>>(
            { success: false, error: "Baby not found in this family." },
            { status: 404 }
        );
    }

    const familyId = baby.familyId; // Use the verified family ID for all queries

    // Get the full URL to debug
    // const fullUrl = req.url;
    // console.log(`Full request URL: ${fullUrl}`);
    
    // Log all search parameters for debugging
    console.log("All search parameters:");
    // Array.from(searchParams.entries()).forEach(([key, value]) => {
      // console.log(`${key}: ${value}`);
    // });
    
    const limit = Number(searchParams.get('limit')) || 200;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // console.log(`API Request - babyId: ${babyId}, startDate: ${startDate}, endDate: ${endDate}`);

    let effectiveStartDate = startDate;
    let effectiveEndDate = endDate;
    let useLimit = true;
    
    if (startDate && endDate) {
      // Don't use limit when filtering by date range
      useLimit = false;
      // console.log(`Using date range: ${startDate} to ${endDate}`);
    } else {
      // console.log(`No date parameters provided, using limit: ${limit}`);
    }

    // Log query parameters
    // console.log(`Query parameters - useLimit: ${useLimit}, limit: ${limit}`);
    // console.log(`Date filtering: ${effectiveStartDate ? 'Yes' : 'No'}`);
    // console.log(`Effective start date: ${effectiveStartDate}`);
    // console.log(`Effective end date: ${effectiveEndDate}`);
    
    // Convert date strings to UTC for database queries
    const startDateUTC = effectiveStartDate ? toUTC(effectiveStartDate) : undefined;
    const endDateUTC = effectiveEndDate ? toUTC(effectiveEndDate) : undefined;
    
    // Get recent activities from each type with caretaker information
    const [sleepLogs, feedLogs, diaperLogs, noteLogs, bathLogs, pumpLogs, milestoneLogs, measurementLogs, medicineLogs] = await Promise.all([
      prisma.sleepLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            OR: [
              // Sleep logs that start within the date range
              {
                startTime: {
                  gte: startDateUTC,
                  lte: endDateUTC
                }
              },
              // Sleep logs that end within the date range
              {
                endTime: {
                  gte: startDateUTC,
                  lte: endDateUTC
                }
              },
              // Sleep logs that span the date range
              {
                startTime: { lte: startDateUTC },
                endTime: { gte: endDateUTC }
              }
            ]
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { startTime: 'desc' }
      }),
      prisma.feedLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            time: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { time: 'desc' }
      }),
      prisma.diaperLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            time: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { time: 'desc' }
      }),
      prisma.note.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            time: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { time: 'desc' }
      }),
      prisma.bathLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            time: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { time: 'desc' }
      }),
      prisma.pumpLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            startTime: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { startTime: 'desc' }
      }),
      prisma.milestone.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            date: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { date: 'desc' }
      }),
      prisma.measurement.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            date: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true
        },
        orderBy: { date: 'desc' }
      }),
      prisma.medicineLog.findMany({
        where: {
          babyId,
          ...(startDateUTC && endDateUTC ? {
            time: {
              gte: startDateUTC,
              lte: endDateUTC
            }
          } : {}),
          familyId, // Filter by the verified family ID
        },
        include: {
          caretaker: true,
          medicine: true
        },
        orderBy: { time: 'desc' }
      })
    ]);
    
    console.log(`Results - sleepLogs: ${sleepLogs.length}, feedLogs: ${feedLogs.length}, diaperLogs: ${diaperLogs.length}, noteLogs: ${noteLogs.length}, bathLogs: ${bathLogs.length}, pumpLogs: ${pumpLogs.length}`);

    // Format the responses with caretaker information
    const formattedSleepLogs: ActivityTypeWithCaretaker[] = sleepLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          startTime: formatForResponse(log.startTime) || '',
          endTime: formatForResponse(log.endTime) || null,
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });

    const formattedFeedLogs: ActivityTypeWithCaretaker[] = feedLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          time: formatForResponse(log.time) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });

    const formattedDiaperLogs: ActivityTypeWithCaretaker[] = diaperLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          time: formatForResponse(log.time) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });

    const formattedNoteLogs: ActivityTypeWithCaretaker[] = noteLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          time: formatForResponse(log.time) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });
      
    const formattedBathLogs: ActivityTypeWithCaretaker[] = bathLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          time: formatForResponse(log.time) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });
      
    const formattedPumpLogs: ActivityTypeWithCaretaker[] = pumpLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Get the unit from the unitAbbr field or default to 'oz', ensuring it's lowercase
        const unit = log.unitAbbr ? log.unitAbbr.toLowerCase() : 'oz';
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          startTime: formatForResponse(log.startTime) || '',
          endTime: formatForResponse(log.endTime) || null,
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
          unit: unit, // Explicitly include the unit in the response
        };
      });
      
    // Format medicine logs
    const formattedMedicineLogs: ActivityTypeWithCaretaker[] = medicineLogs
      .map(log => {
        const { caretaker, medicine, ...logWithoutCaretaker } = log;
        return {
          ...logWithoutCaretaker,
          time: formatForResponse(log.time) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: caretaker ? caretaker.name : undefined,
          medicine: medicine ? {
            ...medicine,
            createdAt: formatForResponse(medicine.createdAt) || '',
            updatedAt: formatForResponse(medicine.updatedAt) || '',
            deletedAt: formatForResponse(medicine.deletedAt)
          } : undefined
        };
      });

    // Format milestone logs
    const formattedMilestoneLogs: ActivityTypeWithCaretaker[] = milestoneLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          date: formatForResponse(log.date) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });
      
    // Format measurement logs
    const formattedMeasurementLogs: ActivityTypeWithCaretaker[] = measurementLogs
      .map(log => {
        // Create a new object without the caretaker property
        const { caretaker, ...logWithoutCaretaker } = log;
        
        // Format dates as ISO strings
        return {
          ...logWithoutCaretaker,
          date: formatForResponse(log.date) || '',
          createdAt: formatForResponse(log.createdAt) || '',
          updatedAt: formatForResponse(log.updatedAt) || '',
          deletedAt: formatForResponse(log.deletedAt),
          caretakerId: log.caretakerId,
          caretakerName: log.caretaker ? log.caretaker.name : undefined,
        };
      });

    // Combine and sort all activities
    const allActivities = [
      ...formattedSleepLogs,
      ...formattedFeedLogs,
      ...formattedDiaperLogs,
      ...formattedNoteLogs,
      ...formattedBathLogs,
      ...formattedPumpLogs,
      ...formattedMilestoneLogs,
      ...formattedMeasurementLogs,
      ...formattedMedicineLogs
    ]
    .sort((a, b) => getActivityTime(b) - getActivityTime(a));
    
    // Only apply the limit if we're not filtering by date
    const finalActivities = useLimit ? allActivities.slice(0, limit) : allActivities;
    
    console.log(`Final activities count: ${finalActivities.length}`);

    return NextResponse.json<ApiResponse<ActivityType[]>>({
      success: true,
      data: finalActivities
    });
  } catch (error) {
    console.error(`Error fetching timeline:`, error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch timeline',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);