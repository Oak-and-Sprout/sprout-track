import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../../types';

/**
 * GET handler for VAPID public key
 * Returns the public VAPID key for client-side subscription
 * No authentication required - public key is safe to expose
 */
export async function GET(req: NextRequest) {
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
    const publicKey = process.env.VAPID_PUBLIC_KEY;

    if (!publicKey) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'VAPID keys are not configured. Please run setup to generate keys.',
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
