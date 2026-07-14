import { describe, it, expect } from 'vitest';
import {
  hex2hsl, hsl2hex, colorLuminance, mapTargetColor, toneMapped, backdropTint, autoIconColor, COLOR_RE,
} from '@/src/utils/nursery/colorMath';

describe('hex2hsl / hsl2hex', () => {
  it('roundtrips primary colors', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#f2e9d8', '#3a6ea5']) {
      const [h, s, l] = hex2hsl(hex);
      expect(hsl2hex(h, s, l)).toBe(hex);
    }
  });
  it('handles achromatic', () => {
    expect(hex2hsl('#808080')[1]).toBe(0);
    expect(hsl2hex(0, 0, 0.5)).toBe('#808080');
  });
});

describe('colorLuminance', () => {
  it('orders black < grey < white', () => {
    expect(colorLuminance('#000000')).toBe(0);
    expect(colorLuminance('#ffffff')).toBe(1);
    expect(colorLuminance('#808080')).toBeGreaterThan(0.4);
    expect(colorLuminance('#808080')).toBeLessThan(0.6);
  });
  it('parses rgb() form', () => {
    expect(colorLuminance('rgb(255, 255, 255)')).toBe(1);
  });
});

describe('mapTargetColor', () => {
  const base = '#f2e9d8';
  const cols = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  it('maps lightest 20% to base', () => {
    expect(mapTargetColor(0.8, base, cols)).toBe(base);
    expect(mapTargetColor(1, base, cols)).toBe(base);
  });
  it('maps darker bands onto pattern colors in order', () => {
    expect(mapTargetColor(0, base, cols)).toBe(cols[0]);
    expect(mapTargetColor(0.79, base, cols)).toBe(cols[4]);
    expect(mapTargetColor(0.4, base, cols)).toBe(cols[2]);
  });
});

describe('toneMapped', () => {
  it('keeps hue/sat of target and blends lightness', () => {
    const out = toneMapped('#3a6ea5', 1); // grey=1 → l = 0.55 + 0.45*targetL
    const [th, ts] = hex2hsl('#3a6ea5');
    const [oh, os, ol] = hex2hsl(out);
    expect(oh).toBeCloseTo(th, 1);
    expect(os).toBeCloseTo(ts, 1);
    expect(ol).toBeGreaterThan(hex2hsl('#3a6ea5')[2]);
  });
});

describe('backdropTint', () => {
  it('darkens light bases and lightens dark bases', () => {
    expect(hex2hsl(backdropTint('#f2e9d8'))[2]).toBeLessThan(hex2hsl('#f2e9d8')[2]);
    expect(hex2hsl(backdropTint('#20242c'))[2]).toBeGreaterThan(hex2hsl('#20242c')[2]);
  });
});

describe('autoIconColor', () => {
  it('offsets hue by 150 and wraps', () => {
    expect(autoIconColor(248)).toBe('oklch(0.9 0.11 38)');
    expect(autoIconColor(0)).toBe('oklch(0.9 0.11 150)');
  });
});

describe('COLOR_RE', () => {
  it('finds hex and rgb colors in svg text', () => {
    const m = '<path fill="#A1B2C3"/><stop stop-color="rgb(1, 2, 3)"/>'.match(COLOR_RE);
    expect(m).toEqual(['#A1B2C3', 'rgb(1, 2, 3)']);
  });
});
