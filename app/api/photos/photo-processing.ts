import sharp from 'sharp';
import exifReader from 'exif-reader';
import { PHOTO_DISPLAY_MAX_DIMENSION, PHOTO_THUMBNAIL_DIMENSION } from '@/src/utils/photoUtils';

export interface ProcessedPhoto {
  display: { data: Buffer; mimeType: string };
  thumbnail: { data: Buffer; mimeType: string };
  exifTakenAt: Date | null;
}

/**
 * Extract EXIF DateTimeOriginal (falling back to DateTime) from already-read
 * sharp metadata of the ORIGINAL buffer, before any transformation strips
 * metadata. Returns null when absent or unparsable.
 *
 * exif-reader v2.0.3 (installed) groups tags under `Photo` / `Image` keys
 * (not the older `exif` / `image` lowercase grouping) and types datetime
 * tags as `Date` objects already, not strings. The `instanceof Date` /
 * `new Date(value)` fallback below tolerates either shape in case the
 * installed version changes.
 */
function extractExifTakenAt(metadata: sharp.Metadata): Date | null {
  try {
    if (!metadata.exif) return null;
    const tags = exifReader(metadata.exif);
    const value = tags?.Photo?.DateTimeOriginal || tags?.Image?.DateTime;
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Produce the encrypted-at-rest artifacts for one uploaded photo:
 * - display image: auto-rotated, resized to <=1600px, HEIC converted to JPEG
 * - thumbnail: 300px JPEG
 * Originals are NOT retained (see spec section 4).
 */
export async function processPhoto(buffer: Buffer, mimeType: string): Promise<ProcessedPhoto> {
  // Decode the buffer once; metadata() and each clone() reuse this single
  // decode instead of re-parsing the source buffer per output.
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const exifTakenAt = extractExifTakenAt(metadata);
  const normalizedMime = mimeType.toLowerCase();

  // rotate() applies EXIF orientation; resize keeps aspect, never enlarges
  const base = () =>
    image.clone().rotate().resize(PHOTO_DISPLAY_MAX_DIMENSION, PHOTO_DISPLAY_MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    });

  let display: { data: Buffer; mimeType: string };
  if (normalizedMime === 'image/png') {
    display = { data: await base().png({ quality: 80, compressionLevel: 8 }).toBuffer(), mimeType: 'image/png' };
  } else if (normalizedMime === 'image/webp') {
    display = { data: await base().webp({ quality: 80 }).toBuffer(), mimeType: 'image/webp' };
  } else if (normalizedMime === 'image/gif') {
    // Preserve animation; no resize (sharp flattens animated gifs by default)
    display = { data: buffer, mimeType: 'image/gif' };
  } else {
    // jpeg/jpg/heic/heif and anything else -> JPEG
    display = { data: await base().jpeg({ quality: 80 }).toBuffer(), mimeType: 'image/jpeg' };
  }

  const thumbnailData = await image
    .clone()
    .rotate()
    .resize(PHOTO_THUMBNAIL_DIMENSION, PHOTO_THUMBNAIL_DIMENSION, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 70 })
    .toBuffer();

  return { display, thumbnail: { data: thumbnailData, mimeType: 'image/jpeg' }, exifTakenAt };
}
