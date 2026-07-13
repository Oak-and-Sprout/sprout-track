import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, PhotoResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toUTC } from '../../utils/timezone';
import { checkWritePermission } from '../../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse, toPhotoResponse, PHOTO_INCLUDE } from '../photo-service';

function extractId(req: NextRequest): string {
  const pathParts = new URL(req.url).pathname.split('/');
  return pathParts[pathParts.length - 1];
}

/**
 * PATCH /api/photos/[id] — edit caption, takenAt, milestoneId.
 * Changing the milestone re-syncs the automatic milestone PhotoLink.
 */
async function handlePatch(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const id = extractId(req);
    const { familyId } = authContext;
    const body: { caption?: string | null; takenAt?: string; milestoneId?: string | null } = await req.json();

    const existing = await prisma.photo.findFirst({ where: { id, familyId } });
    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }

    if (body.milestoneId !== undefined && body.milestoneId !== null) {
      const milestone = await prisma.milestone.findFirst({ where: { id: body.milestoneId, familyId } });
      if (!milestone) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Milestone not found in this family.' }, { status: 404 });
      }
    }

    const photo = await prisma.photo.update({
      where: { id },
      data: {
        ...(body.caption !== undefined && { caption: body.caption && body.caption.trim() ? body.caption.trim() : null }),
        ...(body.takenAt && { takenAt: toUTC(body.takenAt) }),
        ...(body.milestoneId !== undefined && { milestoneId: body.milestoneId }),
      },
      include: PHOTO_INCLUDE,
    });

    // Re-sync the automatic milestone link when the tag changed
    if (body.milestoneId !== undefined && body.milestoneId !== existing.milestoneId) {
      if (existing.milestoneId) {
        await prisma.photoLink.deleteMany({
          where: { photoId: id, activityType: 'milestone', activityId: existing.milestoneId },
        });
      }
      if (body.milestoneId) {
        await prisma.photoLink.create({
          data: { photoId: id, activityType: 'milestone', activityId: body.milestoneId },
        });
      }
      const refreshed = await prisma.photo.findFirst({ where: { id }, include: PHOTO_INCLUDE });
      return NextResponse.json<ApiResponse<PhotoResponse>>({ success: true, data: toPhotoResponse(refreshed!, authContext) });
    }

    return NextResponse.json<ApiResponse<PhotoResponse>>({ success: true, data: toPhotoResponse(photo, authContext) });
  } catch (error) {
    console.error('Error updating photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update photo' }, { status: 500 });
  }
}

/**
 * DELETE /api/photos/[id] — soft-delete to Trash (30-day recovery).
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const id = extractId(req);
    const existing = await prisma.photo.findFirst({ where: { id, familyId: authContext.familyId } });
    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }
    await prisma.photo.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to delete photo' }, { status: 500 });
  }
}

export const PATCH = withAuthContext(handlePatch as any);
export const DELETE = withAuthContext(handleDelete as any);
