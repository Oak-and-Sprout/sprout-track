/**
 * Pure helpers for normalizing picked image files before upload.
 *
 * The server never decodes HEIC/HEIF/AVIF (libheif has had RCE-class bugs;
 * see isHeifContainer in photoUtils). Instead the browser converts them to
 * JPEG here, so the server only ever receives JPEG/PNG/WebP/GIF. Decoders are
 * injected so this module stays node-testable; the browser entry point is
 * normalizeImageFile.ts.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'heic' | 'avif' | 'unknown';

/** Bytes needed to classify any supported format. */
export const SNIFF_BYTES = 16;

const PASS_THROUGH_MIME: Record<'jpeg' | 'png' | 'webp' | 'gif', string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

const AVIF_BRANDS = ['avif', 'avis'];

const ascii = (bytes: Uint8Array, start: number, length: number) =>
  String.fromCharCode(...bytes.subarray(start, start + length));

export function sniffImageFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length < 12) return 'unknown';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && ascii(bytes, 1, 3) === 'PNG') return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 3) === 'GIF') return 'gif';
  if (ascii(bytes, 4, 4) === 'ftyp') {
    // Any ISOBMFF image is decoded by libheif; only the brand tells AVIF apart.
    return AVIF_BRANDS.includes(ascii(bytes, 8, 4)) ? 'avif' : 'heic';
  }
  return 'unknown';
}

export function jpegFileName(name: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.jpg`;
}

export class UnsupportedImageError extends Error {
  constructor(message = 'File is not a supported image') {
    super(message);
    this.name = 'UnsupportedImageError';
  }
}

export interface ImageDecoders {
  /** Decode with the browser's own codecs (Safari: HEIC+AVIF, Chrome/Firefox: AVIF). */
  nativeToJpeg: (file: File) => Promise<Blob>;
  /** Wasm libheif fallback for browsers without native HEIC support. */
  heicToJpeg: (file: File) => Promise<Blob>;
}

async function readHead(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
}

/**
 * Returns a File the upload routes accept: the original for JPEG/PNG/WebP/GIF
 * (with its MIME type corrected if the picker got it wrong), a JPEG conversion
 * for HEIC/AVIF, or throws UnsupportedImageError.
 */
export async function normalizeImage(file: File, decoders: ImageDecoders): Promise<File> {
  const format = sniffImageFormat(await readHead(file));
  if (format === 'unknown') throw new UnsupportedImageError();

  if (format !== 'heic' && format !== 'avif') {
    const mime = PASS_THROUGH_MIME[format];
    return file.type === mime ? file : new File([file], file.name, { type: mime, lastModified: file.lastModified });
  }

  let blob: Blob;
  try {
    blob = await decoders.nativeToJpeg(file);
  } catch (nativeError) {
    if (format !== 'heic') throw new UnsupportedImageError('This browser cannot decode AVIF images');
    blob = await decoders.heicToJpeg(file);
  }
  if (!blob || blob.size === 0) throw new UnsupportedImageError('Image could not be converted');
  return new File([blob], jpegFileName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
}
