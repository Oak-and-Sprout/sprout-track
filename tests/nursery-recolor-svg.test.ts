import { describe, it, expect } from 'vitest';
import { recolorSvgText } from '@/src/utils/nursery/recolorSvg';
import { COLOR_RE } from '@/src/utils/nursery/colorMath';

const PALETTE = ['#f2e9d8', '#3a6ea5', '#5f93c9', '#8fb4d9', '#b1492f', '#d67f65'];
const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
<path fill="#191B20" d="M0 0h1"/><path fill="#5F6062" d="M0 0h2"/>
<path fill="#C3C3C3" d="M0 0h3"/><rect fill="rgb(230, 230, 230)" width="1" height="1"/>
</svg>`;

describe('recolorSvgText', () => {
  it('replaces every source color', () => {
    const out = recolorSvgText(FIXTURE, PALETTE);
    expect(out).not.toContain('#191B20');
    expect(out).not.toContain('#5F6062');
    expect(out).not.toContain('#C3C3C3');
    expect(out).not.toContain('rgb(230, 230, 230)');
  });
  it('maps only onto literal palette colors, verbatim', () => {
    const out = recolorSvgText(FIXTURE, PALETTE);
    const outColors = out.match(COLOR_RE)!;
    const paletteLower = PALETTE.map(c => c.toLowerCase());
    for (const c of outColors) {
      expect(paletteLower).toContain(c.toLowerCase());
    }
  });
  it('preserves luminance ordering (darker source stays darker)', () => {
    const out = recolorSvgText(FIXTURE, PALETTE);
    const outColors = out.match(COLOR_RE)!;
    // darkest source (#191B20) should not land on a lighter target than the lightest source (rgb 230)
    expect(outColors[0]).not.toBe(outColors[3]);
  });
  it('maps the darkest and lightest source onto the darkest and lightest palette entries', () => {
    const out = recolorSvgText(FIXTURE, PALETTE);
    const outColors = out.match(COLOR_RE)!;
    expect(outColors[0].toLowerCase()).toBe('#3a6ea5'); // darkest source → darkest palette entry
    expect(outColors[3].toLowerCase()).toBe('#f2e9d8'); // lightest source → lightest palette entry
  });
  it('leaves non-color text untouched', () => {
    const out = recolorSvgText(FIXTURE, PALETTE);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('d="M0 0h1"');
  });
  it('handles svg with a single color', () => {
    const out = recolorSvgText('<path fill="#333333"/>', PALETTE);
    expect(out).not.toContain('#333333');
  });
  it('returns input unchanged when no colors present', () => {
    expect(recolorSvgText('<g/>', PALETTE)).toBe('<g/>');
  });
  it('returns input unchanged when the palette is empty', () => {
    expect(recolorSvgText(FIXTURE, [])).toBe(FIXTURE);
  });
  it('recolors 3-digit hex shorthand and named greys (e.g. the heirloom rug SVG)', () => {
    const svg = '<path fill="silver" d="M0 0h1"/><path fill="#888" d="M0 0h2"/><path fill="#020201" d="M0 0h3"/>';
    const out = recolorSvgText(svg, PALETTE);
    expect(out).not.toContain('"silver"');
    expect(out).not.toContain('"#888"');
    const outColors = out.match(COLOR_RE)!;
    const paletteLower = PALETTE.map(c => c.toLowerCase());
    for (const c of outColors) {
      expect(paletteLower).toContain(c.toLowerCase());
    }
  });
});
