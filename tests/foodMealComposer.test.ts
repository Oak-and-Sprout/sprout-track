import { describe, it, expect } from 'vitest';
import {
  formatFoodTagAmount,
  formatMealTotal,
  canSaveEntry,
  clearEntry,
  loadEntry,
  commitEntry,
  removeFood,
  editingAfterRemove,
  seedMealAmounts,
  mealRowAmount,
  withSingleFoodReaction,
  type MealFood,
  type FoodEntry,
} from '@/src/utils/foodMealComposer';
import { buildMealItems } from '@/src/utils/foodLogUtils';

/**
 * The Food Tracker's meal composer (#271): one food is composed at a time in
 * the entry box (name, amount, unit) and Save turns it into a tag. Tapping a
 * tag loads it back into the box for editing; Save writes it back in place.
 */

const unit = (abbr: string) => abbr.toLowerCase();
const food = (name: string, amount = '', unitAbbr = 'G', extra: Partial<MealFood> = {}): MealFood => ({
  foodId: `id-${name}`,
  name,
  commonAllergen: false,
  isNew: false,
  hadReaction: false,
  reactionDescription: '',
  enjoyment: null,
  amount,
  unitAbbr,
  ...extra,
});
const entry = (name: string, amount = '', unitAbbr = 'G', commonAllergen = false): FoodEntry => ({ name, amount, unitAbbr, commonAllergen });
const catalog = [
  { id: 'id-Carrot', name: 'Carrot', commonAllergen: false },
  { id: 'id-Egg', name: 'Egg', commonAllergen: true },
  { id: 'id-Pea', name: 'Pea', commonAllergen: false },
];

describe('formatFoodTagAmount', () => {
  it('formats a positive amount with its unit', () => {
    expect(formatFoodTagAmount({ amount: '15', unitAbbr: 'G' }, unit)).toBe('15 g');
    expect(formatFoodTagAmount({ amount: '1.50', unitAbbr: 'TBSP' }, unit)).toBe('1.5 tbsp');
  });

  it.each(['', '  ', '0', '.', 'abc'])('is empty for %j', amount => {
    expect(formatFoodTagAmount({ amount, unitAbbr: 'G' }, unit)).toBe('');
  });
});

describe('formatMealTotal', () => {
  it('sums per-food amounts of one unit', () => {
    expect(formatMealTotal([food('A', '15'), food('B', '10')])).toBe('25 g');
  });

  it('totals per unit when units are mixed', () => {
    expect(formatMealTotal([food('A', '15'), food('B', '2', 'TBSP'), food('C', '1', 'TBSP')])).toBe('15 g, 3 tbsp');
  });

  it('is empty for a single food or when no food has an amount', () => {
    expect(formatMealTotal([food('A', '15')])).toBe('');
    expect(formatMealTotal([food('A'), food('B')])).toBe('');
  });
});

describe('canSaveEntry', () => {
  it('needs a name', () => {
    expect(canSaveEntry(entry('Carrot'))).toBe(true);
    expect(canSaveEntry(entry(''))).toBe(false);
    expect(canSaveEntry(entry('   ', '5'))).toBe(false);
  });
});

describe('clearEntry', () => {
  it('empties the name, amount and allergen flag but keeps the unit', () => {
    expect(clearEntry(entry('Kiwi', '5', 'G', true))).toEqual(entry('', '', 'G', false));
  });
});

describe('loadEntry', () => {
  it("loads a tag's name, amount, unit and allergen flag into the box", () => {
    const meal = [food('Carrot', '15'), food('Kiwi', '2', 'TBSP', { isNew: true, commonAllergen: true, foodId: undefined })];
    expect(loadEntry(meal, 1)).toEqual(entry('Kiwi', '2', 'TBSP', true));
  });
});

