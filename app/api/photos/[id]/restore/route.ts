import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';
import { checkWritePermission } from '../../../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse } from '../../photo-service';

/** POST /api/photos/[id]/restore — bring a photo back from Trash. */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const pathParts = new URL(req.url).pathname.split('/');
    const id = pathParts[pathParts.length - 2];
    const existing = await prisma.photo.findFirst({ where: { id, familyId: authContext.familyId } });
    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }
    await prisma.photo.update({ where: { id }, data: { deletedAt: null } });
    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Error restoring photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to restore photo' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
