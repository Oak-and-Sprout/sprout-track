import { describe, it, expect } from 'vitest';
import {
  normalizeFoodName,
  foodNameKey,
  isDuplicateFoodName,
  isValidEnjoyment,
  isLikelyCommonAllergen,
  computeFoodProgress,
  deriveAllergens,
  buildFoodTryList,
  countFirstTriesInRange,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_LABELS,
  UNIQUE_FOOD_GOAL,
} from '@/src/utils/foodLogUtils';

// Issue #203: food tracker helpers — unique-food counting for the
// "100 foods before 1" progress view, catalog duplicate detection, and the
// allergen profile derived from reaction-flagged logs.
const at = (iso: string) => new Date(iso);

describe('normalizeFoodName', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeFoodName('  sweet   potato  ')).toBe('sweet potato');
    expect(normalizeFoodName('banana\t\n bread')).toBe('banana bread');
  });

  it('returns an empty string for empty or whitespace-only input', () => {
    expect(normalizeFoodName('')).toBe('');
    expect(normalizeFoodName('   \t\n ')).toBe('');
  });

  it('preserves casing (display name is stored as entered)', () => {
    expect(normalizeFoodName('Sweet Potato')).toBe('Sweet Potato');
  });
});

describe('foodNameKey / isDuplicateFoodName', () => {
  it('detects duplicates case-insensitively and whitespace-insensitively', () => {
    expect(foodNameKey('  Sweet   POTATO ')).toBe(foodNameKey('sweet potato'));
    expect(isDuplicateFoodName('PEANUT butter', ['Peanut Butter', 'Banana'])).toBe(true);
    expect(isDuplicateFoodName(' avocado ', ['Avocado'])).toBe(true);
  });

  it('does not flag distinct names', () => {
    expect(isDuplicateFoodName('Peanut', ['Peanut Butter', 'Banana'])).toBe(false);
  });

  it('never flags empty or whitespace-only names as duplicates', () => {
    expect(isDuplicateFoodName('', ['Banana'])).toBe(false);
    expect(isDuplicateFoodName('   ', [''])).toBe(false);
  });

  it('handles an empty catalog', () => {
    expect(isDuplicateFoodName('Banana', [])).toBe(false);
  });
});

describe('isValidEnjoyment', () => {
  it('accepts every FoodEnjoyment value', () => {
    for (const value of FOOD_ENJOYMENT_VALUES) {
      expect(isValidEnjoyment(value)).toBe(true);
    }
  });

  it('rejects unknown strings, lowercase variants, and non-strings', () => {
    expect(isValidEnjoyment('LOVED IT')).toBe(false);
    expect(isValidEnjoyment('loved')).toBe(false);
    expect(isValidEnjoyment('')).toBe(false);
    expect(isValidEnjoyment(null)).toBe(false);
    expect(isValidEnjoyment(undefined)).toBe(false);
    expect(isValidEnjoyment(3)).toBe(false);
  });
});

describe('isLikelyCommonAllergen', () => {
  it('flags big-9 foods regardless of casing and phrasing', () => {
    expect(isLikelyCommonAllergen('Peanut Butter')).toBe(true);
    expect(isLikelyCommonAllergen('scrambled EGG')).toBe(true);
    expect(isLikelyCommonAllergen('whole   milk')).toBe(true);
    expect(isLikelyCommonAllergen('Shrimp')).toBe(true);
    expect(isLikelyCommonAllergen('tahini')).toBe(true);
  });

  it('does not flag non-allergen foods or empty input', () => {
    expect(isLikelyCommonAllergen('Banana')).toBe(false);
    expect(isLikelyCommonAllergen('Sweet Potato')).toBe(false);
    expect(isLikelyCommonAllergen('')).toBe(false);
  });
});