describe('commitEntry', () => {
  it('adds a catalog food as a new tag with the entry amount', () => {
    expect(commitEntry([], entry(' carrot ', '15.'), null, catalog)).toEqual([food('Carrot', '15')]);
  });

  it('adds a new food (not in the catalog) with the allergen flag from the box', () => {
    expect(commitEntry([food('Carrot')], entry('  Kiwi  fruit ', '', 'G', true), null, catalog)).toEqual([
      food('Carrot'),
      food('Kiwi fruit', '', 'G', { foodId: undefined, isNew: true, commonAllergen: true }),
    ]);
  });

  it('takes the catalog allergen flag for an existing food', () => {
    expect(commitEntry([], entry('egg'), null, catalog)[0].commonAllergen).toBe(true);
  });

  it('returns the same meal when the name is empty', () => {
    const meal = [food('Carrot')];
    expect(commitEntry(meal, entry('  ', '5'), null, catalog)).toBe(meal);
    expect(commitEntry(meal, entry(''), 0, catalog)).toBe(meal);
  });

  it('merges a food already in the meal instead of adding it twice', () => {
    const meal = [food('Carrot', '15'), food('Pea')];
    expect(commitEntry(meal, entry('carrot', '20'), null, catalog)).toEqual([food('Carrot', '20'), food('Pea')]);
  });

  it('keeps the existing amount when a food already in the meal is re-entered without one', () => {
    const meal = [food('Carrot', '15')];
    expect(commitEntry(meal, entry('Carrot'), null, catalog)).toEqual(meal);
  });

  it('updates the edited tag in place, including clearing its amount', () => {
    const meal = [food('Carrot', '15'), food('Pea', '10')];
    expect(commitEntry(meal, entry('Carrot', '2', 'TBSP'), 0, catalog)).toEqual([food('Carrot', '2', 'TBSP'), food('Pea', '10')]);
    expect(commitEntry(meal, entry('Carrot', ''), 0, catalog)[0].amount).toBe('');
  });

  it('renames the edited tag, keeping its position and per-food data', () => {
    const meal = [food('Carrot', '15', 'G', { hadReaction: true, reactionDescription: 'hives', enjoyment: 'LOVED' }), food('Pea')];
    const next = commitEntry(meal, entry('Egg', '15'), 0, catalog);
    expect(next).toEqual([
      food('Egg', '15', 'G', { commonAllergen: true, hadReaction: true, reactionDescription: 'hives', enjoyment: 'LOVED' }),
      food('Pea'),
    ]);
  });

  it('renames the edited tag to a new food, dropping its catalog id', () => {
    const next = commitEntry([food('Carrot', '15')], entry('Kiwi', '15', 'G', true), 0, catalog);
    expect(next).toEqual([food('Kiwi', '15', 'G', { foodId: undefined, isNew: true, commonAllergen: true })]);
  });

  it('renaming onto another food in the meal merges into that food', () => {
    const meal = [food('Carrot', '15'), food('Pea', '10'), food('Egg')];
    expect(commitEntry(meal, entry('Pea', '20'), 0, catalog)).toEqual([food('Pea', '20'), food('Egg', '', 'G', { commonAllergen: false })]);
  });

  it('ignores an editing index that no longer exists (adds instead)', () => {
    expect(commitEntry([food('Carrot')], entry('Pea'), 5, catalog)).toEqual([food('Carrot'), food('Pea')]);
  });
});

describe('removeFood', () => {
  it('removes the tag at the index', () => {
    const meal = [food('A', '1'), food('B', '2'), food('C', '3')];
    expect(removeFood(meal, 1, null)).toEqual({ meal: [food('A', '1'), food('C', '3')], shared: null });
  });

  it('keeps a pre-#271 shared amount while two or more foods remain', () => {
    const shared = { amount: '2', unitAbbr: 'TBSP' };
    expect(removeFood([food('A'), food('B'), food('C')], 0, shared)).toEqual({ meal: [food('B'), food('C')], shared });
  });

  it('folds a shared amount onto the last food left', () => {
    const shared = { amount: '2', unitAbbr: 'TBSP' };
    expect(removeFood([food('A'), food('B')], 0, shared)).toEqual({ meal: [food('B', '2', 'TBSP')], shared: null });
  });

  it('drops a shared amount once any food had its own (it no longer describes the meal)', () => {
    const shared = { amount: '2', unitAbbr: 'TBSP' };
    expect(removeFood([food('A', '5'), food('B')], 0, shared)).toEqual({ meal: [food('B')], shared: null });
  });
});

describe('editingAfterRemove', () => {
  it('stops editing when the edited tag is removed', () => {
    expect(editingAfterRemove(1, 1)).toBeNull();
  });

  it('follows the edited tag when an earlier one is removed', () => {
    expect(editingAfterRemove(2, 0)).toBe(1);
    expect(editingAfterRemove(0, 2)).toBe(0);
    expect(editingAfterRemove(null, 0)).toBeNull();
  });
});

