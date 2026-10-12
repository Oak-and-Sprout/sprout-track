import { describe, it, expect } from 'vitest';
import {
  parseFoodsJson,
  serializeFoodItems,
  resolveFoodItemDetails,
  foodLogAmountsByUnit,
  deriveMealAmountFromItems,
  buildMealItems,
  validateFoodItemInputs,
  formatFoodItemAmounts,
  formatFoodLogAmountSummary,
  formatFoodItemDetail,
  deriveAllergens,
  buildFoodTryList,
  buildNewFoodsForRange,
  computeFoodProgress,
  rewriteFoodsJsonIds,
  type FoodLogItem,
} from '@/src/utils/foodLogUtils';
import { aggregateFeedStats } from '@/src/utils/feedStatsUtils';

/**
 * Per-food details inside one multi-food entry (#271): each `foods` JSON item
 * may carry its own amount/unit and enjoyment next to its reaction. Rows
 * written before #271 (old item shape, or a legacy single-food row with only
 * row-level fields) must keep reading exactly as they did.
 */

const T1 = '2026-10-01T12:00:00.000Z';
const T2 = '2026-10-02T12:00:00.000Z';
const unit = (abbr: string | null | undefined) => (abbr || 'g').toLowerCase();

describe('parseFoodsJson (#271 item shape)', () => {
  it('reads the pre-#271 shape unchanged (no new keys appear)', () => {
    expect(parseFoodsJson('[{"foodId":"a"},{"foodId":"b","hadReaction":true,"reactionDescription":"hives"}]')).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null },
      { foodId: 'b', hadReaction: true, reactionDescription: 'hives' },
    ]);
  });

  it('reads per-food amount, unit and enjoyment', () => {
    expect(parseFoodsJson('[{"foodId":"a","amount":2,"unitAbbr":"TBSP","enjoyment":"LIKED"}]')).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'TBSP', enjoyment: 'LIKED' },
    ]);
  });

  it('drops malformed detail fields but keeps the food', () => {
    const json = JSON.stringify([
      { foodId: 'a', amount: -1, unitAbbr: 'TBSP', enjoyment: 'meh' },
      { foodId: 'b', amount: '2', enjoyment: 7 },
      { foodId: 'c', amount: 3, unitAbbr: 5 },
      { foodId: 'd', unitAbbr: 'G' },
    ]);
    expect(parseFoodsJson(json)).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null },
      { foodId: 'b', hadReaction: false, reactionDescription: null },
      { foodId: 'c', hadReaction: false, reactionDescription: null, amount: 3 },
      { foodId: 'd', hadReaction: false, reactionDescription: null },
    ]);
  });

  it('returns [] for malformed JSON or a non-array', () => {
    expect(parseFoodsJson('{oops')).toEqual([]);
    expect(parseFoodsJson('{"foodId":"a"}')).toEqual([]);
  });
});