describe('computeFoodProgress', () => {
  it('returns zeroed progress for empty input', () => {
    const progress = computeFoodProgress([]);
    expect(progress.uniqueFoodCount).toBe(0);
    expect(progress.totalTries).toBe(0);
    expect(progress.firstTryByFoodId).toEqual({});
    expect(progress.countsByEnjoyment).toEqual({
      HATED: 0,
      DISLIKED: 0,
      NEUTRAL: 0,
      LIKED: 0,
      LOVED: 0,
    });
  });

  it('counts the same food tried many times as one unique food', () => {
    const logs = [
      { foodId: 'banana', time: at('2026-07-01T09:00:00Z'), enjoyment: 'LOVED' },
      { foodId: 'banana', time: at('2026-07-02T09:00:00Z'), enjoyment: 'LIKED' },
      { foodId: 'banana', time: at('2026-07-03T09:00:00Z'), enjoyment: 'LOVED' },
      { foodId: 'avocado', time: at('2026-07-02T12:00:00Z'), enjoyment: 'NEUTRAL' },
    ];
    const progress = computeFoodProgress(logs);
    expect(progress.uniqueFoodCount).toBe(2);
    expect(progress.totalTries).toBe(4);
    expect(progress.countsByEnjoyment).toEqual({
      HATED: 0,
      DISLIKED: 0,
      NEUTRAL: 1,
      LIKED: 1,
      LOVED: 2,
    });
  });

  it('identifies the earliest try per food even when logs are unordered', () => {
    const logs = [
      { foodId: 'banana', time: at('2026-07-03T09:00:00Z') },
      { foodId: 'banana', time: at('2026-07-01T09:00:00Z') },
      { foodId: 'banana', time: at('2026-07-02T09:00:00Z') },
    ];
    const progress = computeFoodProgress(logs);
    expect(progress.firstTryByFoodId).toEqual({
      banana: '2026-07-01T09:00:00.000Z',
    });
  });

  it('excludes soft-deleted logs from counts and first tries', () => {
    const logs = [
      { foodId: 'banana', time: at('2026-07-01T09:00:00Z'), deletedAt: at('2026-07-05T00:00:00Z'), enjoyment: 'HATED' },
      { foodId: 'banana', time: at('2026-07-02T09:00:00Z'), deletedAt: null, enjoyment: 'LIKED' },
      { foodId: 'egg', time: at('2026-07-03T09:00:00Z'), deletedAt: at('2026-07-05T00:00:00Z') },
    ];
    const progress = computeFoodProgress(logs);
    expect(progress.uniqueFoodCount).toBe(1);
    expect(progress.totalTries).toBe(1);
    expect(progress.firstTryByFoodId).toEqual({
      banana: '2026-07-02T09:00:00.000Z',
    });
    expect(progress.countsByEnjoyment.HATED).toBe(0);
    expect(progress.countsByEnjoyment.LIKED).toBe(1);
  });

  it('ignores missing or invalid enjoyment values without failing', () => {
    const logs = [
      { foodId: 'banana', time: at('2026-07-01T09:00:00Z') },
      { foodId: 'banana', time: at('2026-07-02T09:00:00Z'), enjoyment: null },
      { foodId: 'banana', time: at('2026-07-03T09:00:00Z'), enjoyment: 'YUMMY' },
    ];
    const progress = computeFoodProgress(logs);
    expect(progress.totalTries).toBe(3);
    expect(Object.values(progress.countsByEnjoyment).every(count => count === 0)).toBe(true);
  });

  it('accepts ISO-string times', () => {
    const progress = computeFoodProgress([
      { foodId: 'banana', time: '2026-07-01T09:00:00.000Z' },
    ]);
    expect(progress.firstTryByFoodId.banana).toBe('2026-07-01T09:00:00.000Z');
  });

  it('exposes the 100-food goal constant for the progress view', () => {
    expect(UNIQUE_FOOD_GOAL).toBe(100);
  });
});

