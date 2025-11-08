import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, MilestoneCreate, MilestoneResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';

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

    const body: MilestoneCreate = await req.json();

    const baby = await prisma.baby.findFirst({
      where: { id: body.babyId, familyId: userFamilyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    // Convert date to UTC for storage
    const dateUTC = toUTC(body.date);
    
    const milestone = await prisma.milestone.create({
      data: {
        ...body,
        date: dateUTC,
        caretakerId: caretakerId,
        familyId: userFamilyId,
      },
    });

    // Format dates as ISO strings for response
    const response: MilestoneResponse = {
      ...milestone,
      date: formatForResponse(milestone.date) || '',
      createdAt: formatForResponse(milestone.createdAt) || '',
      updatedAt: formatForResponse(milestone.updatedAt) || '',
      deletedAt: formatForResponse(milestone.deletedAt),
    };

    return NextResponse.json<ApiResponse<MilestoneResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json<ApiResponse<MilestoneResponse>>(
      {
        success: false,
        error: 'Failed to create milestone',
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
    const body: Partial<MilestoneCreate> = await req.json();

    if (!id) {
      return NextResponse.json<ApiResponse<MilestoneResponse>>(
        {
          success: false,
          error: 'Milestone ID is required',
        },
        { status: 400 }
      );
    }

    const existingMilestone = await prisma.milestone.findFirst({
      where: { 
        id,
        familyId: userFamilyId 
      },
    });

    if (!existingMilestone) {
      return NextResponse.json<ApiResponse<MilestoneResponse>>(
        {
          success: false,
          error: 'Milestone not found or access denied',
        },
        { status: 404 }
      );
    }

    // Convert date to UTC if provided
    const data = body.date
      ? { ...body, date: toUTC(body.date) }
      : body;

    const milestone = await prisma.milestone.update({
      where: { 
        id
      },
      data,
    });

    // Format dates as ISO strings for response
    const response: MilestoneResponse = {
      ...milestone,
      date: formatForResponse(milestone.date) || '',
      createdAt: formatForResponse(milestone.createdAt) || '',
      updatedAt: formatForResponse(milestone.updatedAt) || '',
      deletedAt: formatForResponse(milestone.deletedAt),
    };

    return NextResponse.json<ApiResponse<MilestoneResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json<ApiResponse<MilestoneResponse>>(
      {
        success: false,
        error: 'Failed to update milestone',
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
    const category = searchParams.get('category');
    
    const queryParams: any = {
      familyId: userFamilyId,
      ...(babyId && { babyId }),
      ...(category && { category }),
      ...(startDate && endDate && {
        date: {
          gte: toUTC(startDate),
          lte: toUTC(endDate),
        },
      }),
    };

    if (id) {
      const milestone = await prisma.milestone.findFirst({
        where: { 
          id,
          familyId: userFamilyId
        },
      });

      if (!milestone) {
        return NextResponse.json<ApiResponse<MilestoneResponse>>(
          {
            success: false,
            error: 'Milestone not found or access denied',
          },
          { status: 404 }
        );
      }

      // Format dates as ISO strings for response
      const response: MilestoneResponse = {
        ...milestone,
        date: formatForResponse(milestone.date) || '',
        createdAt: formatForResponse(milestone.createdAt) || '',
        updatedAt: formatForResponse(milestone.updatedAt) || '',
        deletedAt: formatForResponse(milestone.deletedAt),
      };

      return NextResponse.json<ApiResponse<MilestoneResponse>>({
        success: true,
        data: response,
      });
    }

    const milestones = await prisma.milestone.findMany({
      where: queryParams,
      orderBy: {
        date: 'desc',
      },
      include: {
        baby: {
          select: {
            firstName: true,
            lastName: true,
            inactive: true,
          },
        },
        caretaker: {
          select: {
            name: true,
            type: true,
            inactive: true,
          },
        },
      },
    });

    // Format dates as ISO strings for response and transform to expected response format
    const response = milestones.map(milestone => {
      // Extract the milestone data without the relations
      const { baby, caretaker, ...milestoneData } = milestone;
      
      // Create the properly formatted response
      return {
        ...milestoneData,
        date: formatForResponse(milestone.date) || '',
        createdAt: formatForResponse(milestone.createdAt) || '',
        updatedAt: formatForResponse(milestone.updatedAt) || '',
        deletedAt: formatForResponse(milestone.deletedAt),
        // We could include baby and caretaker info here if needed
      } as MilestoneResponse;
    });

    return NextResponse.json<ApiResponse<MilestoneResponse[]>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json<ApiResponse<MilestoneResponse[]>>(
      {
        success: false,
        error: 'Failed to fetch milestones',
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
          error: 'Milestone ID is required',
        },
        { status: 400 }
      );
    }

    const existingMilestone = await prisma.milestone.findFirst({
      where: { 
        id,
        familyId: userFamilyId
      },
    });

    if (!existingMilestone) {
      return NextResponse.json<ApiResponse<void>>(
        {
          success: false,
          error: 'Milestone not found or access denied',
        },
        { status: 404 }
      );
    }

    await prisma.milestone.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse<void>>({
      success: true,
    });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json<ApiResponse<void>>(
      {
        success: false,
        error: 'Failed to delete milestone',
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
