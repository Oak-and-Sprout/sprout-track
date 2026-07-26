import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { checkWritePermission } from '../../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse, purgePhotosPermanently } from '../photo-service';

/**
 * POST /api/photos/bulk — { action: 'trash' | 'restore' | 'purge', ids: string[] }
 * Powers gallery select-mode delete and Trash view Restore / Delete Forever.
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId } = authContext;
    const body: { action: string; ids: string[] } = await req.json();

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo IDs are required' }, { status: 400 });
    }

    let count = 0;
    if (body.action === 'trash') {
      const result = await prisma.photo.updateMany({
        where: { id: { in: body.ids }, familyId, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      count = result.count;
    } else if (body.action === 'restore') {
      const result = await prisma.photo.updateMany({
        where: { id: { in: body.ids }, familyId, deletedAt: { not: null } },
        data: { deletedAt: null },
      });
      count = result.count;
    } else if (body.action === 'purge') {
      // Delete Forever only applies to photos already in Trash
      const trashed = await prisma.photo.findMany({
        where: { id: { in: body.ids }, familyId, deletedAt: { not: null } },
        select: { id: true },
      });
      count = await purgePhotosPermanently(trashed.map((p) => p.id), familyId!);
    } else {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid bulk action' }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<{ count: number }>>({ success: true, data: { count } });
  } catch (error) {
    console.error('Error in bulk photo action:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to perform bulk action' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
