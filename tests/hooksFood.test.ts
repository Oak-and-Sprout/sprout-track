import { describe, expect, it } from 'vitest';
import {
  formatFoodDetails,
  parseEnjoyment,
  parseFoodAmount,
  parseFoodItemInputs,
  planFoodItems,
  planFoodUnit,
  planItemUnits,
} from '../app/api/hooks/v1/food';

describe('parseFoodItemInputs', () => {
  it('returns no items when no food field is sent', () => {
    expect(parseFoodItemInputs({ type: 'food', amount: 2 })).toEqual({});
  });

  it('parses the single-food shorthand by name, normalizing the name', () => {
    expect(parseFoodItemInputs({ foodName: '  . sweet   potato ' })).toEqual({
      items: [{ name: 'sweet potato', hadReaction: false, reactionDescription: null }],
    });
  });

  it('parses the single-food shorthand by catalog id with a reaction', () => {
    expect(parseFoodItemInputs({ foodId: 'food-1', hadReaction: true, reactionDescription: ' hives ' })).toEqual({
      items: [{ foodId: 'food-1', hadReaction: true, reactionDescription: 'hives' }],
    });
  });

  it('parses foods[] with string and object entries', () => {
    expect(parseFoodItemInputs({ foods: ['Banana', { foodId: 'food-2', hadReaction: true }] })).toEqual({
      items: [
        { name: 'Banana', hadReaction: false, reactionDescription: null },
        { foodId: 'food-2', hadReaction: true, reactionDescription: null },
      ],
    });
  });

  it('parses per-food amount, unit and enjoyment on foods[] objects', () => {
    expect(parseFoodItemInputs({ foods: [{ name: 'Carrot', amount: '2', unitAbbr: ' tbsp ', enjoyment: 'loved' }, { foodId: 'food-2', enjoyment: null }, 'Pea'] })).toEqual({
      items: [
        { name: 'Carrot', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'tbsp', enjoyment: 'LOVED' },
        { foodId: 'food-2', hadReaction: false, reactionDescription: null, enjoyment: null },
        { name: 'Pea', hadReaction: false, reactionDescription: null },
      ],
    });
  });

  it('keeps per-food details off the single-food shorthand (those are the meal fields)', () => {
    expect(parseFoodItemInputs({ foodName: 'Carrot', amount: 2, enjoyment: 'LOVED' })).toEqual({
      items: [{ name: 'Carrot', hadReaction: false, reactionDescription: null }],
    });
  });

  it.each([
    [{ foodName: 'Banana', foodId: 'food-1' }, 'exactly one of foodId or foodName'],
    [{ foodName: '  ..  ' }, 'foodName must be a non-empty string'],
    [{ foodName: 5 }, 'foodName must be a non-empty string'],
    [{ foodId: '' }, 'foodId must be a non-empty string'],
    [{ foodName: 'Egg', hadReaction: 'yes' }, 'hadReaction must be a boolean'],
    [{ foodName: 'Egg', reactionDescription: 3 }, 'reactionDescription must be a string'],
    [{ foodName: 'Egg', reactionDescription: 'rash' }, 'reactionDescription requires hadReaction: true'],
    [{ hadReaction: true }, 'require foodName or foodId'],
    [{ foods: [] }, 'foods must be a non-empty array'],
    [{ foods: 'Banana' }, 'foods must be a non-empty array'],
    [{ foods: ['Banana'], foodName: 'Egg' }, 'not both'],
    [{ foods: ['Banana'], hadReaction: true }, 'not both'],
    [{ foods: [42] }, 'foods[0] must be a food name or an object'],
    [{ foods: [{ name: 'Egg', grams: 2 }] }, 'Unsupported field(s) in foods[0]: grams'],
    [{ foods: [{ name: 'Egg', amount: 0 }] }, 'foods[0]: amount must be a positive number'],
    [{ foods: [{ name: 'Egg', unitAbbr: 'G' }] }, 'foods[0]: unitAbbr requires an amount'],
    [{ foods: [{ name: 'Egg', amount: 1, unitAbbr: 5 }] }, 'foods[0]: unitAbbr must be a string'],
    [{ foods: [{ name: 'Egg', amount: 1, unitAbbr: 'a-very-long-unit-name' }] }, 'Invalid unit'],
    [{ foods: ['Egg', { name: 'Milk', enjoyment: 'meh' }] }, 'foods[1]: enjoyment must be one of'],
    [{ foods: ['Egg', { name: 'Milk', foodId: 'food-1' }] }, 'foods[1]: send exactly one of foodId or name'],
  ])('rejects %j', (body, message) => {
    const result = parseFoodItemInputs(body as Record<string, unknown>);
    expect(result.items).toBeUndefined();
    expect(result.error).toContain(message);
  });
});

