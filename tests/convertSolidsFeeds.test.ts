import { describe, it, expect } from 'vitest';
import {
  GENERIC_FOOD_NAME,
  normalizeFoodName,
  foodNameKey,
  resolveCatalogFoodName,
  composeReactionDescription,
  filterUnconverted,
  buildFoodLogData,
} from '../scripts/convert-solids-feeds-core';

// SOLIDS feed -> FoodLog conversion decision rules: catalog-name resolution
// (blank food text falls back to the reaction cause, then a generic 'Solids'
// entry), reaction-description composition (cause folded in as a prefix
// unless it became the food name), and the idempotency filter.

const baseFeed = {
  id: 'feed-1',
  time: new Date('2026-07-01T09:00:00Z'),
  babyId: 'baby-1',
  caretakerId: 'caretaker-1',
  familyId: 'family-1',
  hadReaction: false,
};

describe('normalizeFoodName / foodNameKey (parity with foodLogUtils)', () => {
  it('trims and collapses whitespace, preserving casing', () => {
    expect(normalizeFoodName('  Sweet   Potato ')).toBe('Sweet Potato');
    expect(normalizeFoodName(null)).toBe('');
    expect(normalizeFoodName(undefined)).toBe('');
  });

  it('keys case-insensitively', () => {
    expect(foodNameKey(' Sweet  POTATO ')).toBe('sweet potato');
  });

  it('strips leading/trailing punctuation junk, keeping interior punctuation', () => {
    expect(normalizeFoodName('. carrots')).toBe('carrots');
    expect(normalizeFoodName('"Peas",')).toBe('Peas');
    expect(normalizeFoodName('mac & cheese')).toBe('mac & cheese');
    expect(normalizeFoodName('banana-bread')).toBe('banana-bread');
    expect(foodNameKey('. Carrots')).toBe(foodNameKey('carrots'));
    expect(normalizeFoodName('...')).toBe('');
  });
});

describe('resolveCatalogFoodName', () => {
  it('uses the normalized food text when present', () => {
    expect(resolveCatalogFoodName({ ...baseFeed, food: '  Sweet  Potato ' }))
      .toEqual({ name: 'Sweet Potato', usedCause: false });
  });

  it('falls back to the reaction cause when the food text is blank', () => {
    expect(resolveCatalogFoodName({ ...baseFeed, food: '   ', reactionCause: 'Peanut butter' }))
      .toEqual({ name: 'Peanut butter', usedCause: true });
    expect(resolveCatalogFoodName({ ...baseFeed, food: null, reactionCause: 'Egg' }))
      .toEqual({ name: 'Egg', usedCause: true });
  });

  it('falls back to the generic Solids entry when both are blank', () => {
    expect(resolveCatalogFoodName({ ...baseFeed, food: '', reactionCause: '  ' }))
      .toEqual({ name: GENERIC_FOOD_NAME, usedCause: false });
    expect(resolveCatalogFoodName(baseFeed)).toEqual({ name: GENERIC_FOOD_NAME, usedCause: false });
  });
});

describe('composeReactionDescription', () => {
  it('prefixes the cause when it was not used as the food name', () => {
    expect(composeReactionDescription(
      { reactionCause: 'Similac', reactionDescription: 'Hives on cheeks' },
      false
    )).toBe('Cause: Similac. Hives on cheeks');
  });

  it('emits a cause-only description when there is no description text', () => {
    expect(composeReactionDescription({ reactionCause: 'Similac', reactionDescription: '  ' }, false))
      .toBe('Cause: Similac.');
  });

  it('omits the cause prefix when the cause became the food name', () => {
    expect(composeReactionDescription(
      { reactionCause: 'Peanut butter', reactionDescription: 'Redness' },
      true
    )).toBe('Redness');
  });

  it('returns null when nothing was recorded', () => {
    expect(composeReactionDescription({}, false)).toBeNull();
    expect(composeReactionDescription({ reactionDescription: '   ' }, true)).toBeNull();
  });
});

describe('filterUnconverted (idempotency guard)', () => {
  it('drops feeds whose id already appears in FoodLog.feedLogId', () => {
    const feeds = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(filterUnconverted(feeds, ['b'])).toEqual([{ id: 'a' }, { id: 'c' }]);
  });

  it('passes everything through when nothing was converted yet', () => {
    const feeds = [{ id: 'a' }];
    expect(filterUnconverted(feeds, [])).toEqual(feeds);
  });
});

describe('buildFoodLogData', () => {
  it('carries over time, amount, unit, notes, provenance, and ownership', () => {
    const data = buildFoodLogData({
      ...baseFeed,
      food: 'Carrot',
      amount: 2.5,
      unitAbbr: 'TBSP',
      notes: '  mashed  ',
    });
    expect(data).toEqual({
      time: baseFeed.time,
      amount: 2.5,
      unitAbbr: 'TBSP',
      notes: 'mashed',
      hadReaction: false,
      reactionDescription: null,
      babyId: 'baby-1',
      caretakerId: 'caretaker-1',
      familyId: 'family-1',
      feedLogId: 'feed-1',
      deletedAt: null,
    });
  });

  it('nulls non-positive or missing amounts and drops the orphaned unit', () => {
    expect(buildFoodLogData({ ...baseFeed, amount: 0, unitAbbr: 'G' })).toMatchObject({ amount: null, unitAbbr: null });
    expect(buildFoodLogData({ ...baseFeed, amount: null, unitAbbr: 'G' })).toMatchObject({ amount: null, unitAbbr: null });
  });

  it('composes the reaction description with the cause prefix for named foods', () => {
    const data = buildFoodLogData({
      ...baseFeed,
      food: 'Carrot',
      hadReaction: true,
      reactionCause: 'Carrot skin',
      reactionDescription: 'Rash',
    });
    expect(data.hadReaction).toBe(true);
    expect(data.reactionDescription).toBe('Cause: Carrot skin. Rash');
  });

  it('skips the cause prefix when the cause doubles as the food name', () => {
    const data = buildFoodLogData({
      ...baseFeed,
      food: '',
      hadReaction: true,
      reactionCause: 'Egg',
      reactionDescription: 'Swelling',
    });
    expect(data.reactionDescription).toBe('Swelling');
  });

  it('preserves soft deletion and tolerates missing optional fields', () => {
    const deletedAt = new Date('2026-07-02T00:00:00Z');
    const data = buildFoodLogData({ ...baseFeed, caretakerId: null, familyId: null, deletedAt });
    expect(data.deletedAt).toBe(deletedAt);
    expect(data.caretakerId).toBeNull();
    expect(data.familyId).toBeNull();
  });
});
