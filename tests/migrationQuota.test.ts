import { describe, it, expect } from 'vitest';
import { planPhotoQuota } from '@/src/utils/migration-quota';

type P = { id: string; takenAt: Date; fileSize: number; thumbSize: number };

const photo = (id: string, iso: string, fileSize: number, thumbSize: number): P => ({
  id,
  takenAt: new Date(iso),
  fileSize,
  thumbSize,
});

describe('planPhotoQuota', () => {
  it('selects all photos when the whole set fits the remaining budget', () => {
    const photos = [
      photo('a', '2024-01-01', 100, 10),
      photo('b', '2024-01-02', 200, 20),
    ];
    const { selected, skippedOverQuota } = planPhotoQuota(photos, 1000);
    expect(selected.map((p) => p.id)).toEqual(['a', 'b']);
    expect(skippedOverQuota).toEqual([]);
  });

  it('processes oldest-first and stops at the budget, counting the rest', () => {
    // out-of-order input; each photo costs fileSize + thumbSize = 110
    const photos = [
      photo('c', '2024-03-01', 100, 10),
      photo('a', '2024-01-01', 100, 10),
      photo('b', '2024-02-01', 100, 10),
    ];
    // budget fits exactly two photos (220), third overflows
    const { selected, skippedOverQuota } = planPhotoQuota(photos, 220);
    expect(selected.map((p) => p.id)).toEqual(['a', 'b']);
    expect(skippedOverQuota.map((p) => p.id)).toEqual(['c']);
  });

  it('includes a photo that lands exactly on the remaining budget', () => {
    const photos = [photo('a', '2024-01-01', 90, 10)];
    const { selected, skippedOverQuota } = planPhotoQuota(photos, 100);
    expect(selected.map((p) => p.id)).toEqual(['a']);
    expect(skippedOverQuota).toEqual([]);
  });

  it('skips everything (counted) when the budget is already exhausted', () => {
    const photos = [
      photo('a', '2024-01-01', 100, 10),
      photo('b', '2024-01-02', 100, 10),
    ];
    const { selected, skippedOverQuota } = planPhotoQuota(photos, 0);
    expect(selected).toEqual([]);
    expect(skippedOverQuota.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('stops at the first photo that does not fit and skips the remainder', () => {
    const photos = [
      photo('a', '2024-01-01', 100, 0), // fits (100)
      photo('b', '2024-01-02', 500, 0), // does not fit -> stop
      photo('c', '2024-01-03', 10, 0), // would fit but is after the stop
    ];
    const { selected, skippedOverQuota } = planPhotoQuota(photos, 150);
    expect(selected.map((p) => p.id)).toEqual(['a']);
    expect(skippedOverQuota.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('returns empty results for empty input', () => {
    const { selected, skippedOverQuota } = planPhotoQuota([], 1000);
    expect(selected).toEqual([]);
    expect(skippedOverQuota).toEqual([]);
  });

  it('does not mutate the input array order', () => {
    const photos = [
      photo('c', '2024-03-01', 10, 0),
      photo('a', '2024-01-01', 10, 0),
    ];
    planPhotoQuota(photos, 1000);
    expect(photos.map((p) => p.id)).toEqual(['c', 'a']);
  });
});