describe('planFoodItems', () => {
  const catalog = [
    { id: 'food-banana', name: 'Banana' },
    { id: 'food-egg', name: 'Egg' },
  ];

  it('matches names case-insensitively against the family catalog', () => {
    const plan = planFoodItems([{ name: 'BANANA', hadReaction: false, reactionDescription: null }], catalog);
    expect(plan).toEqual({
      items: [{ foodId: 'food-banana', hadReaction: false, reactionDescription: null }],
      newNames: [],
    });
  });

  it('lists unknown names for creation, keeping the first casing and deduplicating', () => {
    const plan = planFoodItems([
      { name: 'Avocado', hadReaction: false, reactionDescription: null },
      { name: 'avocado', hadReaction: true, reactionDescription: 'rash' },
    ], catalog);
    expect(plan.newNames).toEqual(['Avocado']);
    expect(plan.items).toEqual([{ name: 'Avocado', hadReaction: true, reactionDescription: 'rash' }]);
  });

  it('merges an id and a name that resolve to the same food', () => {
    const plan = planFoodItems([
      { foodId: 'food-egg', hadReaction: false, reactionDescription: null },
      { name: 'egg', hadReaction: true, reactionDescription: null },
    ], catalog);
    expect(plan.items).toEqual([{ foodId: 'food-egg', hadReaction: true, reactionDescription: null }]);
  });

  it('keeps the first per-food details sent for a food listed twice, filling gaps from later entries', () => {
    const plan = planFoodItems([
      { name: 'egg', hadReaction: false, reactionDescription: null, amount: 1, unitAbbr: 'G' },
      { foodId: 'food-egg', hadReaction: false, reactionDescription: null, amount: 5, unitAbbr: 'TBSP', enjoyment: 'LIKED' },
    ], catalog);
    expect(plan.items).toEqual([{ foodId: 'food-egg', hadReaction: false, reactionDescription: null, amount: 1, unitAbbr: 'G', enjoyment: 'LIKED' }]);
  });

  it('rejects a foodId outside the family catalog', () => {
    const plan = planFoodItems([{ foodId: 'food-other-family', hadReaction: false, reactionDescription: null }], catalog);
    expect(plan.error).toBe("Food 'food-other-family' not found in this family");
  });
});

describe('parseFoodAmount', () => {
  it('distinguishes omitted from null', () => {
    expect(parseFoodAmount(undefined)).toEqual({});
    expect(parseFoodAmount(null)).toEqual({ value: null });
  });

  it('accepts positive numbers and numeric strings', () => {
    expect(parseFoodAmount(2.5)).toEqual({ value: 2.5 });
    expect(parseFoodAmount('3')).toEqual({ value: 3 });
  });

  it.each([0, -1, 'abc', '', Infinity, true])('rejects %j', (value) => {
    expect(parseFoodAmount(value).error).toBe('amount must be a positive number');
  });
});

describe('parseEnjoyment', () => {
  it('normalizes case-insensitively and allows null', () => {
    expect(parseEnjoyment('loved')).toEqual({ value: 'LOVED' });
    expect(parseEnjoyment(null)).toEqual({ value: null });
    expect(parseEnjoyment(undefined)).toEqual({});
  });

  it('rejects unknown values, listing the valid ones', () => {
    expect(parseEnjoyment('meh').error).toBe('enjoyment must be one of: HATED, DISLIKED, NEUTRAL, LIKED, LOVED');
  });
});

