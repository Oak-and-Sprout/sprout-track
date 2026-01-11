import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';

/**
 * POST handler for cron-triggered notification checks
 * Protected by NOTIFICATION_CRON_SECRET header
 * This endpoint will be called by system cron to check for timer expirations
 */
export async function POST(req: NextRequest) {
  try {
    // Verify secret header
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = process.env.NOTIFICATION_CRON_SECRET;

    if (!expectedSecret) {
      console.error('NOTIFICATION_CRON_SECRET is not configured');
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Cron secret not configured',
        },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Unauthorized: Missing or invalid Authorization header',
        },
        { status: 401 }
      );
    }

    const providedSecret = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (providedSecret !== expectedSecret) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Unauthorized: Invalid secret',
        },
        { status: 401 }
      );
    }

    // TODO: Phase 8 - Implement timer check utility
    // TODO: Phase 10 - Implement cleanup utility
    // For now, return success with placeholder response
    const result = {
      notificationsSent: 0,
      subscriptionsCleaned: 0,
      message: 'Timer check and cleanup utilities not yet implemented (Phases 8 & 10)',
    };

    return NextResponse.json<ApiResponse<typeof result>>({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in notification cron endpoint:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to process cron request',
      },
      { status: 500 }
    );
  }
}
