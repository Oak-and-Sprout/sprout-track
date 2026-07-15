import { describe, it, expect } from 'vitest';
import {
  normalizeFoodName,
  foodNameKey,
  isDuplicateFoodName,
  isValidEnjoyment,
  isValidAllergenType,
  computeFoodProgress,
  deriveAllergens,
  deriveFeedAllergens,
  mergeAllergens,
  buildFoodTryList,
  buildNewFoodsForRange,
  countFirstTriesInRange,
  toDateParam,
  buildLogEntryLink,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_LABELS,
  FOOD_ENJOYMENT_ICON_SRC,
  ALLERGEN_TYPE_VALUES,
  ALLERGEN_TYPE_LABELS,
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
      firstReactionAt: '2026-07-01T09:00:00.000Z',
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
    // First reaction time is the oldest reaction-flagged log
    expect(allergens[1].firstReactionAt).toBe('2026-07-01T09:00:00.000Z');
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

describe('toDateParam', () => {
  it('formats a local date as zero-padded YYYY-MM-DD', () => {
    expect(toDateParam(new Date(2026, 6, 8, 14, 30))).toBe('2026-07-08');
    expect(toDateParam(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('buildLogEntryLink', () => {
  it('builds a date-only deep link when no babyId is given', () => {
    expect(buildLogEntryLink('smith', new Date(2026, 6, 12))).toBe('/smith/log-entry?date=2026-07-12');
  });

  it('includes the babyId when given', () => {
    expect(buildLogEntryLink('smith', new Date(2026, 6, 12), 'baby-1'))
      .toBe('/smith/log-entry?date=2026-07-12&babyId=baby-1');
  });

  it('URL-encodes parameter values', () => {
    expect(buildLogEntryLink('smith', new Date(2026, 6, 12), 'a&b'))
      .toBe('/smith/log-entry?date=2026-07-12&babyId=a%26b');
  });
});

describe('FOOD_ENJOYMENT_ICON_SRC', () => {
  it('maps every enjoyment value to a flat-emoji SVG path', () => {
    for (const value of FOOD_ENJOYMENT_VALUES) {
      expect(FOOD_ENJOYMENT_ICON_SRC[value]).toMatch(/^\/emoji-flat\/.+\.svg$/);
    }
  });
});

describe('allergen types', () => {
  it('exposes the four allergen types with label keys', () => {
    expect([...ALLERGEN_TYPE_VALUES]).toEqual(['FOOD', 'MEDICINE', 'ENVIRONMENT', 'OTHER']);
    for (const value of ALLERGEN_TYPE_VALUES) {
      expect(typeof ALLERGEN_TYPE_LABELS[value]).toBe('string');
      expect(ALLERGEN_TYPE_LABELS[value].length).toBeGreaterThan(0);
    }
  });

  it('validates allergen type values', () => {
    for (const value of ALLERGEN_TYPE_VALUES) {
      expect(isValidAllergenType(value)).toBe(true);
    }
    expect(isValidAllergenType('food')).toBe(false);
    expect(isValidAllergenType('')).toBe(false);
    expect(isValidAllergenType(null)).toBe(false);
    expect(isValidAllergenType(undefined)).toBe(false);
  });
});

describe('deriveFeedAllergens', () => {
  it('returns an empty list for empty input or when no feed had a reaction', () => {
    expect(deriveFeedAllergens([])).toEqual([]);
    expect(deriveFeedAllergens([
      { time: at('2026-07-01T09:00:00Z'), food: 'Carrot', hadReaction: false },
    ])).toEqual([]);
  });

  it('groups reaction-flagged solids feeds case-insensitively by food text', () => {
    const entries = deriveFeedAllergens([
      { time: at('2026-07-02T09:00:00Z'), food: 'carrot', hadReaction: true, reactionDescription: 'hives' },
      { time: at('2026-07-01T09:00:00Z'), food: '  Carrot ', hadReaction: true, reactionDescription: 'redness' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Carrot');
    expect(entries[0].reactions.map(r => r.description)).toEqual(['redness', 'hives']);
    expect(entries[0].firstReactionAt).toBe('2026-07-01T09:00:00.000Z');
  });

  it('groups feeds without a food description into one generic entry, sorted last', () => {
    const entries = deriveFeedAllergens([
      { time: at('2026-07-01T09:00:00Z'), hadReaction: true, reactionDescription: 'spit up' },
      { time: at('2026-07-02T09:00:00Z'), food: '   ', hadReaction: true },
      { time: at('2026-07-03T09:00:00Z'), food: 'Apple', hadReaction: true },
    ]);
    expect(entries.map(e => e.name)).toEqual(['Apple', null]);
    expect(entries[1].reactions).toHaveLength(2);
    expect(entries[1].firstReactionAt).toBe('2026-07-01T09:00:00.000Z');
  });

  it('excludes soft-deleted feed logs', () => {
    expect(deriveFeedAllergens([
      { time: at('2026-07-01T09:00:00Z'), food: 'Carrot', hadReaction: true, deletedAt: at('2026-07-02T00:00:00Z') },
    ])).toEqual([]);
  });

  it('names entries by reactionCause when present, grouping case-insensitively', () => {
    const entries = deriveFeedAllergens([
      { time: at('2026-07-02T09:00:00Z'), reactionCause: 'similac', hadReaction: true, reactionDescription: 'spit up' },
      { time: at('2026-07-01T09:00:00Z'), reactionCause: '  Similac ', hadReaction: true, reactionDescription: 'rash' },
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe('Similac');
    expect(entries[0].reactions.map(r => r.description)).toEqual(['rash', 'spit up']);
    expect(entries[0].firstReactionAt).toBe('2026-07-01T09:00:00.000Z');
  });

  it('prefers reactionCause over the solids food text, falling back to food then the generic bucket', () => {
    const entries = deriveFeedAllergens([
      { time: at('2026-07-01T09:00:00Z'), food: 'Carrot', reactionCause: 'Similac', hadReaction: true },
      { time: at('2026-07-02T09:00:00Z'), food: 'Apple', reactionCause: '   ', hadReaction: true },
      { time: at('2026-07-03T09:00:00Z'), hadReaction: true },
    ]);
    expect(entries.map(e => e.name)).toEqual(['Apple', 'Similac', null]);
  });
});

describe('mergeAllergens', () => {
  const derivedPeanut = {
    foodId: 'peanut',
    foodName: 'Peanut Butter',
    commonAllergen: true,
    reactions: [{ time: '2026-07-05T09:00:00.000Z', description: 'redness' }],
    firstReactionAt: '2026-07-05T09:00:00.000Z',
  };

  it('returns an empty list for empty inputs', () => {
    expect(mergeAllergens([], [])).toEqual([]);
    expect(mergeAllergens([], [], [])).toEqual([]);
  });

  it('passes through derived-only and manual-only entries with their source and date', () => {
    const merged = mergeAllergens(
      [derivedPeanut],
      [{ id: 'm1', name: 'Cats', allergenType: 'ENVIRONMENT', reactionDescription: 'sneezing', notes: 'notice', createdAt: '2026-06-01T00:00:00.000Z' }]
    );
    expect(merged.map(e => e.name)).toEqual(['Cats', 'Peanut Butter']);

    const [cats, peanut] = merged;
    expect(cats.sources).toEqual(['manual']);
    expect(cats.allergenType).toBe('ENVIRONMENT');
    expect(cats.manualId).toBe('m1');
    expect(cats.reactionDescriptions).toEqual(['sneezing']);
    expect(cats.notes).toBe('notice');
    expect(cats.dateAdded).toBe('2026-06-01T00:00:00.000Z');

    expect(peanut.sources).toEqual(['food-log']);
    expect(peanut.allergenType).toBe('FOOD');
    expect(peanut.manualId).toBeNull();
    expect(peanut.commonAllergen).toBe(true);
    expect(peanut.reactionDescriptions).toEqual(['redness']);
    expect(peanut.dateAdded).toBe('2026-07-05T09:00:00.000Z');
  });

  it('dedupes case-insensitively; manual wins metadata, both descriptions kept, earliest date wins', () => {
    const merged = mergeAllergens(
      [derivedPeanut],
      [{ id: 'm1', name: 'peanut BUTTER', allergenType: 'FOOD', reactionDescription: 'swelling', notes: 'epi pen in bag', createdAt: '2026-07-01T00:00:00.000Z' }]
    );
    expect(merged).toHaveLength(1);
    const [entry] = merged;
    expect(entry.name).toBe('peanut BUTTER'); // manual display name wins
    expect(entry.sources).toEqual(['manual', 'food-log']);
    expect(entry.manualId).toBe('m1');
    expect(entry.commonAllergen).toBe(true); // derived flag kept
    expect(entry.reactionDescriptions).toEqual(['swelling', 'redness']); // manual first
    expect(entry.reactions).toHaveLength(1); // derived reaction events kept
    expect(entry.notes).toBe('epi pen in bag');
    expect(entry.dateAdded).toBe('2026-07-01T00:00:00.000Z'); // earliest of the two
  });

  it('merges feed-derived reactions into a matching food-log entry and sorts events', () => {
    const merged = mergeAllergens(
      [derivedPeanut],
      [],
      [{
        name: 'Peanut butter',
        reactions: [{ time: '2026-07-02T09:00:00.000Z', description: 'hives' }],
        firstReactionAt: '2026-07-02T09:00:00.000Z',
      }]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].sources).toEqual(['food-log', 'feed']);
    expect(merged[0].reactions.map(r => r.time)).toEqual([
      '2026-07-02T09:00:00.000Z',
      '2026-07-05T09:00:00.000Z',
    ]);
    // Derived descriptions fold in chronologically (feed reaction predates the food-log one)
    expect(merged[0].reactionDescriptions).toEqual(['hives', 'redness']);
    expect(merged[0].dateAdded).toBe('2026-07-02T09:00:00.000Z');
  });

  it('keeps the generic feed entry (name null) and sorts it last', () => {
    const merged = mergeAllergens(
      [],
      [{ id: 'm1', name: 'Zebra grass', createdAt: '2026-06-01T00:00:00.000Z' }],
      [{
        name: null,
        reactions: [{ time: '2026-07-01T09:00:00.000Z', description: null }],
        firstReactionAt: '2026-07-01T09:00:00.000Z',
      }]
    );
    expect(merged.map(e => e.name)).toEqual(['Zebra grass', null]);
    expect(merged[1].sources).toEqual(['feed']);
    expect(merged[1].dateAdded).toBe('2026-07-01T09:00:00.000Z');
  });

  it('skips soft-deleted and blank-named manual entries and defaults invalid types to OTHER', () => {
    const merged = mergeAllergens([], [
      { id: 'm1', name: 'Dust', createdAt: '2026-06-01T00:00:00.000Z', deletedAt: '2026-06-02T00:00:00.000Z' },
      { id: 'm2', name: '   ', createdAt: '2026-06-01T00:00:00.000Z' },
      { id: 'm3', name: 'Latex', allergenType: 'bogus', createdAt: '2026-06-01T00:00:00.000Z' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Latex');
    expect(merged[0].allergenType).toBe('OTHER');
  });

  it('does not duplicate identical derived reaction descriptions', () => {
    const merged = mergeAllergens([{
      ...derivedPeanut,
      reactions: [
        { time: '2026-07-05T09:00:00.000Z', description: 'redness' },
        { time: '2026-07-06T09:00:00.000Z', description: 'redness' },
      ],
    }], []);
    expect(merged[0].reactionDescriptions).toEqual(['redness']);
  });
});

describe('buildNewFoodsForRange', () => {
  const banana = { id: 'banana', name: 'Banana', commonAllergen: false };
  const peanut = { id: 'peanut', name: 'Peanut Butter', commonAllergen: true };
  const start = at('2026-07-01T00:00:00Z');
  const end = at('2026-07-31T23:59:59Z');

  it('returns an empty list for empty input', () => {
    expect(buildNewFoodsForRange([], start, end)).toEqual([]);
  });

  it('includes only foods whose first-ever try falls inside the range', () => {
    const logs = [
      // banana first tried in June — repeat July try is not "new"
      { foodId: 'banana', food: banana, time: at('2026-06-15T09:00:00Z'), enjoyment: 'LIKED' },
      { foodId: 'banana', food: banana, time: at('2026-07-02T09:00:00Z'), enjoyment: 'LOVED' },
      // peanut first tried in July
      { foodId: 'peanut', food: peanut, time: at('2026-07-03T09:00:00Z'), enjoyment: 'NEUTRAL' },
    ];
    const entries = buildNewFoodsForRange(logs, start, end);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      foodId: 'peanut',
      foodName: 'Peanut Butter',
      commonAllergen: true,
      firstTryTime: '2026-07-03T09:00:00.000Z',
      enjoyment: 'NEUTRAL',
      hadReaction: false,
    });
  });

  it('uses the latest in-range enjoyment and flags any in-range reaction, sorted oldest first', () => {
    const logs = [
      { foodId: 'peanut', food: peanut, time: at('2026-07-03T09:00:00Z'), enjoyment: 'LIKED' },
      { foodId: 'peanut', food: peanut, time: at('2026-07-10T09:00:00Z'), enjoyment: 'HATED', hadReaction: true },
      { foodId: 'banana', food: banana, time: at('2026-07-01T09:00:00Z') },
    ];
    const entries = buildNewFoodsForRange(logs, start, end);
    expect(entries.map(e => e.foodId)).toEqual(['banana', 'peanut']);
    expect(entries[1].enjoyment).toBe('HATED');
    expect(entries[1].hadReaction).toBe(true);
    expect(entries[0].enjoyment).toBeNull();
  });

  it('ignores soft-deleted logs when identifying first tries', () => {
    const logs = [
      { foodId: 'banana', food: banana, time: at('2026-06-15T09:00:00Z'), deletedAt: at('2026-06-16T00:00:00Z') },
      { foodId: 'banana', food: banana, time: at('2026-07-02T09:00:00Z') },
    ];
    const entries = buildNewFoodsForRange(logs, start, end);
    expect(entries).toHaveLength(1);
    expect(entries[0].firstTryTime).toBe('2026-07-02T09:00:00.000Z');
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