describe('planFoodUnit', () => {
  it('stores no unit without an amount', () => {
    expect(planFoodUnit(null, null)).toEqual({ unitAbbr: null });
    expect(planFoodUnit(undefined, null)).toEqual({ unitAbbr: null });
  });

  it('rejects a unit without an amount', () => {
    expect(planFoodUnit(null, 'TBSP').error).toBe('unitAbbr requires an amount');
    expect(planFoodUnit(undefined, 'TBSP', { amount: null, unitAbbr: null }).error).toBe('unitAbbr requires an amount');
  });

  it('uses the sent unit with an amount', () => {
    expect(planFoodUnit(2, 'G')).toEqual({ unitAbbr: 'G' });
    expect(planFoodUnit(undefined, 'G', { amount: 2, unitAbbr: 'TBSP' })).toEqual({ unitAbbr: 'G' });
  });

  it('falls back to the family default unit when an amount has none', () => {
    expect(planFoodUnit(2, null)).toEqual({ useDefault: true });
    expect(planFoodUnit(2, null, { amount: null, unitAbbr: null })).toEqual({ useDefault: true });
  });

  it('keeps the existing unit when only the amount changes', () => {
    expect(planFoodUnit(3, null, { amount: 2, unitAbbr: 'G' })).toEqual({});
  });

  it('clears the unit when the amount is cleared', () => {
    expect(planFoodUnit(null, null, { amount: 2, unitAbbr: 'G' })).toEqual({ unitAbbr: null });
  });
});

describe('planItemUnits', () => {
  const units = ['TBSP', 'G', 'OZ'];

  it('resolves per-food units to their canonical casing and gives amounts without one the default', () => {
    expect(planItemUnits([
      { name: 'Carrot', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'tbsp' },
      { name: 'Pea', hadReaction: false, reactionDescription: null, amount: 1 },
      { name: 'Egg', hadReaction: false, reactionDescription: null },
    ], units, 'G')).toEqual({
      items: [
        { name: 'Carrot', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'TBSP' },
        { name: 'Pea', hadReaction: false, reactionDescription: null, amount: 1, unitAbbr: 'G' },
        { name: 'Egg', hadReaction: false, reactionDescription: null },
      ],
    });
  });

  it('rejects an unknown per-food unit, naming the entry and the valid units', () => {
    expect(planItemUnits([
      { name: 'Egg', hadReaction: false, reactionDescription: null },
      { name: 'Carrot', hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'cups' },
    ], units, 'G').error).toBe('foods[1]: unitAbbr must be one of: TBSP, G, OZ');
  });
});

describe('formatFoodDetails', () => {
  const catalog = new Map([
    ['food-1', { id: 'food-1', name: 'Banana', commonAllergen: false }],
    ['food-2', { id: 'food-2', name: 'Peanut', commonAllergen: true }],
  ]);

  it('expands a multi-food meal from the foods JSON', () => {
    const details = formatFoodDetails({
      time: new Date('2026-10-12T10:00:00Z'),
      foodId: null,
      foods: JSON.stringify([{ foodId: 'food-1', amount: 2, unitAbbr: 'TBSP' }, { foodId: 'food-2', hadReaction: true, reactionDescription: 'hives', enjoyment: 'LOVED' }]),
      amount: 2,
      unitAbbr: 'TBSP',
      enjoyment: 'LIKED',
      hadReaction: true,
      reactionDescription: 'hives',
      notes: null,
    }, catalog);
    expect(details).toEqual({
      foods: [
        { foodId: 'food-1', name: 'Banana', commonAllergen: false, hadReaction: false, reactionDescription: null, amount: 2, unitAbbr: 'TBSP', enjoyment: null },
        { foodId: 'food-2', name: 'Peanut', commonAllergen: true, hadReaction: true, reactionDescription: 'hives', amount: null, unitAbbr: null, enjoyment: 'LOVED' },
      ],
      amount: 2,
      unitAbbr: 'TBSP',
      enjoyment: 'LIKED',
      hadReaction: true,
      reactionDescription: 'hives',
      notes: null,
    });
  });

  it('synthesizes the item from a legacy single-food row', () => {
    const details = formatFoodDetails({
      time: new Date('2026-10-12T10:00:00Z'),
      foodId: 'food-1',
      foods: null,
      hadReaction: false,
    }, catalog);
    expect(details.foods).toEqual([
      { foodId: 'food-1', name: 'Banana', commonAllergen: false, hadReaction: false, reactionDescription: null, amount: null, unitAbbr: null, enjoyment: null },
    ]);
  });
});
