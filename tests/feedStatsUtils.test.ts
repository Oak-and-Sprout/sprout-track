import { describe, it, expect } from 'vitest';
import { aggregateFeedStats } from '@/src/utils/feedStatsUtils';

// Issue #207: the daily stats bar splits bottle/breast ("milk") feeds from
// solid feeds so each renders its own tile with its own count.
const at = (iso: string) => new Date(iso);

const startOfDay = at('2026-07-10T00:00:00.000Z');
const endOfDay = at('2026-07-10T23:59:59.999Z');

describe('aggregateFeedStats', () => {
  it('counts a bottle-only day under milkFeedCount with no solids', () => {
    const activities = [
      { type: 'BOTTLE', time: at('2026-07-10T08:00:00Z'), amount: 4, unitAbbr: 'OZ' },
      { type: 'BOTTLE', time: at('2026-07-10T12:00:00Z'), amount: 3, unitAbbr: 'OZ' },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'OZ');
    expect(stats.milkFeedCount).toBe(2);
    expect(stats.bottleFeedTotal).toBe(7);
    expect(stats.solidsCount).toBe(0);
    expect(stats.solidsAmounts).toEqual({});
  });

  it('counts a solids-only day under solidsCount with no milk feeds', () => {
    const activities = [
      { type: 'SOLIDS', time: at('2026-07-10T09:00:00Z'), amount: 45, unitAbbr: 'g' },
      { type: 'SOLIDS', time: at('2026-07-10T17:00:00Z'), amount: 30, unitAbbr: 'g' },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'OZ');
    expect(stats.solidsCount).toBe(2);
    expect(stats.solidsAmounts).toEqual({ g: 75 });
    expect(stats.milkFeedCount).toBe(0);
    expect(stats.bottleFeedTotal).toBe(0);
  });

  it('splits a mixed day: bottle + breast count as milk, solids separately', () => {
    const activities = [
      { type: 'BOTTLE', time: at('2026-07-10T08:00:00Z'), amount: 4, unitAbbr: 'OZ' },
      { type: 'BREAST', time: at('2026-07-10T11:00:00Z'), side: 'LEFT', feedDuration: 480 },
      { type: 'SOLIDS', time: at('2026-07-10T13:00:00Z'), amount: 45, unitAbbr: 'g' },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'OZ');
    expect(stats.milkFeedCount).toBe(2);
    expect(stats.solidsCount).toBe(1);
    expect(stats.leftBreastMinutes).toBe(8);
    expect(stats.rightBreastMinutes).toBe(0);
    expect(stats.solidsAmounts).toEqual({ g: 45 });
  });

  it('accumulates solids amounts per unit, defaulting missing units to g', () => {
    const activities = [
      { type: 'SOLIDS', time: at('2026-07-10T09:00:00Z'), amount: 45, unitAbbr: 'g' },
      { type: 'SOLIDS', time: at('2026-07-10T12:00:00Z'), amount: 2, unitAbbr: 'tbsp' },
      { type: 'SOLIDS', time: at('2026-07-10T17:00:00Z'), amount: 15 },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'OZ');
    expect(stats.solidsCount).toBe(3);
    expect(stats.solidsAmounts).toEqual({ g: 60, tbsp: 2 });
  });

  it('converts bottle amounts to the preferred unit, defaulting missing units to OZ', () => {
    const activities = [
      { type: 'BOTTLE', time: at('2026-07-10T08:00:00Z'), amount: 1, unitAbbr: 'OZ' },
      { type: 'BOTTLE', time: at('2026-07-10T12:00:00Z'), amount: 30, unitAbbr: 'ML' },
      { type: 'BOTTLE', time: at('2026-07-10T16:00:00Z'), amount: 1 },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'ML');
    expect(stats.milkFeedCount).toBe(3);
    // 1 oz + 30 ml + 1 oz = 29.5735 + 30 + 29.5735 ml
    expect(stats.bottleFeedTotal).toBeCloseTo(89.147, 3);
  });

  it('groups breast rows into sessions and attributes each to its start day', () => {
    // One session spanning midnight into the 10th's window; grouping needs the
    // surrounding days' rows (windowActivities)
    const windowActivities = [
      { type: 'BREAST', time: at('2026-07-10T23:50:00Z'), side: 'LEFT', feedDuration: 600 },
      { type: 'BREAST', time: at('2026-07-11T00:10:00Z'), side: 'RIGHT', feedDuration: 480 },
    ];
    const stats = aggregateFeedStats([], windowActivities, startOfDay, endOfDay, 'OZ');
    expect(stats.milkFeedCount).toBe(1);
    expect(stats.leftBreastMinutes).toBe(10);
    expect(stats.rightBreastMinutes).toBe(8);

    // The same session belongs to the 10th, not the 11th
    const nextDay = aggregateFeedStats(
      [],
      windowActivities,
      at('2026-07-11T00:00:00.000Z'),
      at('2026-07-11T23:59:59.999Z'),
      'OZ'
    );
    expect(nextDay.milkFeedCount).toBe(0);
  });

  it('ignores feeds outside the day window and non-feed activities', () => {
    const activities = [
      { type: 'BOTTLE', time: at('2026-07-09T23:00:00Z'), amount: 4, unitAbbr: 'OZ' },
      { type: 'SOLIDS', time: at('2026-07-11T09:00:00Z'), amount: 45, unitAbbr: 'g' },
      // Breast-milk adjustment: has amount but no type — must never count
      { time: at('2026-07-10T10:00:00Z'), amount: 5, reason: 'donation' },
      // Diaper: has type but no amount
      { type: 'WET', time: at('2026-07-10T10:00:00Z'), condition: 'NORMAL' },
    ];
    const stats = aggregateFeedStats(activities, undefined, startOfDay, endOfDay, 'OZ');
    expect(stats.milkFeedCount).toBe(0);
    expect(stats.solidsCount).toBe(0);
    expect(stats.bottleFeedTotal).toBe(0);
  });

  it('returns all zeros for empty input', () => {
    const stats = aggregateFeedStats([], undefined, startOfDay, endOfDay, 'OZ');
    expect(stats).toEqual({
      milkFeedCount: 0,
      bottleFeedTotal: 0,
      leftBreastMinutes: 0,
      rightBreastMinutes: 0,
      solidsCount: 0,
      solidsAmounts: {},
    });
  });
});
