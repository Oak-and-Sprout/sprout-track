import { describe, it, expect } from 'vitest';
import {
  formatFoodTagAmount,
  isAmountDraftDirty,
  applyAmountDraft,
  addFoodTagToMeal,
  selectionAfterRemove,
  formatMealTotal,
} from '@/src/utils/foodMealComposer';

/**
 * The multi-food meal composer (#271): each food tag carries its own amount,
 * edited through the shared Amount stepper as a pending draft that the Update
 * button (or switching tags / saving) commits to the selected tag.
 */

const unit = (abbr: string) => abbr.toLowerCase();
const tag = (amount: string, unitAbbr = 'G', name = 'x') => ({ name, amount, unitAbbr });

describe('formatFoodTagAmount', () => {
  it('formats a positive amount with its unit', () => {
    expect(formatFoodTagAmount({ amount: '15', unitAbbr: 'G' }, unit)).toBe('15 g');
    expect(formatFoodTagAmount({ amount: '1.50', unitAbbr: 'TBSP' }, unit)).toBe('1.5 tbsp');
  });

  it.each(['', '  ', '0', '.', 'abc'])('is empty for %j', amount => {
    expect(formatFoodTagAmount({ amount, unitAbbr: 'G' }, unit)).toBe('');
  });
});

describe('isAmountDraftDirty', () => {
  it('is clean when the draft matches the saved value', () => {
    expect(isAmountDraftDirty(tag('15'), tag('15'))).toBe(false);
    expect(isAmountDraftDirty(tag('15.0'), tag('15'))).toBe(false);
  });

  it('is dirty when the amount or unit changed', () => {
    expect(isAmountDraftDirty(tag('20'), tag('15'))).toBe(true);
    expect(isAmountDraftDirty(tag('15', 'TBSP'), tag('15', 'G'))).toBe(true);
    expect(isAmountDraftDirty(tag('15'), tag(''))).toBe(true);
    expect(isAmountDraftDirty(tag(''), tag('15'))).toBe(true);
  });

  it('ignores a unit change while neither side has an amount', () => {
    expect(isAmountDraftDirty(tag('', 'TBSP'), tag('', 'G'))).toBe(false);
    expect(isAmountDraftDirty(tag('0', 'TBSP'), tag('', 'G'))).toBe(false);
  });
});

describe('applyAmountDraft', () => {
  const tags = [tag('', 'G', 'Carrot'), tag('10', 'G', 'Cheese')];

  it('writes the normalized draft onto the selected tag only', () => {
    expect(applyAmountDraft(tags, 0, { amount: '15.', unitAbbr: 'G' })).toEqual([
      tag('15', 'G', 'Carrot'),
      tags[1],
    ]);
  });

  it('clears the amount when the draft is blank or zero', () => {
    expect(applyAmountDraft(tags, 1, { amount: '0', unitAbbr: 'G' })[1]).toEqual(tag('', 'G', 'Cheese'));
  });

  it('returns the same array when there is nothing to apply', () => {
    expect(applyAmountDraft(tags, null, { amount: '5', unitAbbr: 'G' })).toBe(tags);
    expect(applyAmountDraft(tags, 5, { amount: '5', unitAbbr: 'G' })).toBe(tags);
    expect(applyAmountDraft(tags, 1, { amount: '10', unitAbbr: 'G' })).toBe(tags);
  });
});

describe('addFoodTagToMeal', () => {
  it('moves the meal amount onto the first food when a second food arrives', () => {
    const next = addFoodTagToMeal([tag('', 'TBSP', 'Carrot')], tag('', 'G', 'Cheese'), { amount: '2', unitAbbr: 'TBSP' });
    expect(next).toEqual([tag('2', 'TBSP', 'Carrot'), tag('', 'G', 'Cheese')]);
  });

  it('lets the meal amount win over a stale per-food amount on the single food', () => {
    const next = addFoodTagToMeal([tag('9', 'G', 'Carrot')], tag('', 'G', 'Cheese'), { amount: '', unitAbbr: 'G' });
    expect(next[0]).toEqual(tag('', 'G', 'Carrot'));
  });

  it('just appends otherwise', () => {
    expect(addFoodTagToMeal([], tag('', 'G', 'Carrot'), { amount: '3', unitAbbr: 'G' })).toEqual([tag('', 'G', 'Carrot')]);
    const two = [tag('1', 'G', 'A'), tag('2', 'G', 'B')];
    expect(addFoodTagToMeal(two, tag('', 'G', 'C'), { amount: '3', unitAbbr: 'G' })).toEqual([...two, tag('', 'G', 'C')]);
  });
});

describe('selectionAfterRemove', () => {
  it('selects nothing once fewer than two foods remain (single-food path)', () => {
    expect(selectionAfterRemove(0, 1, 1)).toBeNull();
    expect(selectionAfterRemove(1, 1, 1)).toBeNull();
  });

  it('keeps the same food selected when another one is removed', () => {
    expect(selectionAfterRemove(2, 0, 2)).toBe(1);
    expect(selectionAfterRemove(0, 2, 2)).toBe(0);
  });

  it('selects a neighbour when the selected food is removed', () => {
    expect(selectionAfterRemove(1, 1, 2)).toBe(1);
    expect(selectionAfterRemove(2, 2, 2)).toBe(1);
  });

  it('falls back to the first food when nothing was selected', () => {
    expect(selectionAfterRemove(null, 0, 2)).toBe(0);
  });
});

describe('formatMealTotal', () => {
  it('sums per-food amounts of one unit', () => {
    expect(formatMealTotal([tag('15'), tag('10')])).toBe('25 g');
  });

  it('totals per unit when units are mixed', () => {
    expect(formatMealTotal([tag('15', 'G'), tag('2', 'TBSP'), tag('1', 'TBSP')])).toBe('15 g, 3 tbsp');
  });

  it('skips foods without an amount', () => {
    expect(formatMealTotal([tag('15'), tag('')])).toBe('15 g');
  });

  it('is empty for a single food or when no food has an amount', () => {
    expect(formatMealTotal([tag('15')])).toBe('');
    expect(formatMealTotal([tag(''), tag('')])).toBe('');
  });
});
