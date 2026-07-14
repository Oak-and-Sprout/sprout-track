import { describe, it, expect } from 'vitest';
import { recolorSvgText } from '@/src/utils/nursery/recolorSvg';
import { colorLuminance, COLOR_RE } from '@/src/utils/nursery/colorMath';

const BASE = '#f2e9d8';
const COLS = ['#3a6ea5', '#5f93c9', '#8fb4d9', '#b1492f', '#d67f65'];
const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
<path fill="#191B20" d="M0 0h1"/><path fill="#5F6062" d="M0 0h2"/>
<path fill="#C3C3C3" d="M0 0h3"/><rect fill="rgb(230, 230, 230)" width="1" height="1"/>
</svg>`;

describe('recolorSvgText', () => {
  it('replaces every source color', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    expect(out).not.toContain('#191B20');
    expect(out).not.toContain('#5F6062');
    expect(out).not.toContain('#C3C3C3');
    expect(out).not.toContain('rgb(230, 230, 230)');
  });
  it('preserves luminance ordering (darker stays darker)', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    const outColors = out.match(COLOR_RE)!;
    expect(colorLuminance(outColors[0])).toBeLessThan(colorLuminance(outColors[2]));
  });
  it('maps the lightest tone toward the base color band', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    const outColors = out.match(COLOR_RE)!;
    // lightest source (rgb 230) → base target; tone-mapped lightness stays high
    expect(colorLuminance(outColors[3])).toBeGreaterThan(0.6);
  });
  it('leaves non-color text untouched', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('d="M0 0h1"');
  });
  it('handles svg with a single color', () => {
    const out = recolorSvgText('<path fill="#333333"/>', BASE, COLS);
    expect(out).not.toContain('#333333');
  });
  it('returns input unchanged when no colors present', () => {
    expect(recolorSvgText('<g/>', BASE, COLS)).toBe('<g/>');
  });
});
