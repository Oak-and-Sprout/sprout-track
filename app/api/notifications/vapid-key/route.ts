import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';
import { isNotificationsEnabled, getNotificationConfig } from '../../../../src/lib/notifications/config';

/**
 * GET handler for VAPID public key
 * Returns the public VAPID key for client-side subscription
 * No authentication required - public key is safe to expose
 */
export async function GET(req: NextRequest) {
  // Check if notifications are enabled
  if (!(await isNotificationsEnabled())) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    const config = await getNotificationConfig();
    const publicKey = config?.vapidPublicKey;

    if (!publicKey) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'VAPID keys are not configured. Configure them in App Configuration.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ApiResponse<{ publicKey: string }>>({
      success: true,
      data: { publicKey },
    });
  } catch (error) {
    console.error('Error fetching VAPID public key:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to fetch VAPID public key',
      },
      { status: 500 }
    );
  }
}
