export type HSL = [number, number, number];

// Some sprite/rug source SVGs use 3-digit hex shorthand or CSS named greys
// (e.g. rug-2.svg's `fill="silver"`) alongside 6-digit hex — all three forms
// need to be found so recolorSvgText doesn't leave an unrecolored grey behind.
// The named-color branch only matches a bare quoted attribute value (`="silver"`)
// so it can't accidentally eat unrelated text like an id="...-black-..." string.
export const COLOR_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|(?<=")(?:silver|black|gray|grey|white)(?=")/g;

const NAMED_RGB: Record<string, [number, number, number]> = {
  black: [0, 0, 0],
  white: [255, 255, 255],
  silver: [192, 192, 192],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

const parseRGB = (c: string): [number, number, number] => {
  if (c[0] === '#') {
    const hex = c.length === 4 ? c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c.slice(1);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  if (c[0] === 'r') return (c.match(/\d+/g) || []).map(Number) as [number, number, number];
  return NAMED_RGB[c] || [128, 128, 128];
};

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

export function backdropTint(baseHex: string): string {
  const [h, s, l] = hex2hsl(baseHex);
  return hsl2hex(h, Math.min(1, s * 1.15), l > 0.5 ? l - 0.06 : l + 0.06);
}

export function autoIconColor(hue: number): string {
  return `oklch(0.9 0.11 ${(((hue + 150) % 360) + 360) % 360})`;
}
