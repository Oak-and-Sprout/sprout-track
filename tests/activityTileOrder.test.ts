import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ACTIVITY_TILE_ORDER,
  mergeMissingActivityTiles,
  placeFoodTile,
} from '@/src/utils/activityTileOrder';

describe('DEFAULT_ACTIVITY_TILE_ORDER', () => {
  it('places food immediately after feed and before note', () => {
    const feedIndex = DEFAULT_ACTIVITY_TILE_ORDER.indexOf('feed');
    const foodIndex = DEFAULT_ACTIVITY_TILE_ORDER.indexOf('food');
    const noteIndex = DEFAULT_ACTIVITY_TILE_ORDER.indexOf('note');

    expect(foodIndex).toBe(feedIndex + 1);
    expect(foodIndex).toBeLessThan(noteIndex);
  });
});

describe('placeFoodTile', () => {
  it('inserts food immediately after feed', () => {
    const result = placeFoodTile({
      order: ['sleep', 'feed', 'diaper', 'note'],
      visible: ['sleep', 'feed', 'diaper'],
    });
    expect(result.order).toEqual(['sleep', 'feed', 'food', 'diaper', 'note']);
  });
});

describe('mergeMissingActivityTiles', () => {
  it('inserts missing food after feed and appends other missing tiles', () => {
    const result = mergeMissingActivityTiles({
      order: ['sleep', 'feed', 'diaper', 'note'],
      visible: ['sleep', 'feed', 'diaper', 'note'],
    });
    expect(result.order.slice(0, 5)).toEqual(['sleep', 'feed', 'food', 'diaper', 'note']);
    expect(result.order).toEqual([...DEFAULT_ACTIVITY_TILE_ORDER]);
    expect(result.visible).toContain('food');
  });

  it('returns the default order when arrays are empty', () => {
    const result = mergeMissingActivityTiles({ order: [], visible: [] });
    expect(result.order).toEqual([...DEFAULT_ACTIVITY_TILE_ORDER]);
    expect(result.visible).toEqual([...DEFAULT_ACTIVITY_TILE_ORDER]);
  });
});
