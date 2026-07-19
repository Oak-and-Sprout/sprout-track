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

export const MILESTONE_TAG_WINDOW_DAYS = 10;

/**
 * Milestones eligible for tagging on a photo: dated within ±windowDays of
 * `now`. The already-selected milestone (edit mode) is always included so
 * an older tag stays visible and isn't silently dropped by the window.
 */
export function filterTaggableMilestones<T extends { id: string; date: string | Date }>(
  milestones: T[],
  now: Date,
  selectedId?: string,
  windowDays: number = MILESTONE_TAG_WINDOW_DAYS
): T[] {
  const windowMs = windowDays * MS_PER_DAY;
  return milestones.filter((milestone) => {
    if (selectedId && milestone.id === selectedId) return true;
    const time = new Date(milestone.date).getTime();
    return !Number.isNaN(time) && Math.abs(time - now.getTime()) <= windowMs;
  });
}

export type CameraStrategy = 'native-capture' | 'webcam-modal' | 'library-only';

export interface CameraCapabilityFlags {
  coarsePointer: boolean; // matchMedia('(pointer: coarse)').matches
  maxTouchPoints: number; // navigator.maxTouchPoints
  hasMediaDevices: boolean; // !!navigator.mediaDevices?.getUserMedia
}

/**
 * Touch-first devices (phones, iPads — including iPadOS "desktop-class"
 * Safari, which still reports a coarse primary pointer) get the native
 * camera intent via the file input's capture attribute; it needs no
 * getUserMedia support. Fine-pointer devices with getUserMedia get the
 * in-app webcam modal. Anything else falls back to the library picker.
 */
export function decideCameraStrategy(flags: CameraCapabilityFlags): CameraStrategy {
  if (flags.coarsePointer && flags.maxTouchPoints > 0) return 'native-capture';
  if (flags.hasMediaDevices) return 'webcam-modal';
  return 'library-only';
}

export const CAPTURE_MIME = 'image/jpeg';
export const CAPTURE_JPEG_QUALITY = 0.9;

/** e.g. capture-2026-07-19-14-30-25.jpg (local time, zero-padded). */
export function capturedPhotoFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const parts = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate()), pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())];
  return `capture-${parts.join('-')}.jpg`;
}

export type CameraErrorKind = 'permission-denied' | 'no-camera' | 'unknown';

/** Maps getUserMedia DOMException names to UI error states. */
export function mapGetUserMediaError(errorName: string | undefined): CameraErrorKind {
  switch (errorName) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'permission-denied';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no-camera';
    default:
      return 'unknown';
  }
}

export type CameraFacingMode = 'user' | 'environment';

export function nextFacingMode(current: CameraFacingMode): CameraFacingMode {
  return current === 'user' ? 'environment' : 'user';
}

/**
 * De-duplicates file names for a zip archive: later duplicates get a
 * " (2)", " (3)", … suffix before the extension. Suffixed names are checked
 * against the whole result so they can't collide with a name that already
 * exists in the input.
 */
export function uniqueFileNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let counter = 2;
    let candidate = `${base} (${counter})${ext}`;
    while (used.has(candidate)) {
      counter += 1;
      candidate = `${base} (${counter})${ext}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/** e.g. photos-2026-07-19.zip (local date). */
export function photosZipFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `photos-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.zip`;
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
