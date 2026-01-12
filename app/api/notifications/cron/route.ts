import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';
import { checkTimerExpirations } from '../../../../src/lib/notifications/timerCheck';
import { runCleanup } from '../../../../src/lib/notifications/cleanup';

/**
 * POST handler for cron-triggered notification checks
 * Protected by NOTIFICATION_CRON_SECRET header
 * This endpoint will be called by system cron to check for timer expirations
 */
export async function POST(req: NextRequest) {
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

    // Run timer check to detect expired timers and send notifications
    let notificationsSent = 0;
    try {
      notificationsSent = await checkTimerExpirations();
    } catch (error) {
      console.error('Error in timer check:', error);
      // Continue with cleanup even if timer check fails
    }

    // Run cleanup to remove failed subscriptions and old logs
    let subscriptionsCleaned = 0;
    let logsCleaned = 0;
    try {
      const cleanupResult = await runCleanup();
      subscriptionsCleaned = cleanupResult.subscriptionsCleaned;
      logsCleaned = cleanupResult.logsCleaned;
    } catch (error) {
      console.error('Error in cleanup:', error);
      // Don't fail the entire request if cleanup fails
    }

    const result = {
      notificationsSent,
      subscriptionsCleaned,
      logsCleaned,
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
