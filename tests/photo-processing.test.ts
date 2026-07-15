import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { processPhoto } from '@/app/api/photos/photo-processing';

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 80 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe('processPhoto', () => {
  it('downscales a large jpeg to max 1600px and produces a 300px thumbnail', async () => {
    const input = await makeJpeg(3200, 2400);
    const result = await processPhoto(input, 'image/jpeg');
    const displayMeta = await sharp(result.display.data).metadata();
    expect(Math.max(displayMeta.width!, displayMeta.height!)).toBeLessThanOrEqual(1600);
    expect(result.display.mimeType).toBe('image/jpeg');
    const thumbMeta = await sharp(result.thumbnail.data).metadata();
    expect(Math.max(thumbMeta.width!, thumbMeta.height!)).toBeLessThanOrEqual(300);
    expect(result.thumbnail.mimeType).toBe('image/jpeg');
  });

  it('does not enlarge small images', async () => {
    const input = await makeJpeg(400, 300);
    const result = await processPhoto(input, 'image/jpeg');
    const meta = await sharp(result.display.data).metadata();
    expect(meta.width).toBe(400);
  });

  it('keeps png as png for display', async () => {
    const input = await sharp({ create: { width: 500, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } })
      .png()
      .toBuffer();
    const result = await processPhoto(input, 'image/png');
    expect(result.display.mimeType).toBe('image/png');
  });

  it('returns null exifTakenAt when no EXIF present', async () => {
    const input = await makeJpeg(100, 100);
    const result = await processPhoto(input, 'image/jpeg');
    expect(result.exifTakenAt).toBeNull();
  });

  it('extracts EXIF DateTimeOriginal when present', async () => {
    const withExif = await sharp(await makeJpeg(100, 100))
      .withExif({ IFD0: { DateTime: '2026:07:01 10:30:00' }, IFD2: { DateTimeOriginal: '2026:07:01 10:30:00' } })
      .toBuffer();
    const result = await processPhoto(withExif, 'image/jpeg');
    expect(result.exifTakenAt).not.toBeNull();
    expect(result.exifTakenAt!.getUTCFullYear()).toBe(2026);
    expect(result.exifTakenAt!.getUTCMonth()).toBe(6); // July
  });

  it('keeps webp as webp for display', async () => {
    const input = await sharp({ create: { width: 500, height: 500, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } })
      .webp()
      .toBuffer();
    const result = await processPhoto(input, 'image/webp');
    expect(result.display.mimeType).toBe('image/webp');
    const thumbMeta = await sharp(result.thumbnail.data).metadata();
    expect(thumbMeta.format).toBe('jpeg');
    expect(Math.max(thumbMeta.width!, thumbMeta.height!)).toBeLessThanOrEqual(300);
    expect(result.thumbnail.mimeType).toBe('image/jpeg');
  });

  it('passes gif through unresized for display and produces a jpeg thumbnail', async () => {
    let input: Buffer;
    try {
      input = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 5, g: 6, b: 7 } } })
        .gif()
        .toBuffer();
    } catch {
      // Fallback: minimal hand-crafted 1x1 GIF87a if the installed sharp can't encode gif.
      input = Buffer.from([
        0x47, 0x49, 0x46, 0x38, 0x37, 0x61, // GIF87a
        0x01, 0x00, 0x01, 0x00, // 1x1
        0x80, 0x00, 0x00, // GCT flag, color res, sort; bg color; aspect
        0xff, 0xff, 0xff, // color 0: white
        0x00, 0x00, 0x00, // color 1: black
        0x2c, // image separator
        0x00, 0x00, 0x00, 0x00, // left, top
        0x01, 0x00, 0x01, 0x00, // width, height
        0x00, // no local color table
        0x02, // LZW min code size
        0x02, 0x4c, 0x01, // data sub-block
        0x00, // block terminator
        0x3b, // trailer
      ]);
    }
    const result = await processPhoto(input, 'image/gif');
    expect(result.display.mimeType).toBe('image/gif');
    expect(result.display.data.equals(input)).toBe(true);
    const thumbMeta = await sharp(result.thumbnail.data).metadata();
    expect(thumbMeta.format).toBe('jpeg');
    expect(Math.max(thumbMeta.width!, thumbMeta.height!)).toBeLessThanOrEqual(300);
    expect(result.thumbnail.mimeType).toBe('image/jpeg');
  });
});
