import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { NotificationEventType } from '@prisma/client';

/**
 * GET handler for notification preferences
 * Returns all preferences for the authenticated user's subscriptions
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    // Get all subscriptions for this user
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        familyId,
        OR: [
          accountId ? { accountId } : {},
          caretakerId ? { caretakerId } : {},
        ],
      },
    });

    const subscriptionIds = subscriptions.map((s) => s.id);

    // Get all preferences for these subscriptions
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        subscriptionId: { in: subscriptionIds },
      },
      include: {
        subscription: {
          select: {
            id: true,
            deviceLabel: true,
            endpoint: true,
          },
        },
        baby: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json<ApiResponse<typeof preferences>>({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch notification preferences',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating notification preferences
 * Creates or updates a NotificationPreference record
 */
async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      subscriptionId,
      babyId,
      eventType,
      activityTypes,
      timerIntervalMinutes,
      enabled,
    } = body;

    if (!subscriptionId || !babyId || !eventType) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: subscriptionId, babyId, eventType',
        },
        { status: 400 }
      );
    }

    // Verify subscription belongs to user's family
    const subscription = await prisma.pushSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Subscription not found',
        },
        { status: 404 }
      );
    }

    if (subscription.familyId !== familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Access denied',
        },
        { status: 403 }
      );
    }

    // Verify baby belongs to user's family
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Baby not found',
        },
        { status: 404 }
      );
    }

    if (baby.familyId !== familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Access denied',
        },
        { status: 403 }
      );
    }

    // Validate eventType
    if (!Object.values(NotificationEventType).includes(eventType)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Invalid eventType',
        },
        { status: 400 }
      );
    }

    // Parse activityTypes if provided (should be JSON string array)
    let activityTypesJson: string | null = null;
    if (activityTypes !== undefined && activityTypes !== null) {
      if (Array.isArray(activityTypes)) {
        activityTypesJson = JSON.stringify(activityTypes);
      } else if (typeof activityTypes === 'string') {
        // Already a JSON string
        activityTypesJson = activityTypes;
      }
    }

    // Create or update preference (upsert based on unique constraint)
    const preference = await prisma.notificationPreference.upsert({
      where: {
        subscriptionId_babyId_eventType: {
          subscriptionId,
          babyId,
          eventType,
        },
      },
      create: {
        subscriptionId,
        babyId,
        eventType,
        activityTypes: activityTypesJson,
        timerIntervalMinutes: timerIntervalMinutes ?? null,
        enabled: enabled !== undefined ? enabled : true,
      },
      update: {
        activityTypes: activityTypesJson !== undefined ? activityTypesJson : undefined,
        timerIntervalMinutes: timerIntervalMinutes !== undefined ? timerIntervalMinutes : undefined,
        enabled: enabled !== undefined ? enabled : undefined,
      },
    });

    return NextResponse.json<ApiResponse<typeof preference>>({
      success: true,
      data: preference,
    });
  } catch (error: any) {
    console.error('Error updating notification preference:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'A preference with this combination already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to update notification preference',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);
