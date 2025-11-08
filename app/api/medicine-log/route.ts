import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, MedicineLogCreate, MedicineLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

/**
 * Handle POST request to create a new medicine log entry
 */
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

    const body: MedicineLogCreate = await req.json();

    const [baby, medicine] = await Promise.all([
      prisma.baby.findFirst({ where: { id: body.babyId, familyId: userFamilyId } }),
      prisma.medicine.findFirst({ where: { id: body.medicineId, familyId: userFamilyId } })
    ]);

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    if (!medicine) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Medicine not found in this family.' }, { status: 404 });
    }

    const timeUTC = toUTC(body.time);
    
    const medicineLog = await prisma.medicineLog.create({
      data: {
        ...body,
        time: timeUTC,
        caretakerId: caretakerId,
        familyId: userFamilyId,
      },
    });

    // Format dates for response
    const response: MedicineLogResponse = {
      ...medicineLog,
      time: formatForResponse(medicineLog.time) || '',
      createdAt: formatForResponse(medicineLog.createdAt) || '',
      updatedAt: formatForResponse(medicineLog.updatedAt) || '',
      deletedAt: formatForResponse(medicineLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<MedicineLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating medicine log:', error);
    return NextResponse.json<ApiResponse<MedicineLogResponse>>(
      {
        success: false,
        error: 'Failed to create medicine log',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT request to update a medicine log entry
 */
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
    const body: Partial<MedicineLogCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<MedicineLogResponse>>(
        {
          success: false,
          error: 'Medicine log ID is required',
        },
        { status: 400 }
      );
    }

    const existingLog = await prisma.medicineLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingLog) {
      return NextResponse.json<ApiResponse<MedicineLogResponse>>(
        {
          success: false,
          error: 'Medicine log not found or access denied',
        },
        { status: 404 }
      );
    }

    const data: any = { ...body };
    if (body.time) {
      data.time = toUTC(body.time);
    }
    delete data.familyId;
    delete data.babyId;
    delete data.medicineId;
    delete data.caretakerId;

    const medicineLog = await prisma.medicineLog.update({
      where: { id },
      data,
    });

    // Format dates for response
    const response: MedicineLogResponse = {
      ...medicineLog,
      time: formatForResponse(medicineLog.time) || '',
      createdAt: formatForResponse(medicineLog.createdAt) || '',
      updatedAt: formatForResponse(medicineLog.updatedAt) || '',
      deletedAt: formatForResponse(medicineLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<MedicineLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating medicine log:', error);
    return NextResponse.json<ApiResponse<MedicineLogResponse>>(
      {
        success: false,
        error: 'Failed to update medicine log',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET request to fetch medicine logs
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { familyId: userFamilyId } = authContext;
    if (!userFamilyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'User is not associated with a family.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const babyId = searchParams.get('babyId');
    const medicineId = searchParams.get('medicineId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '10', 10) : undefined;
    
    // Build where clause
    const where: any = {
      familyId: userFamilyId,
      ...(babyId && { babyId }),
      ...(medicineId && { medicineId }),
      ...(startDate && endDate && {
        time: {
          gte: toUTC(startDate),
          lte: toUTC(endDate),
        },
      }),
    };

    // If ID is provided, fetch a single log
    if (id) {
      const medicineLog = await prisma.medicineLog.findFirst({
        where: { 
          id,
          ...where,
        },
        include: {
          medicine: {
            include: {
              contacts: {
                include: {
                  contact: true
                }
              }
            }
          },
          baby: true,
          caretaker: true,
          unit: true,
        },
      });

      if (!medicineLog) {
        return NextResponse.json<ApiResponse<MedicineLogResponse>>(
          {
            success: false,
            error: 'Medicine log not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates for response
      const response: MedicineLogResponse = {
        ...medicineLog,
        time: formatForResponse(medicineLog.time) || '',
        createdAt: formatForResponse(medicineLog.createdAt) || '',
        updatedAt: formatForResponse(medicineLog.updatedAt) || '',
        deletedAt: formatForResponse(medicineLog.deletedAt),
      };

      return NextResponse.json<ApiResponse<MedicineLogResponse>>({
        success: true,
        data: response,
      });
    }

    // Otherwise, fetch logs based on filters
    const medicineLogs = await prisma.medicineLog.findMany({
      where,
      include: {
        medicine: {
          include: {
            contacts: {
              include: {
                contact: true
              }
            }
          }
        },
        baby: true,
        caretaker: true,
        unit: true,
      },
      orderBy: { time: 'desc' },
      take: limit,
    });

    // Format dates for response
    const response = medicineLogs.map(log => ({
      ...log,
      time: formatForResponse(log.time) || '',
      createdAt: formatForResponse(log.createdAt) || '',
      updatedAt: formatForResponse(log.updatedAt) || '',
      deletedAt: formatForResponse(log.deletedAt),
    }));

    return NextResponse.json<ApiResponse<MedicineLogResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching medicine logs:', error);
    return NextResponse.json<ApiResponse<MedicineLogResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch medicine logs',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to hard delete a medicine log
 */
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
          error: 'Medicine log ID is required',
        },
        { status: 400 }
      );
    }

    const existingLog = await prisma.medicineLog.findFirst({
      where: { id, familyId: userFamilyId },
    });

    if (!existingLog) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Medicine log not found or access denied',
        },
        { status: 404 }
      );
    }

    await prisma.medicineLog.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting medicine log:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to delete medicine log',
      },
      { status: 500 }
    );
  }
}

// Apply authentication middleware to all handlers
export const GET = withAuthContext(handleGet as any);
export const POST = withAuthContext(handlePost as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
