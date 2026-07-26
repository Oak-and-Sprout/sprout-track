export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlacedItem { x: number; y: number; r: number; w: number; ar: number; poseIndex: number; rot: number }
export interface ScatterOptions {
  poseARs: number[]; areaAR?: number; baseWidth: number; scaleMin: number; scaleMax: number;
  count: number; rotMax: number; maxTries?: number; existing?: PlacedItem[];
}

export function placeScatter(opts: ScatterOptions, rng: Rng): PlacedItem[] {
  const { poseARs, baseWidth, scaleMin, scaleMax, count, rotMax } = opts;
  if (!poseARs.length || count <= 0) return [];
  const VH = 100 / (opts.areaAR ?? 16 / 9);
  const maxTries = opts.maxTries ?? 2200;
  const placed: PlacedItem[] = [];
  const all: PlacedItem[] = [...(opts.existing ?? [])];
  const weights = poseARs.map(() => 1);
  const pickIdx = () => {
    const tot = weights.reduce((a, b) => a + b, 0);
    let t = rng() * tot;
    for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t <= 0) return i; }
    return weights.length - 1;
  };
  let n = 0, tries = 0;
  while (n < count && tries < maxTries) {
    tries++;
    const idx = pickIdx();
    const ar = poseARs[idx];
    if (!(ar > 0)) continue;
    let w = baseWidth * (scaleMin + rng() * (scaleMax - scaleMin));
    if (w / ar > w * 1.9) w *= (w * 1.9) / (w / ar);
    const r = (Math.max(w, w / ar) / 2) * 1.08 + 1.4;
    if (2 * r > 100 || 2 * r > VH) continue;
    const x = r + rng() * (100 - 2 * r);
    const y = r + rng() * (VH - 2 * r);
    let hit = false;
    for (const p of all) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < (r + p.r) * (r + p.r)) { hit = true; break; }
    }
    if (hit) continue;
    const item: PlacedItem = { x, y, r, w, ar, poseIndex: idx, rot: Math.round(rng() * 2 * rotMax - rotMax) };
    placed.push(item); all.push(item);
    weights[idx] *= 0.4;
    n++;
  }
  return placed;
}

export interface OutlineItem extends PlacedItem { dx: number; dy: number; dur: number; delay: number; spin: number; r1: number }
export interface OutlineFieldOptions { poseARs: number[]; count?: number; sizeVariance: number }

export function placeOutlineField(opts: OutlineFieldOptions, rng: Rng): OutlineItem[] {
  const { poseARs, sizeVariance } = opts;
  if (!poseARs.length) return [];
  const count = opts.count ?? 26;
  const VH = 56.25;
  const placed: OutlineItem[] = [];
  let n = 0, tries = 0;
  while (n < count && tries < 1600) {
    tries++;
    const poseIndex = Math.floor(rng() * poseARs.length);
    const ar = poseARs[poseIndex];
    if (!(ar > 0)) continue;
    const sc = sizeVariance <= 2 ? 1 : 1 + (rng() - 0.5) * 2 * (sizeVariance / 100) * 0.75;
    const w = 6.4 * sc;
    const r = Math.max(w, w / ar) / 2 + 1.6;
    const x = r + rng() * (100 - 2 * r);
    const y = r + rng() * (VH - 2 * r);
    let hit = false;
    for (const q of placed) {
      const dx = x - q.x, dy = y - q.y;
      if (dx * dx + dy * dy < (r + q.r) * (r + q.r)) { hit = true; break; }
    }
    if (hit) continue;
    placed.push({
      x, y, r, w, ar, poseIndex, rot: 0,
      r1: rng(), dx: rng() * 120 - 60, dy: rng() * 120 - 60,
      dur: 14 + rng() * 18, delay: -rng() * 20, spin: rng() * 90 - 45,
    });
    n++;
  }
  return placed;
}
