import { describe, it, expect } from 'vitest';
import { placeScatter, placeOutlineField, mulberry32, PlacedItem } from '@/src/utils/nursery/placement';

const noOverlap = (items: PlacedItem[]) => {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const dx = items[i].x - items[j].x, dy = items[i].y - items[j].y;
      if (dx * dx + dy * dy < (items[i].r + items[j].r) ** 2) return false;
    }
  return true;
};

describe('placeScatter', () => {
  const opts = { poseARs: [1, 0.8, 1.2], baseWidth: 8.6, scaleMin: 0.62, scaleMax: 1.3, count: 17, rotMax: 28 };
  it('places up to count items without overlap, deterministically', () => {
    const a = placeScatter(opts, mulberry32(42));
    const b = placeScatter(opts, mulberry32(42));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(17);
    expect(noOverlap(a)).toBe(true);
  });
  it('respects rotation and pose bounds', () => {
    for (const it2 of placeScatter(opts, mulberry32(7))) {
      expect(Math.abs(it2.rot)).toBeLessThanOrEqual(28);
      expect(it2.poseIndex).toBeGreaterThanOrEqual(0);
      expect(it2.poseIndex).toBeLessThan(3);
      expect(it2.x - it2.r).toBeGreaterThanOrEqual(-0.01);
      expect(it2.x + it2.r).toBeLessThanOrEqual(100.01);
    }
  });
  it('accents avoid existing primaries', () => {
    const rng = mulberry32(1);
    const prim = placeScatter(opts, rng);
    const acc = placeScatter({ ...opts, baseWidth: 4.3, count: 16, existing: prim }, rng);
    expect(noOverlap([...prim, ...acc])).toBe(true);
  });
  it('spreads poses via weight decay', () => {
    const items = placeScatter({ ...opts, count: 12 }, mulberry32(3));
    const used = new Set(items.map(i => i.poseIndex));
    expect(used.size).toBeGreaterThan(1);
  });
  it('handles empty poses and zero count', () => {
    expect(placeScatter({ ...opts, poseARs: [] }, mulberry32(1))).toEqual([]);
    expect(placeScatter({ ...opts, count: 0 }, mulberry32(1))).toEqual([]);
  });
});

describe('placeOutlineField', () => {
  it('is deterministic, collision-free, bounded', () => {
    const o = { poseARs: [1, 1.4], sizeVariance: 40 };
    const a = placeOutlineField(o, mulberry32(9));
    expect(a).toEqual(placeOutlineField(o, mulberry32(9)));
    expect(noOverlap(a)).toBe(true);
    expect(a.length).toBeLessThanOrEqual(26);
    for (const it2 of a) {
      expect(it2.r1).toBeGreaterThanOrEqual(0);
      expect(it2.r1).toBeLessThan(1);
      expect(it2.dur).toBeGreaterThanOrEqual(14);
    }
  });
  it('uniform size when variance <= 2', () => {
    const a = placeOutlineField({ poseARs: [1], sizeVariance: 0 }, mulberry32(5));
    expect(new Set(a.map(i => i.w)).size).toBe(1);
  });
});
