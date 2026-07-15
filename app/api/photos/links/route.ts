import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, PhotoLinkInfo } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { checkWritePermission } from '../../utils/writeProtection';
import { isPhotosEnabled, photosDisabledResponse } from '../photo-service';
import { MAX_PHOTOS_PER_ACTIVITY } from '@/src/utils/photoUtils';

const LINKABLE_TYPES = ['photo', 'feed', 'milestone', 'bath', 'play', 'measurement', 'foodLog'] as const;
type LinkableType = (typeof LINKABLE_TYPES)[number];

/** Verify the target activity exists in this family. */
async function findActivity(activityType: LinkableType, activityId: string, familyId: string) {
  switch (activityType) {
    case 'photo':
      return prisma.photoLog.findFirst({ where: { id: activityId, familyId } });
    case 'feed':
      return prisma.feedLog.findFirst({ where: { id: activityId, familyId } });
    case 'milestone':
      return prisma.milestone.findFirst({ where: { id: activityId, familyId } });
    case 'bath':
      return prisma.bathLog.findFirst({ where: { id: activityId, familyId } });
    case 'play':
      return prisma.playLog.findFirst({ where: { id: activityId, familyId } });
    case 'measurement':
      return prisma.measurement.findFirst({ where: { id: activityId, familyId } });
    case 'foodLog':
      return prisma.foodLog.findFirst({ where: { id: activityId, familyId } });
  }
}

/**
 * POST /api/photos/links — attach a photo to an activity (max 4 per activity).
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId } = authContext;
    const body: { photoId: string; activityType: string; activityId: string } = await req.json();

    if (!body.photoId || !body.activityType || !body.activityId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'photoId, activityType and activityId are required' }, { status: 400 });
    }
    if (!LINKABLE_TYPES.includes(body.activityType as LinkableType)) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Invalid activity type' }, { status: 400 });
    }

    const photo = await prisma.photo.findFirst({ where: { id: body.photoId, familyId, deletedAt: null } });
    if (!photo) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }
    const activity = await findActivity(body.activityType as LinkableType, body.activityId, familyId!);
    if (!activity) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Activity not found in this family.' }, { status: 404 });
    }

    const existingCount = await prisma.photoLink.count({
      where: { activityType: body.activityType, activityId: body.activityId },
    });
    if (existingCount >= MAX_PHOTOS_PER_ACTIVITY) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `A maximum of ${MAX_PHOTOS_PER_ACTIVITY} photos can be attached to an activity` },
        { status: 400 }
      );
    }

    const duplicate = await prisma.photoLink.findFirst({
      where: { photoId: body.photoId, activityType: body.activityType, activityId: body.activityId },
    });
    if (!duplicate) {
      try {
        await prisma.photoLink.create({
          data: { photoId: body.photoId, activityType: body.activityType, activityId: body.activityId },
        });
      } catch (error: any) {
        // Unique-violation race with a concurrent identical request — duplicate links are tolerated
        if (error?.code !== 'P2002') throw error;
      }
    }

    const data: PhotoLinkInfo = { activityType: body.activityType, activityId: body.activityId };
    return NextResponse.json<ApiResponse<PhotoLinkInfo>>({ success: true, data });
  } catch (error) {
    console.error('Error linking photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to attach photo' }, { status: 500 });
  }
}

/**
 * DELETE /api/photos/links?photoId=&activityType=&activityId= — detach.
 */
async function handleDelete(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { searchParams } = new URL(req.url);
    const photoId = searchParams.get('photoId');
    const activityType = searchParams.get('activityType');
    const activityId = searchParams.get('activityId');

    if (!photoId || !activityType || !activityId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'photoId, activityType and activityId are required' }, { status: 400 });
    }

    // Family scoping: the photo must belong to this family
    const photo = await prisma.photo.findFirst({ where: { id: photoId, familyId: authContext.familyId } });
    if (!photo) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Photo not found' }, { status: 404 });
    }

    await prisma.photoLink.deleteMany({ where: { photoId, activityType, activityId } });
    return NextResponse.json<ApiResponse<null>>({ success: true });
  } catch (error) {
    console.error('Error unlinking photo:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to detach photo' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
export const DELETE = withAuthContext(handleDelete as any);
