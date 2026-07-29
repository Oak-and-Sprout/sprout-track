import { describe, it, expect } from 'vitest';
import { isWithinTileWindow, TILE_MAX_AGE_MS } from '@/src/utils/nursery/activityFreshness';

const NOW = new Date('2026-07-29T12:00:00.000Z').getTime();
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('isWithinTileWindow', () => {
  it('shows an entry from minutes ago', () => {
    expect(isWithinTileWindow(at(5 * 60 * 1000), NOW)).toBe(true);
  });

  it('shows an entry just inside the window', () => {
    expect(isWithinTileWindow(at(TILE_MAX_AGE_MS - 1000), NOW)).toBe(true);
  });

  it('hides an entry exactly at the cutoff', () => {
    expect(isWithinTileWindow(at(TILE_MAX_AGE_MS), NOW)).toBe(false);
  });

  it('hides an entry from days ago', () => {
    expect(isWithinTileWindow(at(3 * TILE_MAX_AGE_MS), NOW)).toBe(false);
  });

  it('accepts a Date as well as an ISO string', () => {
    expect(isWithinTileWindow(new Date(NOW - 60_000), NOW)).toBe(true);
    expect(isWithinTileWindow(new Date(NOW - 2 * TILE_MAX_AGE_MS), NOW)).toBe(false);
  });

  it('keeps future-dated entries visible', () => {
    expect(isWithinTileWindow(new Date(NOW + 60 * 60 * 1000).toISOString(), NOW)).toBe(true);
  });

  it('treats missing or unparseable timestamps as stale', () => {
    expect(isWithinTileWindow(null, NOW)).toBe(false);
    expect(isWithinTileWindow(undefined, NOW)).toBe(false);
    expect(isWithinTileWindow('', NOW)).toBe(false);
    expect(isWithinTileWindow('not a date', NOW)).toBe(false);
    expect(isWithinTileWindow(new Date('nope'), NOW)).toBe(false);
  });
});
