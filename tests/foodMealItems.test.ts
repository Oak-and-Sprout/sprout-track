import { describe, it, expect } from 'vitest';
import { buildMealItems, mealHasAnyReaction, type MealTagInput } from '@/src/utils/foodLogUtils';

/**
 * Regression coverage for the FoodForm submit path (#247).
 *
 * The original inline logic in LogFoodTab branched on `selectedFoods.length === 1`
 * and, in that branch, hard-coded `hadReaction: true` from the meal-level switch
 * while reading the description from meal-level state. Because the switch is
 * seeded during edit-init as "did ANY food in this meal react", editing a
 * multi-food meal down to a single food wrote a reaction onto a food that never
 * had one — corrupting the derived allergen profile.
 *
 * The rule these tests pin down: a food is only ever recorded as having reacted
 * if THAT FOOD carries the flag. The meal-level switch can suppress reactions
 * but must never invent one.
 */

const tag = (over: Partial<MealTagInput> & { foodId: string }): MealTagInput => ({
  hadReaction: false,
  reactionDescription: null,
  ...over,
});

describe('buildMealItems', () => {
  it('records no reactions when the meal-level switch is off', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'peanut', hadReaction: true, reactionDescription: 'hives' })],
      mealReaction: false,
    });
    expect(items).toEqual([
      { foodId: 'peanut', hadReaction: false, reactionDescription: null },
    ]);
  });

  it('carries a single food reaction through from its own tag', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'peanut', hadReaction: true, reactionDescription: 'hives' })],
      mealReaction: true,
    });
    expect(items).toEqual([
      { foodId: 'peanut', hadReaction: true, reactionDescription: 'hives' },
    ]);
  });

  it('flags only the foods whose own tag reacted', () => {
    const items = buildMealItems({
      tags: [
        tag({ foodId: 'banana' }),
        tag({ foodId: 'peanut', hadReaction: true, reactionDescription: 'hives' }),
        tag({ foodId: 'avocado' }),
      ],
      mealReaction: true,
    });
    expect(items.map(i => i.hadReaction)).toEqual([false, true, false]);
    expect(items[1].reactionDescription).toBe('hives');
    expect(items[0].reactionDescription).toBeNull();
  });

  // The B1 regression: [Banana(no reaction), Peanut(hives)] edited down to [Banana].
  // The meal-level switch is still ON (it was seeded from Peanut), and the
  // meal-level description was blanked at init because the meal was multi-food.
  it('does not invent a reaction when a multi-food meal is reduced to one food', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'banana' })],
      mealReaction: true,
    });
    expect(items).toEqual([
      { foodId: 'banana', hadReaction: false, reactionDescription: null },
    ]);
  });

  // The other half of B1: the surviving food's own description must not be lost.
  it('keeps the surviving food reaction description when reduced to one food', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'peanut', hadReaction: true, reactionDescription: 'hives' })],
      mealReaction: true,
    });
    expect(items[0].reactionDescription).toBe('hives');
  });

  it('trims descriptions and treats whitespace-only as absent', () => {
    const items = buildMealItems({
      tags: [
        tag({ foodId: 'a', hadReaction: true, reactionDescription: '  swelling  ' }),
        tag({ foodId: 'b', hadReaction: true, reactionDescription: '   ' }),
      ],
      mealReaction: true,
    });
    expect(items[0].reactionDescription).toBe('swelling');
    expect(items[1].reactionDescription).toBeNull();
  });

  it('drops a description when the tag itself did not react', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'banana', hadReaction: false, reactionDescription: 'stale text' })],
      mealReaction: true,
    });
    expect(items[0].reactionDescription).toBeNull();
  });

  it('skips tags with an empty foodId', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: '' }), tag({ foodId: 'banana' })],
      mealReaction: true,
    });
    expect(items).toHaveLength(1);
    expect(items[0].foodId).toBe('banana');
  });

  it('returns an empty list for no tags', () => {
    expect(buildMealItems({ tags: [], mealReaction: true })).toEqual([]);
  });
});

describe('mealHasAnyReaction', () => {
  // Drives the "auto-clear the switch on save when no food is flagged" behaviour.
  it('is false when the switch is on but no food is flagged', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'a' }), tag({ foodId: 'b' })],
      mealReaction: true,
    });
    expect(mealHasAnyReaction(items)).toBe(false);
  });

  it('is true when at least one food is flagged', () => {
    const items = buildMealItems({
      tags: [tag({ foodId: 'a' }), tag({ foodId: 'b', hadReaction: true })],
      mealReaction: true,
    });
    expect(mealHasAnyReaction(items)).toBe(true);
  });

  it('is false for an empty meal', () => {
    expect(mealHasAnyReaction([])).toBe(false);
  });
});