describe('deriveAllergens', () => {
  const foods = [
    { id: 'peanut', name: 'Peanut Butter', commonAllergen: true },
    { id: 'banana', name: 'Banana', commonAllergen: false },
    { id: 'egg', name: 'Egg', commonAllergen: true },
  ];

  it('returns an empty list for empty input', () => {
    expect(deriveAllergens([], foods)).toEqual([]);
    expect(deriveAllergens([], [])).toEqual([]);
  });

  it('includes only foods with reaction-flagged logs', () => {
    const logs = [
      { foodId: 'peanut', time: at('2026-07-01T09:00:00Z'), hadReaction: true, reactionDescription: 'redness' },
      { foodId: 'banana', time: at('2026-07-02T09:00:00Z'), hadReaction: false },
      { foodId: 'egg', time: at('2026-07-03T09:00:00Z') },
    ];
    const allergens = deriveAllergens(logs, foods);
    expect(allergens).toHaveLength(1);
    expect(allergens[0]).toEqual({
      foodId: 'peanut',
      foodName: 'Peanut Butter',
      commonAllergen: true,
      reactions: [{ time: '2026-07-01T09:00:00.000Z', description: 'redness' }],
    });
  });

  it('aggregates multiple reactions per food oldest-first and sorts by food name', () => {
    const logs = [
      { foodId: 'peanut', time: at('2026-07-05T09:00:00Z'), hadReaction: true, reactionDescription: 'swelling' },
      { foodId: 'peanut', time: at('2026-07-01T09:00:00Z'), hadReaction: true, reactionDescription: 'redness' },
      { foodId: 'banana', time: at('2026-07-03T09:00:00Z'), hadReaction: true, reactionDescription: '  ' },
    ];
    const allergens = deriveAllergens(logs, foods);
    expect(allergens.map(a => a.foodName)).toEqual(['Banana', 'Peanut Butter']);
    expect(allergens[1].reactions.map(r => r.description)).toEqual(['redness', 'swelling']);
    // Blank descriptions come through as null
    expect(allergens[0].reactions).toEqual([{ time: '2026-07-03T09:00:00.000Z', description: null }]);
    expect(allergens[0].commonAllergen).toBe(false);
  });

  it('excludes soft-deleted reaction logs', () => {
    const logs = [
      { foodId: 'peanut', time: at('2026-07-01T09:00:00Z'), hadReaction: true, deletedAt: at('2026-07-02T00:00:00Z') },
    ];
    expect(deriveAllergens(logs, foods)).toEqual([]);
  });

  it('skips logs whose food is not in the provided catalog', () => {
    const logs = [
      { foodId: 'unknown', time: at('2026-07-01T09:00:00Z'), hadReaction: true },
    ];
    expect(deriveAllergens(logs, foods)).toEqual([]);
  });
});

describe('FOOD_ENJOYMENT_LABELS', () => {
  it('maps every enjoyment value to an English label key', () => {
    for (const value of FOOD_ENJOYMENT_VALUES) {
      expect(typeof FOOD_ENJOYMENT_LABELS[value]).toBe('string');
      expect(FOOD_ENJOYMENT_LABELS[value].length).toBeGreaterThan(0);
    }
    expect(FOOD_ENJOYMENT_LABELS.LOVED).toBe('Loved');
  });
});

