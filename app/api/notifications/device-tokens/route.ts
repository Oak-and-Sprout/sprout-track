import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { parseDeviceTokenBody } from './validation';

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ id: string }>>> {
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
      where: { token: parsed.token },
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

async function handleDelete(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const { familyId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'User is not associated with a family.' },
        { status: 403 }
      );
    }

    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Missing token parameter.' },
        { status: 400 }
      );
    }

    const record = await prisma.deviceToken.findUnique({ where: { token } });
    if (!record || record.familyId !== familyId) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: 'Device token not found.' },
        { status: 404 }
      );
    }

    await prisma.deviceToken.delete({ where: { token } });
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
export const DELETE = withAuthContext(handleDelete);
