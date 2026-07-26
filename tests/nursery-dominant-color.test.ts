import { describe, it, expect } from 'vitest';
import { dominantTintFromPixels } from '@/src/utils/nursery/dominantColor';

const px = (rgb: [number, number, number], n: number) => Array.from({ length: n }, () => [...rgb, 255]).flat();

describe('dominantTintFromPixels', () => {
  it('finds the hue of a solid color', () => {
    const { hue } = dominantTintFromPixels(px([255, 0, 0], 64));
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(30);
  });
  it('majority color wins', () => {
    const { hue } = dominantTintFromPixels([...px([0, 0, 255], 60), ...px([255, 0, 0], 10)]);
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(270);
  });
  it('greyscale input returns neutral fallback', () => {
    const { hue, tint } = dominantTintFromPixels(px([128, 128, 128], 64));
    expect(hue).toBe(248);
    expect(tint).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('ignores transparent pixels', () => {
    const data = [...px([255, 0, 0], 8)];
    for (let i = 3; i < data.length; i += 4) data[i] = 0; // all transparent
    expect(dominantTintFromPixels(data).hue).toBe(248);
  });
  it('tint is light', () => {
    const { tint } = dominantTintFromPixels(px([0, 200, 80], 64));
    const l = parseInt(tint.slice(1, 3), 16) + parseInt(tint.slice(3, 5), 16) + parseInt(tint.slice(5, 7), 16);
    expect(l / 3).toBeGreaterThan(160);
  });
});
