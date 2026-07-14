import { COLOR_RE, colorLuminance, mapTargetColor, toneMapped } from './colorMath';

export function recolorSvgText(svgText: string, base: string, colors: string[]): string {
  const found = Array.from(new Set(svgText.match(COLOR_RE) || []));
  if (found.length === 0) return svgText;
  const sorted = found.sort((a, b) => colorLuminance(a) - colorLuminance(b));
  const map: Record<string, string> = {};
  sorted.forEach((c, i) => {
    const p = sorted.length > 1 ? i / (sorted.length - 1) : 1;
    map[c] = toneMapped(mapTargetColor(p, base, colors), colorLuminance(c));
  });
  return svgText.replace(COLOR_RE, m => map[m] || m);
}