describe('buildFoodTryList', () => {
  const banana = { id: 'banana', name: 'Banana', commonAllergen: false };
  const peanut = { id: 'peanut', name: 'Peanut Butter', commonAllergen: true };

  it('returns an empty list for empty input', () => {
    expect(buildFoodTryList([])).toEqual([]);
  });

  it('groups tries per food with counts, first/latest try, and allergen flag', () => {
    const logs = [
      { foodId: 'banana', food: banana, time: at('2026-07-01T09:00:00Z'), enjoyment: 'LIKED' },
      { foodId: 'banana', food: banana, time: at('2026-07-03T09:00:00Z'), enjoyment: 'LOVED' },
      { foodId: 'peanut', food: peanut, time: at('2026-07-02T09:00:00Z'), enjoyment: 'NEUTRAL' },
    ];
    const list = buildFoodTryList(logs);
    expect(list).toHaveLength(2);
    // Sorted by latest try, newest first
    expect(list.map(e => e.foodName)).toEqual(['Banana', 'Peanut Butter']);
    expect(list[0]).toMatchObject({
      foodId: 'banana',
      tryCount: 2,
      firstTryTime: '2026-07-01T09:00:00.000Z',
      latestTryTime: '2026-07-03T09:00:00.000Z',
      latestEnjoyment: 'LOVED',
      commonAllergen: false,
      hadReaction: false,
    });
    expect(list[1].commonAllergen).toBe(true);
  });

  it('takes the enjoyment of the most recent try that recorded one', () => {
    const logs = [
      { foodId: 'banana', food: banana, time: at('2026-07-01T09:00:00Z'), enjoyment: 'HATED' },
      { foodId: 'banana', food: banana, time: at('2026-07-05T09:00:00Z'), enjoyment: null },
      { foodId: 'banana', food: banana, time: at('2026-07-03T09:00:00Z'), enjoyment: 'LIKED' },
    ];
    const [entry] = buildFoodTryList(logs);
    expect(entry.latestEnjoyment).toBe('LIKED');
    expect(entry.latestTryTime).toBe('2026-07-05T09:00:00.000Z');
  });

  it('flags a food when any try had a reaction and excludes soft-deleted logs', () => {
    const logs = [
      { foodId: 'peanut', food: peanut, time: at('2026-07-01T09:00:00Z'), hadReaction: true },
      { foodId: 'peanut', food: peanut, time: at('2026-07-02T09:00:00Z'), hadReaction: false },
      { foodId: 'banana', food: banana, time: at('2026-07-03T09:00:00Z'), deletedAt: at('2026-07-04T00:00:00Z') },
    ];
    const list = buildFoodTryList(logs);
    expect(list).toHaveLength(1);
    expect(list[0].foodId).toBe('peanut');
    expect(list[0].tryCount).toBe(2);
    expect(list[0].hadReaction).toBe(true);
  });

  it('tolerates a missing food join with an empty name', () => {
    const [entry] = buildFoodTryList([
      { foodId: 'mystery', time: at('2026-07-01T09:00:00Z') },
    ]);
    expect(entry.foodName).toBe('');
    expect(entry.tryCount).toBe(1);
  });
});

describe('countFirstTriesInRange', () => {
  const logs = [
    // banana first tried before the range, tried again inside it
    { foodId: 'banana', time: at('2026-06-01T09:00:00Z') },
    { foodId: 'banana', time: at('2026-07-02T09:00:00Z') },
    // avocado first tried inside the range
    { foodId: 'avocado', time: at('2026-07-03T09:00:00Z') },
    // egg first tried after the range
    { foodId: 'egg', time: at('2026-08-01T09:00:00Z') },
  ];
  const start = at('2026-07-01T00:00:00Z');
  const end = at('2026-07-07T23:59:59Z');

  it('counts only foods whose all-time first try is inside the range', () => {
    expect(countFirstTriesInRange(logs, start, end)).toBe(1);
  });

  it('returns 0 for empty input', () => {
    expect(countFirstTriesInRange([], start, end)).toBe(0);
  });

  it('ignores soft-deleted logs when finding first tries', () => {
    const withDeleted = [
      { foodId: 'kiwi', time: at('2026-06-15T09:00:00Z'), deletedAt: at('2026-06-16T00:00:00Z') },
      { foodId: 'kiwi', time: at('2026-07-04T09:00:00Z') },
    ];
    // The June try was deleted, so the July try is kiwi's first
    expect(countFirstTriesInRange(withDeleted, start, end)).toBe(1);
  });

  it('treats range boundaries as inclusive', () => {
    expect(countFirstTriesInRange([{ foodId: 'x', time: start }], start, end)).toBe(1);
    expect(countFirstTriesInRange([{ foodId: 'y', time: end }], start, end)).toBe(1);
  });
});
