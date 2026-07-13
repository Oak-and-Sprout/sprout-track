/**
 * Pure helpers for the Photos feature: upload validation, quota math,
 * takenAt resolution, trash lifecycle, and thumbnail overflow.
 * Server routes and client components share these constants.
 */

export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
];

export const MAX_PHOTO_FILE_SIZE = 10 * 1024 * 1024; // 10MB pre-compression
export const MAX_PHOTOS_PER_BATCH = 4;
export const MAX_PHOTOS_PER_ACTIVITY = 4;
export const TRASH_RETENTION_DAYS = 30;
export const PHOTO_DISPLAY_MAX_DIMENSION = 1600;
export const PHOTO_THUMBNAIL_DIMENSION = 300;

export function validatePhotoFile(input: { mimeType: string; fileSize: number }): { valid: boolean; error?: string } {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(input.mimeType.toLowerCase())) {
    return { valid: false, error: 'Only image files are allowed (JPEG, PNG, HEIC, WebP, GIF)' };
  }
  if (input.fileSize > MAX_PHOTO_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }
  return { valid: true };
}

export function mbToBytes(mb: number): number {
  return mb * 1024 * 1024;
}

export function getEffectiveQuotaMb(familyQuotaMb: number | null | undefined, defaultQuotaMb: number): number {
  return familyQuotaMb ?? defaultQuotaMb;
}

export function isOverQuota(usedBytes: number, incomingBytes: number, quotaBytes: number): boolean {
  return usedBytes + incomingBytes > quotaBytes;
}

export function resolveTakenAt(
  userTakenAt: string | null | undefined,
  exifTakenAt: Date | null,
  fallback: Date
): Date {
  if (userTakenAt) {
    const parsed = new Date(userTakenAt);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  if (exifTakenAt && !isNaN(exifTakenAt.getTime())) return exifTakenAt;
  return fallback;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isPurgeEligible(deletedAt: Date | string | null, now: Date): boolean {
  if (!deletedAt) return false;
  const deleted = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt;
  return now.getTime() - deleted.getTime() >= TRASH_RETENTION_DAYS * MS_PER_DAY;
}

export function trashDaysRemaining(deletedAt: Date | string, now: Date): number {
  const deleted = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt;
  const elapsedDays = (now.getTime() - deleted.getTime()) / MS_PER_DAY;
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
}

export function getVisibleThumbnails<T>(photos: T[], maxVisible: number): { visible: T[]; overflow: number } {
  const visible = photos.slice(0, maxVisible);
  return { visible, overflow: photos.length - visible.length };
}

/**
 * Counts distinct photo ids across a list of items that may each carry a
 * batch of photos (e.g. a day's timeline activities, where both standalone
 * photo-log entries and other activity types with attached photos should
 * only count each underlying photo once).
 */
export function countUniquePhotoIds(items: { photos?: { id: string }[] | undefined }[]): number {
  const ids = new Set<string>();
  items.forEach((item) => item.photos?.forEach((photo) => ids.add(photo.id)));
  return ids.size;
}

export function formatQuotaLabel(usedBytes: number, totalBytes: number): { usedGb: string; totalGb: string; percent: number } {
  const gb = 1024 * 1024 * 1024;
  const fmt = (n: number) => {
    const v = n / gb;
    return (Math.round(v * 10) / 10).toString();
  };
  const percent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
  return { usedGb: fmt(usedBytes), totalGb: fmt(totalBytes), percent };
}
