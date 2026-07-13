import { NextResponse } from 'next/server';
import prisma from '../db';
import { ApiResponse } from '../types';
import { deleteEncryptedFile } from '@/src/lib/file-encryption';
import { getEffectiveQuotaMb, mbToBytes, isPurgeEligible, TRASH_RETENTION_DAYS } from '@/src/utils/photoUtils';

export function photoSubdir(familyId: string): string {
  return `photos/${familyId}`;
}

export async function isPhotosEnabled(): Promise<boolean> {
  const config = await prisma.appConfig.findFirst({ select: { enablePhotos: true } });
  return config?.enablePhotos ?? false;
}

export function photosDisabledResponse(): NextResponse {
  return NextResponse.json<ApiResponse<null>>(
    { success: false, error: 'Photos feature is not enabled' },
    { status: 403 }
  );
}

/**
 * Family quota usage. Trashed photos still occupy disk, so they count
 * toward usage until purged (spec section 4).
 */
export async function getQuotaInfo(familyId: string): Promise<{ usedBytes: number; totalBytes: number }> {
  const [aggregate, settings, appConfig] = await Promise.all([
    prisma.photo.aggregate({
      where: { familyId },
      _sum: { fileSize: true, thumbSize: true },
    }),
    prisma.settings.findFirst({ where: { familyId }, select: { photoQuotaMB: true } }),
    prisma.appConfig.findFirst({ select: { defaultPhotoQuotaMB: true } }),
  ]);
  const usedBytes = (aggregate._sum.fileSize || 0) + (aggregate._sum.thumbSize || 0);
  const quotaMb = getEffectiveQuotaMb(settings?.photoQuotaMB, appConfig?.defaultPhotoQuotaMB ?? 5120);
  return { usedBytes, totalBytes: mbToBytes(quotaMb) };
}

/**
 * Hard-delete photos: encrypted files first (tolerant of missing files),
 * then rows. Links and favorites cascade via the schema.
 */
export async function purgePhotosPermanently(photoIds: string[], familyId: string): Promise<number> {
  if (photoIds.length === 0) return 0;
  const photos = await prisma.photo.findMany({
    where: { id: { in: photoIds }, familyId },
    select: { id: true, storedName: true, thumbStoredName: true },
  });
  for (const photo of photos) {
    try {
      deleteEncryptedFile(photo.storedName, photoSubdir(familyId));
      deleteEncryptedFile(photo.thumbStoredName, photoSubdir(familyId));
    } catch (error) {
      console.error(`Failed to delete photo files for ${photo.id}:`, error);
    }
  }
  const result = await prisma.photo.deleteMany({ where: { id: { in: photos.map((p) => p.id) } } });
  return result.count;
}

/**
 * Lazy trash purge: called from photo list/upload routes. Removes photos
 * whose deletedAt is older than TRASH_RETENTION_DAYS.
 */
export async function purgeExpiredPhotos(familyId: string): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const expired = await prisma.photo.findMany({
    where: { familyId, deletedAt: { not: null, lt: cutoff } },
    select: { id: true, deletedAt: true },
  });
  const eligibleIds = expired.filter((p) => isPurgeEligible(p.deletedAt, new Date())).map((p) => p.id);
  return purgePhotosPermanently(eligibleIds, familyId);
}