describe('serializeFoodItems (#271)', () => {
  it('round-trips per-food details and omits empty ones', () => {
    const items: FoodLogItem[] = [
      { foodId: 'a', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
      { foodId: 'b', amount: null, unitAbbr: 'G', enjoyment: null },
    ];
    const json = serializeFoodItems(items);
    expect(JSON.parse(json)).toEqual([
      { foodId: 'a', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
      { foodId: 'b' },
    ]);
    expect(parseFoodsJson(json)[0]).toMatchObject({ amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' });
  });
});

describe('resolveFoodItemDetails', () => {
  it('gives a legacy single-food row its row-level amount and enjoyment', () => {
    expect(resolveFoodItemDetails({ foodId: 'a', time: T1, amount: 3, unitAbbr: 'TBSP', enjoyment: 'LIKED' })).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null, amount: 3, unitAbbr: 'TBSP', enjoyment: 'LIKED' },
    ]);
  });

  it('does not split an old multi-food meal amount across foods, but keeps the meal enjoyment for each', () => {
    const items = resolveFoodItemDetails({
      foods: '[{"foodId":"a"},{"foodId":"b"}]', time: T1, amount: 3, unitAbbr: 'TBSP', enjoyment: 'LIKED',
    });
    expect(items.map(i => [i.amount, i.enjoyment])).toEqual([[null, 'LIKED'], [null, 'LIKED']]);
  });

  it('prefers each food’s own details over the meal’s', () => {
    const items = resolveFoodItemDetails({
      foods: JSON.stringify([
        { foodId: 'a', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
        { foodId: 'b', amount: 1, unitAbbr: 'TBSP' },
      ]),
      time: T1, amount: 3, unitAbbr: 'TBSP', enjoyment: 'NEUTRAL',
    });
    expect(items.map(i => [i.amount, i.enjoyment])).toEqual([[2, 'LOVED'], [1, 'NEUTRAL']]);
  });
});

describe('foodLogAmountsByUnit / deriveMealAmountFromItems', () => {
  it('uses the row amount when no food carries its own', () => {
    expect(foodLogAmountsByUnit({ foodId: 'a', time: T1, amount: 2, unitAbbr: 'TBSP' })).toEqual({ tbsp: 2 });
    expect(foodLogAmountsByUnit({ foodId: 'a', time: T1, amount: null })).toEqual({});
  });

  it('sums per-food amounts by unit, including mixed units', () => {
    const log = {
      foods: JSON.stringify([
        { foodId: 'a', amount: 2, unitAbbr: 'TBSP' },
        { foodId: 'b', amount: 1, unitAbbr: 'tbsp' },
        { foodId: 'c', amount: 20, unitAbbr: 'G' },
      ]),
      time: T1, amount: null, unitAbbr: null,
    };
    expect(foodLogAmountsByUnit(log)).toEqual({ tbsp: 3, g: 20 });
  });

  it('derives the row amount: null without per-food amounts, a sum for one unit, null amount for mixed units', () => {
    expect(deriveMealAmountFromItems([{ foodId: 'a' }, { foodId: 'b' }])).toBeNull();
    expect(deriveMealAmountFromItems([
      { foodId: 'a', amount: 2, unitAbbr: 'TBSP' },
      { foodId: 'b', amount: 1.5, unitAbbr: 'TBSP' },
      { foodId: 'c' },
    ])).toEqual({ amount: 3.5, unitAbbr: 'TBSP' });
    expect(deriveMealAmountFromItems([
      { foodId: 'a', amount: 2, unitAbbr: 'TBSP' },
      { foodId: 'b', amount: 10, unitAbbr: 'G' },
    ])).toEqual({ amount: null, unitAbbr: null });
  });

  it('feeds per-food amounts into the daily solids totals', () => {
    const day = new Date('2026-10-01T00:00:00.000Z');
    const end = new Date('2026-10-01T23:59:59.999Z');
    const stats = aggregateFeedStats([
      { foodId: null, foods: JSON.stringify([{ foodId: 'a', amount: 2, unitAbbr: 'TBSP' }, { foodId: 'b', amount: 10, unitAbbr: 'G' }]), time: T1, amount: null, unitAbbr: null },
      { foodId: 'c', time: T1, amount: 1, unitAbbr: 'TBSP' },
    ], undefined, day, end, 'OZ');
    expect(stats.solidsCount).toBe(2);
    expect(stats.solidsAmounts).toEqual({ tbsp: 3, g: 10 });
  });
});

describe('buildMealItems (#271 per-food details)', () => {
  const tags = [
    { foodId: 'a', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'TBSP', enjoyment: 'LIKED' as const },
    { foodId: 'b', hadReaction: false, reactionDescription: null, amount: Number.NaN, unitAbbr: 'TBSP', enjoyment: null },
  ];

  it('carries each food’s amount/unit/enjoyment and drops invalid amounts', () => {
    expect(buildMealItems({ tags, mealReaction: false })).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'TBSP', enjoyment: 'LIKED' },
      { foodId: 'b', hadReaction: false, reactionDescription: null },
    ]);
  });

  it('strips per-food amount/enjoyment from a single-food meal (the meal fields are that food’s)', () => {
    expect(buildMealItems({ tags: [tags[0]], mealReaction: false })).toEqual([
      { foodId: 'a', hadReaction: false, reactionDescription: null },
    ]);
  });
});

