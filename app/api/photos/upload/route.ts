import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse, PhotoUploadResult, PhotoResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { toUTC } from '../../utils/timezone';
import { checkWritePermission } from '../../utils/writeProtection';
import { encryptAndStore, generateStoredName, deleteEncryptedFile } from '@/src/lib/file-encryption';
import { processPhoto } from '../photo-processing';
import {
  isPhotosEnabled,
  photosDisabledResponse,
  photoSubdir,
  getQuotaInfo,
  purgeExpiredPhotos,
  toPhotoResponse,
  PHOTO_INCLUDE,
} from '../photo-service';
import { validatePhotoFile, isOverQuota, resolveTakenAt, MAX_PHOTOS_PER_BATCH } from '@/src/utils/photoUtils';

/**
 * POST /api/photos/upload
 * Multipart form: files (1-4 image files), babyId, optional takenAt/caption/milestoneId.
 * Per-file results: a failed file never blocks the rest (spec section 7).
 */
async function handlePost(req: NextRequest, authContext: AuthResult) {
  if (!(await isPhotosEnabled())) return photosDisabledResponse();
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response!;

  try {
    const { familyId, caretakerId } = authContext;
    const formData = await req.formData();
    const files = formData.getAll('files').filter((f): f is File => f instanceof File);
    const babyId = formData.get('babyId') as string;
    const takenAtRaw = (formData.get('takenAt') as string) || null;
    const caption = ((formData.get('caption') as string) || '').trim() || null;
    const milestoneId = ((formData.get('milestoneId') as string) || '').trim() || null;

    if (!babyId) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby ID is required' }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'At least one file is required' }, { status: 400 });
    }
    if (files.length > MAX_PHOTOS_PER_BATCH) {
      return NextResponse.json<ApiResponse<null>>(
        { success: false, error: `A maximum of ${MAX_PHOTOS_PER_BATCH} photos can be uploaded at once` },
        { status: 400 }
      );
    }

    const baby = await prisma.baby.findFirst({ where: { id: babyId, familyId } });
    if (!baby) {
      return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Baby not found in this family.' }, { status: 404 });
    }
    if (milestoneId) {
      const milestone = await prisma.milestone.findFirst({ where: { id: milestoneId, familyId } });
      if (!milestone) {
        return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Milestone not found in this family.' }, { status: 404 });
      }
    }

    // Free expired trash space before checking quota
    await purgeExpiredPhotos(familyId!);
    const quota = await getQuotaInfo(familyId!);
    let runningUsed = quota.usedBytes;

    const photos: PhotoResponse[] = [];
    const errors: { fileName: string; error: string }[] = [];

    for (const file of files) {
      const validation = validatePhotoFile({ mimeType: file.type, fileSize: file.size });
      if (!validation.valid) {
        errors.push({ fileName: file.name, error: validation.error! });
        continue;
      }
      let storedName: string | undefined;
      let thumbStoredName: string | undefined;
      try {
        const rawBuffer = Buffer.from(await file.arrayBuffer());
        const processed = await processPhoto(rawBuffer, file.type.toLowerCase());
        const incomingBytes = processed.display.data.length + processed.thumbnail.data.length;
        if (isOverQuota(runningUsed, incomingBytes, quota.totalBytes)) {
          errors.push({ fileName: file.name, error: 'Photo storage quota exceeded' });
          continue;
        }

        storedName = generateStoredName();
        thumbStoredName = generateStoredName();
        encryptAndStore(processed.display.data, storedName, photoSubdir(familyId!));
        encryptAndStore(processed.thumbnail.data, thumbStoredName, photoSubdir(familyId!));

        const takenAt = takenAtRaw
          ? toUTC(takenAtRaw)
          : resolveTakenAt(null, processed.exifTakenAt, new Date());

        const photo = await prisma.$transaction(async (tx) => {
          const created = await tx.photo.create({
            data: {
              originalName: file.name,
              storedName: storedName!,
              thumbStoredName: thumbStoredName!,
              mimeType: processed.display.mimeType,
              fileSize: processed.display.data.length,
              thumbSize: processed.thumbnail.data.length,
              takenAt,
              caption,
              babyId,
              caretakerId,
              milestoneId,
              familyId,
            },
            include: PHOTO_INCLUDE,
          });

          // Auto-link milestone-tagged photos to the milestone entry (spec section 3)
          if (milestoneId) {
            await tx.photoLink.create({
              data: { photoId: created.id, activityType: 'milestone', activityId: milestoneId },
            });
            created.links.push({ activityType: 'milestone', activityId: milestoneId });
          }

          return created;
        });

        runningUsed += incomingBytes;
        photos.push(toPhotoResponse(photo, authContext));
      } catch (error) {
        console.error(`Error processing photo ${file.name}:`, error);
        if (storedName) {
          try {
            deleteEncryptedFile(storedName, photoSubdir(familyId!));
          } catch (cleanupError) {
            console.error(`Failed to clean up orphaned file ${storedName}:`, cleanupError);
          }
        }
        if (thumbStoredName) {
          try {
            deleteEncryptedFile(thumbStoredName, photoSubdir(familyId!));
          } catch (cleanupError) {
            console.error(`Failed to clean up orphaned thumbnail ${thumbStoredName}:`, cleanupError);
          }
        }
        errors.push({ fileName: file.name, error: 'Failed to process photo' });
      }
    }

    const finalQuota = await getQuotaInfo(familyId!);
    return NextResponse.json<ApiResponse<PhotoUploadResult>>({
      success: true,
      data: { photos, errors, quota: finalQuota },
    });
  } catch (error) {
    console.error('Error uploading photos:', error);
    return NextResponse.json<ApiResponse<null>>({ success: false, error: 'Failed to upload photos' }, { status: 500 });
  }
}

export const POST = withAuthContext(handlePost as any);
