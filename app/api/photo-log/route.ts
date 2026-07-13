import { NextRequest, NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse, PhotoLogCreate, PhotoLogResponse } from '../types';
import { withAuthContext, AuthResult } from '../utils/auth';
import { toUTC, formatForResponse } from '../utils/timezone';
import { checkWritePermission } from '../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse, toPhotoResponse, PHOTO_INCLUDE } from '../photos/photo-service';
import { MAX_PHOTOS_PER_ACTIVITY } from '@/src/utils/photoUtils';

/** Load the photos linked to a photo log, newest-link-first. */
async function getLinkedPhotos(photoLogId: string, authContext: AuthResult) {
  const links = await prisma.photoLink.findMany({
    where: { activityType: 'photo', activityId: photoLogId, photo: { deletedAt: null } },
    orderBy: { createdAt: 'asc' },
    include: { photo: { include: PHOTO_INCLUDE } },
  });
  return links.map((link) => toPhotoResponse(link.photo, authContext));
}

async function toPhotoLogResponse(photoLog: { id: string; time: Date; babyId: string; caretakerId: string | null; familyId: string | null; createdAt: Date; updatedAt: Date; deletedAt: Date | null }, authContext: AuthResult): Promise<PhotoLogResponse> {
  return {
    id: photoLog.id,
    time: formatForResponse(photoLog.time) || '',
    babyId: photoLog.babyId,
    caretakerId: photoLog.caretakerId,
    familyId: photoLog.familyId,
    createdAt: formatForResponse(photoLog.createdAt) || '',
    updatedAt: formatForResponse(photoLog.updatedAt) || '',
    deletedAt: formatForResponse(photoLog.deletedAt),
    photos: await getLinkedPhotos(photoLog.id, authContext),
  };
}

/** Validate photo ids: must exist in this family and not be trashed. */
async function validatePhotoIds(photoIds: string[], familyId: string): Promise<string | null> {
  if (!Array.isArray(photoIds) || photoIds.length === 0) return 'At least one photo is required';
  if (photoIds.length > MAX_PHOTOS_PER_ACTIVITY) return `A maximum of ${MAX_PHOTOS_PER_ACTIVITY} photos can be attached`;
  const count = await prisma.photo.count({ where: { id: { in: photoIds }, familyId, deletedAt: null } });
  if (count !== new Set(photoIds).size) return 'One or more photos were not found';
  return null;
}

async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const body: PhotoLogCreate = await req.json();
    const { familyId, caretakerId } = authContext;

    const baby = await prisma.baby.findFirst({ where: { id: body.babyId, familyId } });
    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }

    const photoError = await validatePhotoIds(body.photoIds, familyId!);
    if (photoError) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: photoError }, { status: 400 });
    }

    const photoLog = await prisma.photoLog.create({
      data: { babyId: body.babyId, time: toUTC(body.time), caretakerId, familyId },
    });
    await prisma.photoLink.createMany({
      data: body.photoIds.map((photoId) => ({ photoId, activityType: 'photo', activityId: photoLog.id })),
    });

    return NextResponse.json<ApiResponse<PhotoLogResponse>>({
      success: true,
      data: await toPhotoLogResponse(photoLog, authContext),
    });
  } catch (error) {
    console.error('Error creating photo log:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to create photo log' }, { status: 500 });
  }
}

async function handleGet(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const { familyId } = authContext;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log ID is required' }, { status: 400 });
    }
    const photoLog = await prisma.photoLog.findFirst({ where: { id, familyId, deletedAt: null } });
    if (!photoLog) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log not found' }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<PhotoLogResponse>>({
      success: true,
      data: await toPhotoLogResponse(photoLog, authContext),
    });
  } catch (error) {
    console.error('Error fetching photo log:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to fetch photo log' }, { status: 500 });
  }
}

async function handlePut(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body: Partial<PhotoLogCreate> = await req.json();
    const { familyId } = authContext;

    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log ID is required' }, { status: 400 });
    }
    const existing = await prisma.photoLog.findFirst({ where: { id, familyId, deletedAt: null } });
    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log not found' }, { status: 404 });
    }

    if (body.photoIds) {
      const photoError = await validatePhotoIds(body.photoIds, familyId!);
      if (photoError) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: photoError }, { status: 400 });
      }
      // Replace the linked photo set
      await prisma.photoLink.deleteMany({ where: { activityType: 'photo', activityId: id } });
      await prisma.photoLink.createMany({
        data: body.photoIds.map((photoId) => ({ photoId, activityType: 'photo', activityId: id })),
      });
    }

    const photoLog = await prisma.photoLog.update({
      where: { id },
      data: { ...(body.time && { time: toUTC(body.time) }) },
    });

    return NextResponse.json<ApiResponse<PhotoLogResponse>>({
      success: true,
      data: await toPhotoLogResponse(photoLog, authContext),
    });
  } catch (error) {
    console.error('Error updating photo log:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to update photo log' }, { status: 500 });
  }
}

async function handleDelete(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log ID is required' }, { status: 400 });
    }
    const existing = await prisma.photoLog.findFirst({ where: { id, familyId: authContext.familyId } });
    if (!existing) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo log not found' }, { status: 404 });
    }

    // Soft-delete the record; remove links. Photos stay in the library (spec section 3).
    await prisma.photoLog.update({ where: { id }, data: { deletedAt: new Date() } });
    await prisma.photoLink.deleteMany({ where: { activityType: 'photo', activityId: id } });

    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Error deleting photo log:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to delete photo log' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
export const GET = withAuthContext(handleGet as any);
export const PUT = withAuthContext(handlePut as any);
export const DELETE = withAuthContext(handleDelete as any);
