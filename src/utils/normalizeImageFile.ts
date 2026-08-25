/**
 * Browser entry point for imageFormat.normalizeImage: native decode via
 * createImageBitmap + canvas, with a lazily loaded wasm libheif fallback for
 * browsers that can't decode HEIC themselves (Chrome, Firefox, Android).
 * The wasm runs sandboxed in the user's browser, so the libheif CVE that keeps
 * HEIC off the server does not apply here.
 */
import { normalizeImage, UnsupportedImageError } from './imageFormat';

const JPEG_QUALITY = 0.92;

async function nativeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UnsupportedImageError('Canvas is unavailable');
    ctx.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new UnsupportedImageError('Image could not be encoded'))), 'image/jpeg', JPEG_QUALITY)
    );
  } finally {
    bitmap.close();
  }
}

async function heicToJpeg(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to/next');
  return heicTo({ blob: file, type: 'image/jpeg', quality: JPEG_QUALITY });
}

/** Convert a picked file into something /api/photos/upload and /api/feedback/upload accept. */
export function normalizeImageFile(file: File): Promise<File> {
  return normalizeImage(file, { nativeToJpeg, heicToJpeg });
}
