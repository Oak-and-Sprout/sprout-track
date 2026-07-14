import { recolorSvgText } from '@/src/utils/nursery/recolorSvg';
import { hsl2hex } from '@/src/utils/nursery/colorMath';

export interface RasterAsset { objectUrl: string; ar: number }

const svgTextCache = new Map<string, Promise<string>>();
const recoloredCache = new Map<string, Promise<RasterAsset>>();
const outlineCache = new Map<string, Promise<RasterAsset>>();

/**
 * Fetches raw SVG text for a url, memoized per url so concurrent callers dedupe.
 * A failed fetch evicts its cache entry so a later call can retry.
 */
export function fetchSvgText(url: string): Promise<string> {
  const cached = svgTextCache.get(url);
  if (cached) return cached;
  const promise = fetch(url).then(r => {
    if (!r.ok) throw new Error(`fetchSvgText failed: ${r.status} ${r.statusText} for ${url}`);
    return r.text();
  }).catch(err => {
    svgTextCache.delete(url);
    throw err;
  });
  svgTextCache.set(url, promise);
  return promise;
}

/** Parses `viewBox="x y w h"` and returns w/h. Falls back to 1 when missing or zero. */
export function svgAspectRatio(svgText: string): number {
  const match = svgText.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/);
  if (!match) return 1;
  const w = parseFloat(match[1]);
  const h = parseFloat(match[2]);
  if (!w || !h) return 1;
  return w / h;
}

/**
 * Fetches, recolors, and blob-URLs a single-pose SVG. Result promises are cached
 * per `${url}|${palette.join()}` (never revoked — session-lifetime cache).
 * A failed attempt evicts its cache entry so a later call can retry.
 */
export function recoloredSvgUrl(url: string, palette: string[]): Promise<RasterAsset> {
  const key = `${url}|${palette.join()}`;
  const cached = recoloredCache.get(key);
  if (cached) return cached;
  const promise = fetchSvgText(url).then(text => {
    const out = recolorSvgText(text, palette);
    const ar = svgAspectRatio(text);
    const objectUrl = URL.createObjectURL(new Blob([out], { type: 'image/svg+xml' }));
    return { objectUrl, ar };
  }).catch(err => {
    recoloredCache.delete(key);
    throw err;
  });
  recoloredCache.set(key, promise);
  return promise;
}

function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function loadImage(src: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.width = width;
    img.height = height;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Rasterizes a single-pose, transparent-background SVG, traces its outline,
 * dilates twice, and tints the result. Port of the prototype's processOutline
 * (nursery.jsx:223-255), simplified for a single transparent-background sprite.
 */
async function traceOutline(url: string, hue: number): Promise<RasterAsset> {
  const text = await fetchSvgText(url);
  const ar = svgAspectRatio(text);
  const W = 320;
  const H = Math.max(1, Math.round(W / ar));

  const svgBlob = new Blob([text], { type: 'image/svg+xml' });
  const tempUrl = URL.createObjectURL(svgBlob);
  let img: HTMLImageElement;
  try {
    img = await loadImage(tempUrl, W, H);
  } finally {
    URL.revokeObjectURL(tempUrl);
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.drawImage(img, 0, 0, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const d = imageData.data;

  const bg = new Uint8Array(W * H);
  const lum = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    bg[p] = d[i + 3] < 24 ? 1 : 0;
    lum[p] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) | 0;
  }

  const edge = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (bg[p]) continue;
      if (bg[p - 1] || bg[p + 1] || bg[p - W] || bg[p + W]) { edge[p] = 1; continue; }
      if (Math.abs(lum[p] - lum[p + 1]) > 24 || Math.abs(lum[p] - lum[p + W]) > 24) edge[p] = 1;
    }
  }
  const edge2 = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (edge[p] || edge[p - 1] || edge[p + 1] || edge[p - W] || edge[p + W]) edge2[p] = 1;
    }
  }
  const edge3 = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x;
      if (edge2[p] || edge2[p - 1] || edge2[p + 1] || edge2[p - W] || edge2[p + W]) edge3[p] = 1;
    }
  }

  const hueFrac = (((hue % 360) + 360) % 360) / 360;
  const [tr, tg, tb] = hexToRgb(hsl2hex(hueFrac, 0.45, 0.86));
  for (let p = 0; p < W * H; p++) {
    const i = p * 4;
    if (edge3[p] && !bg[p]) {
      d[i] = tr; d[i + 1] = tg; d[i + 2] = tb; d[i + 3] = 235;
    } else {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('canvas toBlob failed');
  const objectUrl = URL.createObjectURL(blob);
  return { objectUrl, ar };
}

/**
 * Outline-traces and tints a single-pose SVG for a given hue. Result promises are
 * cached per `${url}|${hue}` (never revoked). On failure the cache entry is
 * removed so a later retry is possible.
 */
export function outlineSpriteUrl(url: string, hue: number): Promise<RasterAsset> {
  const key = `${url}|${hue}`;
  const cached = outlineCache.get(key);
  if (cached) return cached;
  const promise = traceOutline(url, hue).catch(err => {
    outlineCache.delete(key);
    throw err;
  });
  outlineCache.set(key, promise);
  return promise;
}
