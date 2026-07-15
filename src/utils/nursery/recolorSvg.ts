import { COLOR_RE, colorLuminance } from './colorMath';

/**
 * Recolors an SVG's grayscale placeholder colors with a literal color palette:
 * source colors are ranked darkest→lightest and mapped onto the palette (also
 * ranked darkest→lightest) at the same proportional position — using each
 * palette color verbatim, with no hue/lightness blending toward the source.
 */
export function recolorSvgText(svgText: string, palette: string[]): string {
  const found = Array.from(new Set(svgText.match(COLOR_RE) || []));
  if (found.length === 0 || palette.length === 0) return svgText;
  const sortedFound = found.sort((a, b) => colorLuminance(a) - colorLuminance(b));
  const sortedPalette = [...palette].sort((a, b) => colorLuminance(a) - colorLuminance(b));
  const map: Record<string, string> = {};
  sortedFound.forEach((c, i) => {
    const idx = sortedFound.length > 1
      ? Math.round((i / (sortedFound.length - 1)) * (sortedPalette.length - 1))
      : sortedPalette.length - 1;
    map[c] = sortedPalette[idx];
  });
  return svgText.replace(COLOR_RE, m => map[m] || m);
}
