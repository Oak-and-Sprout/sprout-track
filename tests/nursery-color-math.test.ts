import { describe, it, expect } from 'vitest';
import {
  hex2hsl, hsl2hex, colorLuminance, backdropTint, autoIconColor, COLOR_RE,
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
  it('expands 3-digit hex shorthand', () => {
    expect(colorLuminance('#fff')).toBe(colorLuminance('#ffffff'));
    expect(colorLuminance('#000')).toBe(colorLuminance('#000000'));
  });
  it('resolves named greys', () => {
    expect(colorLuminance('black')).toBe(0);
    expect(colorLuminance('white')).toBe(1);
    expect(colorLuminance('silver')).toBeCloseTo(colorLuminance('#c0c0c0'), 5);
    expect(colorLuminance('gray')).toBeCloseTo(colorLuminance('#808080'), 5);
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
  it('finds 3-digit hex shorthand without swallowing part of a 6-digit hex', () => {
    const m = '<path fill="#888"/><path fill="#888888"/>'.match(COLOR_RE);
    expect(m).toEqual(['#888', '#888888']);
  });
  it('finds quoted named greys but not similar substrings elsewhere', () => {
    const m = '<path fill="silver"/><stop stop-color="black"/><path id="black-outline"/>'.match(COLOR_RE);
    expect(m).toEqual(['silver', 'black']);
  });
});
