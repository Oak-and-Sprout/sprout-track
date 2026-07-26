import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../db';
import { ApiResponse } from '../../../types';
import { withAuthContext, AuthResult } from '../../../utils/auth';
import { checkWritePermission } from '../../../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse, favoriteOwnerFilter } from '../../photo-service';

/**
 * POST /api/photos/[id]/favorite — toggle for the current caregiver.
 * Favorite identity comes from favoriteOwnerFilter (shared with
 * toPhotoResponse so reads and writes can never diverge).
 * Uniqueness is app-enforced: find first, then delete or create.
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const pathParts = new URL(req.url).pathname.split('/');
    const id = pathParts[pathParts.length - 2];
    const { familyId } = authContext;

    const ownerWhere = favoriteOwnerFilter(authContext);
    if (!ownerWhere) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'No caregiver identity for favorites' }, { status: 400 });
    }

    const photo = await prisma.photo.findFirst({ where: { id, familyId } });
    if (!photo) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }

    const existing = await prisma.photoFavorite.findFirst({ where: { photoId: id, ...ownerWhere } });

    if (existing) {
      // deleteMany (not delete by id): duplicates from concurrent creates self-heal
      // on the next unfavorite — the schema intentionally has no composite unique
      // because NULLable owner columns behave as distinct on both SQLite and Postgres.
      await prisma.photoFavorite.deleteMany({ where: { photoId: id, ...ownerWhere } });
      return NextResponse.json<ApiResponse<{ isFavorite: boolean }>>({ success: true, data: { isFavorite: false } });
    }
    await prisma.photoFavorite.create({ data: { photoId: id, ...ownerWhere } });
    return NextResponse.json<ApiResponse<{ isFavorite: boolean }>>({ success: true, data: { isFavorite: true } });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to toggle favorite' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