describe('validateFoodItemInputs', () => {
  it('accepts and normalizes valid items', () => {
    expect(validateFoodItemInputs([
      { foodId: 'a', amount: 2, unitAbbr: ' TBSP ', enjoyment: 'LIKED', hadReaction: true, reactionDescription: ' hives ' },
      { foodId: 'b', unitAbbr: 'G' },
    ])).toEqual({
      ok: true,
      items: [
        { foodId: 'a', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LIKED', hadReaction: true, reactionDescription: 'hives' },
        { foodId: 'b', amount: null, unitAbbr: null, enjoyment: null, hadReaction: false, reactionDescription: null },
      ],
    });
  });

  it.each([
    ['a non-array', { foodId: 'a' }],
    ['an empty list', []],
    ['a missing foodId', [{ amount: 1 }]],
    ['a non-object entry', ['a']],
    ['a duplicate food', [{ foodId: 'a' }, { foodId: 'a' }]],
    ['a zero amount', [{ foodId: 'a', amount: 0 }]],
    ['a negative amount', [{ foodId: 'a', amount: -2 }]],
    ['a string amount', [{ foodId: 'a', amount: '2' }]],
    ['an infinite amount', [{ foodId: 'a', amount: Infinity }]],
    ['an invalid enjoyment', [{ foodId: 'a', enjoyment: 'GREAT' }]],
    ['a non-string unit', [{ foodId: 'a', amount: 1, unitAbbr: 3 }]],
    ['an overlong unit', [{ foodId: 'a', amount: 1, unitAbbr: 'X'.repeat(17) }]],
    ['a non-boolean reaction flag', [{ foodId: 'a', hadReaction: 'yes' }]],
    ['a non-string reaction description', [{ foodId: 'a', reactionDescription: 5 }]],
  ])('rejects %s', (_label, raw) => {
    expect(validateFoodItemInputs(raw).ok).toBe(false);
  });
});

describe('per-food display formatting', () => {
  it('formats per-food amounts as "Carrot 2 tbsp, Pea 1 tbsp", skipping foods without one', () => {
    expect(formatFoodItemAmounts([
      { name: 'Carrot', amount: 2, unitAbbr: 'TBSP' },
      { name: 'Pea', amount: 1, unitAbbr: 'TBSP' },
      { name: 'Rice', amount: null },
    ], unit)).toBe('Carrot 2 tbsp, Pea 1 tbsp');
  });

  it('summarizes a log: per-food amounts plus the meal total for multi-food meals, else the row amount', () => {
    expect(formatFoodLogAmountSummary({
      amount: 3, unitAbbr: 'TBSP',
      foodItems: [{ name: 'Carrot', amount: 2, unitAbbr: 'TBSP' }, { name: 'Pea', amount: 1, unitAbbr: 'TBSP' }],
    }, unit)).toBe('Carrot 2 tbsp, Pea 1 tbsp · 3 tbsp');
    expect(formatFoodLogAmountSummary({
      amount: 25, unitAbbr: 'G',
      foodItems: [{ name: 'Carrot', amount: 15, unitAbbr: 'G' }, { name: 'Cheese', amount: 10.5, unitAbbr: 'G' }, { name: 'Pea' }],
    }, unit)).toBe('Carrot 15 g, Cheese 10.5 g · 25.5 g');
    // Mixed units: no single total, just the per-food list
    expect(formatFoodLogAmountSummary({
      amount: null,
      foodItems: [{ name: 'Carrot', amount: 15, unitAbbr: 'G' }, { name: 'Pea', amount: 2, unitAbbr: 'TBSP' }],
    }, unit)).toBe('Carrot 15 g, Pea 2 tbsp');
    // Only one food has an amount: its amount is the total, so no repeat
    expect(formatFoodLogAmountSummary({
      amount: 15, unitAbbr: 'G',
      foodItems: [{ name: 'Carrot', amount: 15, unitAbbr: 'G' }, { name: 'Pea' }],
    }, unit)).toBe('Carrot 15 g');
    expect(formatFoodLogAmountSummary({
      amount: 3, unitAbbr: 'TBSP', foodItems: [{ name: 'Carrot' }, { name: 'Pea' }],
    }, unit)).toBe('3 tbsp');
    expect(formatFoodLogAmountSummary({ amount: 2, unitAbbr: 'G', foodItems: [{ name: 'Carrot', amount: 2, unitAbbr: 'G' }] }, unit)).toBe('2 g');
    expect(formatFoodLogAmountSummary({ amount: null }, unit)).toBe('');
  });

  it('formats one food’s own details', () => {
    const labels = { unit, enjoyment: (v: string) => v.toLowerCase(), reaction: 'Reaction' };
    expect(formatFoodItemDetail({ amount: 2, unitAbbr: 'TBSP', enjoyment: 'LIKED', hadReaction: true, reactionDescription: 'hives' }, labels))
      .toBe('2 tbsp · liked · Reaction: hives');
    expect(formatFoodItemDetail({ hadReaction: true }, labels)).toBe('Reaction');
    expect(formatFoodItemDetail({ enjoyment: 'bogus' }, labels)).toBe('');
  });
});

describe('reports use per-food data', () => {
  const foods = [
    { id: 'carrot', name: 'Carrot' },
    { id: 'pea', name: 'Pea' },
  ];
  const meal = {
    foods: JSON.stringify([
      { foodId: 'carrot', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
      { foodId: 'pea', amount: 1, unitAbbr: 'TBSP', enjoyment: 'HATED', hadReaction: true, reactionDescription: 'rash' },
    ]),
    time: T1, amount: 3, unitAbbr: 'TBSP', enjoyment: 'NEUTRAL', hadReaction: true, reactionDescription: 'rash',
  };

  it('attributes a reaction only to the food that had it', () => {
    const allergens = deriveAllergens([meal], foods);
    expect(allergens.map(a => a.foodName)).toEqual(['Pea']);
    expect(allergens[0].reactions).toEqual([{ time: T1, description: 'rash' }]);
  });

  it('builds per-food try history from each food’s own amount and enjoyment', () => {
    const list = buildFoodTryList([{ ...meal, foodsById: Object.fromEntries(foods.map(f => [f.id, f])) }]);
    const byId = Object.fromEntries(list.map(e => [e.foodId, e]));
    expect(byId.carrot).toMatchObject({ totalAmounts: { tbsp: 2 }, latestEnjoyment: 'LOVED', hadReaction: false });
    expect(byId.pea).toMatchObject({ totalAmounts: { tbsp: 1 }, latestEnjoyment: 'HATED', hadReaction: true });
  });

  it('keeps old multi-food meals from inflating each food with the shared amount', () => {
    const list = buildFoodTryList([{ foods: '[{"foodId":"carrot"},{"foodId":"pea"}]', time: T1, amount: 3, unitAbbr: 'TBSP', enjoyment: 'LIKED' }]);
    expect(list.map(e => [e.totalAmounts, e.latestEnjoyment])).toEqual([[{}, 'LIKED'], [{}, 'LIKED']]);
  });

  it('reports each new food’s own enjoyment', () => {
    const entries = buildNewFoodsForRange([{ ...meal, foodsById: Object.fromEntries(foods.map(f => [f.id, f])) }], T1, T2);
    expect(entries.map(e => [e.foodName, e.enjoyment, e.hadReaction])).toEqual([
      ['Carrot', 'LOVED', false],
      ['Pea', 'HATED', true],
    ]);
  });

  it('counts per-food enjoyments in the breakdown, falling back to the meal’s for older rows', () => {
    const progress = computeFoodProgress([
      meal,
      { foods: '[{"foodId":"carrot"},{"foodId":"pea"}]', time: T2, enjoyment: 'LIKED' },
    ]);
    expect(progress.totalTries).toBe(2);
    expect(progress.countsByEnjoyment).toMatchObject({ LOVED: 1, HATED: 1, LIKED: 1, NEUTRAL: 0 });
  });
});

describe('rewriteFoodsJsonIds keeps per-food details on merge', () => {
  it('sums same-unit amounts and keeps the first enjoyment when source and target share a meal', () => {
    const json = JSON.stringify([
      { foodId: 'target', amount: 1, unitAbbr: 'TBSP' },
      { foodId: 'source', amount: 2, unitAbbr: 'tbsp', enjoyment: 'LIKED' },
    ]);
    expect(parseFoodsJson(rewriteFoodsJsonIds(json, 'source', 'target'))).toEqual([
      { foodId: 'target', hadReaction: false, reactionDescription: null, amount: 3, unitAbbr: 'TBSP', enjoyment: 'LIKED' },
    ]);
  });

  it('carries details through a plain id rewrite', () => {
    const json = JSON.stringify([{ foodId: 'source', amount: 2, unitAbbr: 'G', enjoyment: 'LOVED' }]);
    expect(parseFoodsJson(rewriteFoodsJsonIds(json, 'source', 'target'))).toEqual([
      { foodId: 'target', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'G', enjoyment: 'LOVED' },
    ]);
  });
});
