import { describe, it, expect, vi } from 'vitest';
import { sniffImageFormat, normalizeImage, UnsupportedImageError, jpegFileName } from '@/src/utils/imageFormat';

const ftyp = (brand: string) => new Uint8Array([0, 0, 0, 0x18, ...Buffer.from('ftyp'), ...Buffer.from(brand), 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const WEBP = new Uint8Array(Buffer.from('RIFF\0\0\0\0WEBPVP8 '));
const GIF = new Uint8Array(Buffer.from('GIF89a\0\0\0\0\0\0'));

describe('sniffImageFormat', () => {
  it('recognises the formats the server accepts', () => {
    expect(sniffImageFormat(JPEG)).toBe('jpeg');
    expect(sniffImageFormat(PNG)).toBe('png');
    expect(sniffImageFormat(WEBP)).toBe('webp');
    expect(sniffImageFormat(GIF)).toBe('gif');
  });
  it('separates heic from avif by ftyp brand', () => {
    for (const b of ['heic', 'heix', 'hevc', 'mif1', 'msf1']) expect(sniffImageFormat(ftyp(b))).toBe('heic');
    for (const b of ['avif', 'avis']) expect(sniffImageFormat(ftyp(b))).toBe('avif');
  });
  it('treats an unknown ftyp brand as heic (still an ISOBMFF image container)', () => {
    expect(sniffImageFormat(ftyp('zzzz'))).toBe('heic');
  });
  it('returns unknown for non-images and short input', () => {
    expect(sniffImageFormat(new Uint8Array(Buffer.from('%PDF-1.4\n\n\n\n')))).toBe('unknown');
    expect(sniffImageFormat(new Uint8Array(Buffer.from('RIFF\0\0\0\0WAVEfmt ')))).toBe('unknown');
    expect(sniffImageFormat(new Uint8Array(0))).toBe('unknown');
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8]))).toBe('unknown');
  });
});

describe('jpegFileName', () => {
  it('swaps the extension and handles names without one', () => {
    expect(jpegFileName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
    expect(jpegFileName('photo.avif')).toBe('photo.jpg');
    expect(jpegFileName('photo')).toBe('photo.jpg');
    expect(jpegFileName('.heic')).toBe('.heic.jpg');
  });
});

describe('normalizeImage', () => {
  const file = (bytes: Uint8Array<ArrayBuffer>, name: string, type: string) => new File([bytes], name, { type });
  const jpegBlob = new Blob([JPEG], { type: 'image/jpeg' });
  const deps = (over: Partial<Parameters<typeof normalizeImage>[1]> = {}) => ({
    nativeToJpeg: vi.fn().mockResolvedValue(jpegBlob),
    heicToJpeg: vi.fn().mockResolvedValue(jpegBlob),
    ...over,
  });

  it('passes accepted formats through untouched', async () => {
    const f = file(PNG, 'a.png', 'image/png');
    const d = deps();
    await expect(normalizeImage(f, d)).resolves.toBe(f);
    expect(d.nativeToJpeg).not.toHaveBeenCalled();
  });
  it('corrects a blank or wrong declared type on an accepted format', async () => {
    const out = await normalizeImage(file(JPEG, 'a.jpg', ''), deps());
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('a.jpg');
    expect((await normalizeImage(file(WEBP, 'a.webp', 'application/octet-stream'), deps())).type).toBe('image/webp');
  });
  it('converts heic with the native decoder when it works', async () => {
    const d = deps();
    const out = await normalizeImage(file(ftyp('heic'), 'IMG_1.HEIC', 'image/heic'), d);
    expect(out.name).toBe('IMG_1.jpg');
    expect(out.type).toBe('image/jpeg');
    expect(d.nativeToJpeg).toHaveBeenCalledTimes(1);
    expect(d.heicToJpeg).not.toHaveBeenCalled();
  });
  it('falls back to the wasm decoder for heic when native decode fails', async () => {
    const d = deps({ nativeToJpeg: vi.fn().mockRejectedValue(new Error('cannot decode')) });
    const out = await normalizeImage(file(ftyp('heic'), 'IMG_1.heic', 'image/heic'), d);
    expect(out.type).toBe('image/jpeg');
    expect(d.heicToJpeg).toHaveBeenCalledTimes(1);
  });
  it('converts avif natively and does not use the heic wasm decoder for it', async () => {
    const d = deps({ nativeToJpeg: vi.fn().mockRejectedValue(new Error('cannot decode')) });
    await expect(normalizeImage(file(ftyp('avif'), 'a.avif', 'image/avif'), d)).rejects.toBeInstanceOf(UnsupportedImageError);
    expect(d.heicToJpeg).not.toHaveBeenCalled();
    const ok = deps();
    expect((await normalizeImage(file(ftyp('avif'), 'a.avif', 'image/avif'), ok)).type).toBe('image/jpeg');
  });
  it('rejects files that are not images regardless of declared type', async () => {
    const d = deps();
    await expect(normalizeImage(file(new Uint8Array(Buffer.from('%PDF-1.4\n\n\n\n')), 'x.jpg', 'image/jpeg'), d)).rejects.toBeInstanceOf(UnsupportedImageError);
    await expect(normalizeImage(file(new Uint8Array(0), 'empty.jpg', 'image/jpeg'), d)).rejects.toBeInstanceOf(UnsupportedImageError);
    expect(d.nativeToJpeg).not.toHaveBeenCalled();
  });
  it('surfaces a decoder that returns an empty blob as unsupported', async () => {
    const d = deps({ nativeToJpeg: vi.fn().mockResolvedValue(new Blob([])), heicToJpeg: vi.fn().mockResolvedValue(new Blob([])) });
    await expect(normalizeImage(file(ftyp('heic'), 'a.heic', 'image/heic'), d)).rejects.toBeInstanceOf(UnsupportedImageError);
  });
});
