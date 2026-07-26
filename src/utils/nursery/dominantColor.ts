import { hsl2hex } from './colorMath';

export interface DominantTint {
  hue: number;
  tint: string;
}

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (mx + mn) / 2;

  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function dominantTintFromPixels(data: Uint8ClampedArray | number[]): DominantTint {
  const buckets = new Array(24).fill(0);
  let hasChromatic = false;

  // Iterate through RGBA pixels
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const [h, s, l] = rgb2hsl(r, g, b);

    // Skip near-greys
    if (s < 0.15) continue;

    hasChromatic = true;

    // Calculate weight
    const weight = s * (1 - Math.abs(l - 0.5));

    // Accumulate into bucket
    const bucket = Math.floor((h * 360) / 15) % 24;
    buckets[bucket] += weight;
  }

  // If no chromatic pixels, return neutral fallback
  if (!hasChromatic) {
    return {
      hue: 248,
      tint: hsl2hex(248 / 360, 0.2, 0.86),
    };
  }

  // Find dominant bucket
  let dominantBucket = 0;
  let maxWeight = 0;
  for (let i = 0; i < buckets.length; i++) {
    if (buckets[i] > maxWeight) {
      maxWeight = buckets[i];
      dominantBucket = i;
    }
  }

  // Calculate hue from bucket center
  const hue = dominantBucket * 15 + 7.5;

  // Calculate tint
  const tint = hsl2hex(hue / 360, 0.45, 0.86);

  return { hue, tint };
}
