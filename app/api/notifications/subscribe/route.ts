import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';

/**
 * POST handler for subscribing to push notifications
 * Creates a new PushSubscription record linked to the authenticated user
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Check if notifications are enabled
  if (process.env.ENABLE_NOTIFICATIONS !== 'true') {
    console.log('Push notifications disabled - ENABLE_NOTIFICATIONS is not true');
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    console.log('Processing push subscription request...');
    const { familyId, accountId, caretakerId } = authContext;
    console.log('Auth context:', { familyId, accountId: accountId || null, caretakerId: caretakerId || null });

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
    const { endpoint, keys, deviceLabel, userAgent } = body;

    console.log('Subscription payload:', {
      endpoint: endpoint?.substring(0, 50) + '...',
      hasKeys: !!(keys?.p256dh && keys?.auth),
      deviceLabel,
      userAgent: userAgent?.substring(0, 50) + '...',
    });

    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      console.error('Missing required fields:', {
        hasEndpoint: !!endpoint,
        hasKeys: !!keys,
        hasP256dh: !!keys?.p256dh,
        hasAuth: !!keys?.auth,
      });
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: endpoint, keys.p256dh, keys.auth',
        },
        { status: 400 }
      );
    }

    // Check if subscription already exists for this endpoint
    console.log('Checking for existing subscription...');
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });
    
    if (existing) {
      console.log('Existing subscription found, updating...', { id: existing.id });
    } else {
      console.log('No existing subscription, creating new...');
    }

    if (existing) {
      // Update existing subscription
      const updated = await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          accountId: accountId || null,
          caretakerId: caretakerId || null,
          familyId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          deviceLabel: deviceLabel || null,
          userAgent: userAgent || null,
          failureCount: 0, // Reset failure count on re-subscription
          lastSuccessAt: new Date(),
        },
      });

      return NextResponse.json<ApiResponse<{ id: string }>>({
        success: true,
        data: { id: updated.id },
      });
    }

    // Create new subscription
    const subscription = await prisma.pushSubscription.create({
      data: {
        accountId: accountId || null,
        caretakerId: caretakerId || null,
        familyId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        deviceLabel: deviceLabel || null,
        userAgent: userAgent || null,
      },
    });

    console.log('Push subscription created successfully:', { id: subscription.id, familyId });

    return NextResponse.json<ApiResponse<{ id: string }>>({
      success: true,
      data: { id: subscription.id },
    });
  } catch (error: any) {
    console.error('Error creating push subscription:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to create push subscription',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for unsubscribing from push notifications
 * Removes subscription by endpoint
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
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
    const { familyId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing endpoint parameter',
        },
        { status: 400 }
      );
    }

    // Find subscription and verify it belongs to user's family
    const subscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
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

    // Delete subscription (cascades to NotificationPreference records)
    await prisma.pushSubscription.delete({
      where: { id: subscription.id },
    });

    return NextResponse.json<ApiResponse<null>>({
      success: true,
    });
  } catch (error: any) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to delete push subscription',
      },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(handlePost);
export const DELETE = withAuthContext(handleDelete);
