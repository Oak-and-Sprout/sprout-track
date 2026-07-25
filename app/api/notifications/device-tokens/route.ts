import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { parseDeviceTokenBody } from './validation';
import { isFcmConfigured } from '../../../../src/lib/notifications/fcmPush';
import { isApnsConfigured } from '../../../../src/lib/notifications/apnsPush';

export function deviceTokenRoutesEnabled(flags: { fcm: boolean; apns: boolean }): boolean {
  return flags.fcm || flags.apns;
}

export function upsertWhere(args: { token: string; familyId: string }) {
  return { token_familyId: { token: args.token, familyId: args.familyId } };
}

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  if (!deviceTokenRoutesEnabled({ fcm: isFcmConfigured(), apns: isApnsConfigured() })) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Not found.' },
      { status: 404 }
    );
  }

  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    const parsed = parseDeviceTokenBody(body);
    if (!parsed) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: 'Invalid device token payload.' },
        { status: 400 }
      );
    }

    const data = {
      platform: parsed.platform,
      familyId,
      accountId: accountId ?? null,
      caretakerId: caretakerId ?? null,
    };
    const record = await prisma.deviceToken.upsert({
      where: upsertWhere({ token: parsed.token, familyId }),
      update: data,
      create: { token: parsed.token, ...data },
    });

    return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id: record.id } });
  } catch (error: any) {
    console.error('Error registering device token:', error);
    return NextResponse.json<ApiResponse<{ id: string }>>(
      { success: false, error: error.message || 'Failed to register device token' } as ApiResponse<{ id: string }>,
      { status: 500 }
    );
  }
}

// Spec D7: unauthenticated by design. The device token is high-entropy and held
// only by the device that owns it, so presenting it is self-authenticating for
// this one operation. The shell has no JWT when a family is removed, and
// acquiring one would fire a biometric prompt on a delete action. Deleting a
// push token grants no read or write access to family data.
async function handleDelete(req: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  if (!deviceTokenRoutesEnabled({ fcm: isFcmConfigured(), apns: isApnsConfigured() })) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Not found.' },
      { status: 404 }
    );
  }

  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing token parameter.' },
        { status: 400 }
      );
    }

    // Exact full-token match only; never reveal whether a row existed.
    await prisma.deviceToken.deleteMany({ where: { token } });
    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error: any) {
    console.error('Error deleting device token:', error);
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: error.message || 'Failed to delete device token' },
      { status: 500 }
    );
  }
}

export const POST = withAuthContext(handlePost);
export const DELETE = handleDelete; // unauthenticated by design — spec D7
