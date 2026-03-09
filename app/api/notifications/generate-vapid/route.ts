import { NextRequest, NextResponse } from 'next/server';
import * as webPush from 'web-push';
import { ApiResponse } from '../../types';
import { withSysAdminAuth } from '../../utils/auth';

/**
 * POST handler for generating new VAPID keys
 * Returns the keypair without saving — the admin UI saves via app-config PUT
 * Requires system administrator authentication
 */
async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
  try {
    const vapidKeys = webPush.generateVAPIDKeys();

    return NextResponse.json<ApiResponse<{ publicKey: string; privateKey: string }>>({
      success: true,
      data: {
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey,
      },
    });
  } catch (error) {
    console.error('Error generating VAPID keys:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Failed to generate VAPID keys',
      },
      { status: 500 }
    );
  }
}

export const POST = withSysAdminAuth(postHandler);