describe('seedMealAmounts (loading a saved entry)', () => {
  it("puts a single-food entry's row amount on its tag", () => {
    expect(seedMealAmounts([food('Carrot')], { amount: '3', unitAbbr: 'TBSP' })).toEqual({
      meal: [food('Carrot', '3', 'TBSP')],
      shared: null,
    });
  });

  it('keeps per-food amounts of a multi-food entry', () => {
    const meal = [food('A', '15'), food('B', '10')];
    expect(seedMealAmounts(meal, { amount: '25', unitAbbr: 'G' })).toEqual({ meal, shared: null });
  });

  it('keeps a pre-#271 multi-food row amount as the shared amount', () => {
    const meal = [food('A'), food('B')];
    expect(seedMealAmounts(meal, { amount: '2', unitAbbr: 'TBSP' })).toEqual({ meal, shared: { amount: '2', unitAbbr: 'TBSP' } });
  });

  it('has no shared amount when the row has none', () => {
    expect(seedMealAmounts([food('A'), food('B')], { amount: '', unitAbbr: 'G' }).shared).toBeNull();
  });
});

describe('mealRowAmount', () => {
  it("is the single food's own amount", () => {
    expect(mealRowAmount([food('A', '3', 'TBSP')], null)).toEqual({ amount: 3, unitAbbr: 'TBSP' });
    expect(mealRowAmount([food('A')], null)).toBeNull();
  });

  it('is left to the server when foods carry their own amounts', () => {
    expect(mealRowAmount([food('A', '15'), food('B')], { amount: '2', unitAbbr: 'TBSP' })).toBeNull();
  });

  it('keeps a pre-#271 shared amount while no food has its own', () => {
    expect(mealRowAmount([food('A'), food('B')], { amount: '2', unitAbbr: 'TBSP' })).toEqual({ amount: 2, unitAbbr: 'TBSP' });
    expect(mealRowAmount([food('A'), food('B')], null)).toBeNull();
  });
});

describe('withSingleFoodReaction', () => {
  it('flags the only food when the meal reaction switch is on', () => {
    expect(withSingleFoodReaction([food('A')], true)).toEqual([food('A', '', 'G', { hadReaction: true })]);
  });

  it('leaves the meal alone otherwise', () => {
    const one = [food('A')];
    const two = [food('A'), food('B')];
    expect(withSingleFoodReaction(one, false)).toBe(one);
    expect(withSingleFoodReaction(two, true)).toBe(two);
  });
});

describe('composer flows (storage semantics)', () => {
  const save = (meal: MealFood[], shared: { amount: string; unitAbbr: string } | null = null) => ({
    row: mealRowAmount(meal, shared),
    items: buildMealItems({
      tags: meal.map(tag => ({ ...tag, foodId: tag.foodId || 'new', amount: parseFloat(tag.amount), unitAbbr: tag.unitAbbr })),
      mealReaction: false,
    }),
  });

  it('one food is stored as a single-food entry: row amount, no per-food values', () => {
    const meal = commitEntry([], entry('Carrot', '15'), null, catalog);
    expect(save(meal)).toEqual({ row: { amount: 15, unitAbbr: 'G' }, items: [{ foodId: 'id-Carrot', hadReaction: false, reactionDescription: null }] });
  });

  it('two foods are stored per food, the row left to the server', () => {
    let meal = commitEntry([], entry('Carrot', '15'), null, catalog);
    meal = commitEntry(meal, entry('Pea', '10'), null, catalog);
    const { row, items } = save(meal);
    expect(row).toBeNull();
    expect(items.map(item => [item.foodId, item.amount, item.unitAbbr])).toEqual([['id-Carrot', 15, 'G'], ['id-Pea', 10, 'G']]);
  });

  it('back to one food folds into a single-food entry again', () => {
    const meal = removeFood([food('Carrot', '15'), food('Pea', '10')], 1, null).meal;
    expect(save(meal)).toEqual({ row: { amount: 15, unitAbbr: 'G' }, items: [{ foodId: 'id-Carrot', hadReaction: false, reactionDescription: null }] });
  });

  it('the footer Save commits a food still in the box', () => {
    const meal = [food('Carrot', '15')];
    expect(commitEntry(meal, entry('Pea', '10'), null, catalog)).toHaveLength(2);
    expect(commitEntry(meal, entry('Carrot', '20'), 0, catalog)).toEqual([food('Carrot', '20')]);
  });

  it('cancelling an edit leaves the tag unchanged and the box empty', () => {
    const meal = [food('Carrot', '15')];
    const box = clearEntry(loadEntry(meal, 0));
    expect(commitEntry(meal, box, null, catalog)).toBe(meal);
  });
});
