import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';

async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
  if (deploymentMode !== 'saas') {
    return NextResponse.json(
      { success: false, error: 'Gift codes are disabled in self-hosted mode' },
      { status: 404 }
    );
  }

  try {
    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id : null;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing gift code id' }, { status: 400 });
    }

    // Only unredeemed, unrevoked codes can be revoked.
    const result = await prisma.giftCode.updateMany({
      where: { id, redeemedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Code not found or cannot be revoked' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error revoking gift code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to revoke gift code' },
      { status: 500 }
    );
  }
}

export const POST = withSysAdminAuth(postHandler);
