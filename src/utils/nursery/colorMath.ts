export type HSL = [number, number, number];

export const COLOR_RE = /#[0-9a-fA-F]{6}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;

const parseRGB = (c: string): [number, number, number] =>
  c[0] === '#'
    ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    : ((c.match(/\d+/g) || []).map(Number) as [number, number, number]);

export function hex2hsl(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hsl2hex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

export function colorLuminance(color: string): number {
  const [r, g, b] = parseRGB(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function mapTargetColor(p: number, base: string, colors: string[]): string {
  return p >= 0.8 ? base : colors[Math.min(colors.length - 1, Math.floor((p / 0.8) * colors.length))];
}

export function toneMapped(targetHex: string, grey: number): string {
  const [th, ts, tl] = hex2hsl(targetHex);
  return hsl2hex(th, ts, 0.55 * grey + 0.45 * tl);
}

export function backdropTint(baseHex: string): string {
  const [h, s, l] = hex2hsl(baseHex);
  return hsl2hex(h, Math.min(1, s * 1.15), l > 0.5 ? l - 0.06 : l + 0.06);
}

export function autoIconColor(hue: number): string {
  return `oklch(0.9 0.11 ${(((hue + 150) % 360) + 360) % 360})`;
}
