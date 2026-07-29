import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, FeedLogResponse } from '../../types';
import { FeedType } from '@prisma/client';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { formatForResponse } from '../../utils/timezone';

async function handleGet(req: NextRequest, authContext: AuthResult) {
  try {
    const { searchParams } = new URL(req.url);
    const babyId = searchParams.get('babyId');
    const type = searchParams.get('type') as FeedType | undefined;
    const { familyId, isAccountAuth, caretakerId, accountId } = authContext;

    if (!babyId) {
      return NextResponse.json<ApiResponse<FeedLogResponse>>(
        {
          success: false,
          error: 'Baby ID is required',
        },
        { status: 400 }
      );
    }

    // Handle case where account user doesn't have familyId yet
    if (!familyId) {
      if (isAccountAuth) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Account setup incomplete. Please complete family setup.',
          },
          { status: 403 }
        );
      } else {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'User is not associated with a family.',
          },
          { status: 403 }
        );
      }
    }

    // Validate that the baby belongs to the family
    const baby = await prisma.baby.findFirst({
      where: {
        id: babyId,
        familyId: familyId,
      },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Baby not found in this family.',
        },
        { status: 404 }
      );
    }

    // Build where clause based on provided parameters. Soft-deleted logs are
    // excluded: "last feed" drives the nursery Last-used side hint and the
    // average bottle amount, and an undone feed must stop influencing both.
    const whereClause: any = {
      babyId,
      familyId,
      deletedAt: null,
      ...(type && { type }), // Only include type if it's provided
    };

    const feedLog = await prisma.feedLog.findFirst({
      where: whereClause,
      orderBy: {
        time: 'desc',
      },
    });

    if (!feedLog) {
    return NextResponse.json<ApiResponse<FeedLogResponse | undefined>>({
      success: true,
      data: undefined,
      });
    }

    const response: FeedLogResponse = {
      ...feedLog,
      time: formatForResponse(feedLog.time) || '',
      createdAt: formatForResponse(feedLog.createdAt) || '',
      updatedAt: formatForResponse(feedLog.updatedAt) || '',
      deletedAt: formatForResponse(feedLog.deletedAt),
    };

    return NextResponse.json<ApiResponse<FeedLogResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error fetching last feed log:', error);
    return NextResponse.json<ApiResponse<FeedLogResponse | undefined>>(
      {
        success: false,
        error: 'Failed to fetch last feed log',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(
  handleGet as (req: NextRequest, authContext: AuthResult) => Promise<NextResponse<ApiResponse<any>>>
);
