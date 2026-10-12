import { describe, it, expect, vi } from 'vitest';
import { foodNameKey as appFoodNameKey } from '@/src/utils/foodLogUtils';
import { convertSolidsFeeds, summarizeConversion } from '../scripts/convert-solids-feeds-runner';
import {
  GENERIC_FOOD_NAME,
  normalizeFoodName,
  foodNameKey,
  resolveCatalogFoodName,
  composeReactionDescription,
  filterUnconverted,
  foodLogFoodIds,
  findDuplicateFoodLog,
  buildFoodLogData,
  placeFoodTile,
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

  it('keys names exactly like the app', () => {
    for (const name of ['  Sweet   POTATO ', '. carrots', '"Peas",', 'mac & cheese', '‘Kiwi’', '...']) {
      expect(foodNameKey(name)).toBe(appFoodNameKey(name));
    }
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

describe('placeFoodTile', () => {
  it('inserts food immediately after a visible feed tile', () => {
    const result = placeFoodTile({
      order: ['sleep', 'feed', 'diaper', 'note'],
      visible: ['sleep', 'feed', 'diaper'],
    });
    expect(result.changed).toBe(true);
    expect(result.order).toEqual(['sleep', 'feed', 'food', 'diaper', 'note']);
    expect(result.visible).toContain('food');
  });

  it('appends food at the end when feed is hidden, still visible', () => {
    const result = placeFoodTile({
      order: ['sleep', 'feed', 'diaper'],
      visible: ['sleep', 'diaper'], // feed hidden
    });
    expect(result.changed).toBe(true);
    expect(result.order).toEqual(['sleep', 'feed', 'diaper', 'food']);
    expect(result.visible).toContain('food');
  });

  it('appends food at the end when feed is missing from the order', () => {
    const result = placeFoodTile({ order: ['sleep', 'diaper'], visible: ['sleep', 'diaper'] });
    expect(result.changed).toBe(true);
    expect(result.order).toEqual(['sleep', 'diaper', 'food']);
    expect(result.visible).toContain('food');
  });

  it('never moves an already-placed food tile (user re-orders stick)', () => {
    const result = placeFoodTile({
      order: ['food', 'sleep', 'feed'],
      visible: ['food', 'sleep', 'feed'],
    });
    expect(result.changed).toBe(false);
    expect(result.order).toEqual(['food', 'sleep', 'feed']);
    expect(result.visible).toEqual(['food', 'sleep', 'feed']);
  });

  it('only restores visibility when food is ordered but not visible', () => {
    const result = placeFoodTile({
      order: ['feed', 'food', 'sleep'],
      visible: ['feed', 'sleep'],
    });
    expect(result.changed).toBe(true);
    expect(result.order).toEqual(['feed', 'food', 'sleep']);
    expect(result.visible).toEqual(['feed', 'sleep', 'food']);
  });

  it('handles missing or malformed arrays', () => {
    const result = placeFoodTile({});
    expect(result.changed).toBe(true);
    expect(result.order).toEqual(['food']);
    expect(result.visible).toEqual(['food']);
  });

  it('adds food only once', () => {
    const first = placeFoodTile({ order: ['feed'], visible: ['feed'] });
    const second = placeFoodTile({ order: first.order, visible: first.visible });
    expect(second.changed).toBe(false);
    expect(second.order.filter((a: string) => a === 'food')).toHaveLength(1);
  });
});

describe('foodLogFoodIds', () => {
  it('prefers the foods JSON items, else the legacy foodId', () => {
    expect(foodLogFoodIds({ foodId: null, foods: JSON.stringify([{ foodId: 'a' }, { foodId: 'b' }]) })).toEqual(['a', 'b']);
    expect(foodLogFoodIds({ foodId: 'a', foods: null })).toEqual(['a']);
    expect(foodLogFoodIds({ foodId: 'a', foods: '[]' })).toEqual(['a']);
    expect(foodLogFoodIds({ foodId: 'a', foods: 'not json' })).toEqual(['a']);
    expect(foodLogFoodIds({ foodId: null, foods: null })).toEqual([]);
  });
});

describe('findDuplicateFoodLog', () => {
  const time = new Date('2026-07-01T09:00:00Z');
  const names = new Map([['f-carrot', 'Carrot'], ['f-pea', 'Peas'], ['f-egg', 'Egg']]);
  const log = { id: 'log-1', familyId: 'family-1', babyId: 'baby-1', time: time.toISOString(), foodId: 'f-carrot', foods: null, deletedAt: null };
  const entry = { familyId: 'family-1', babyId: 'baby-1', time, names: ['Carrot'] };

  it('matches the same family, baby, exact time and food', () => {
    expect(findDuplicateFoodLog(entry, [log], names)).toBe(log);
  });

  it('does not match a different baby, family, time or food', () => {
    expect(findDuplicateFoodLog({ ...entry, babyId: 'baby-2' }, [log], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, familyId: 'family-2' }, [log], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, time: new Date(time.getTime() + 1) }, [log], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, names: ['Peas'] }, [log], names)).toBeNull();
  });

  it('ignores case, whitespace and edge punctuation in names', () => {
    expect(findDuplicateFoodLog({ ...entry, names: ['  . CARROT  '] }, [log], names)).toBe(log);
  });

  it('matches the foods JSON of a multi-food log as an order-insensitive set', () => {
    const meal = { ...log, foodId: null, foods: JSON.stringify([{ foodId: 'f-carrot' }, { foodId: 'f-pea', amount: 1 }]) };
    expect(findDuplicateFoodLog({ ...entry, names: ['peas', 'carrot'] }, [meal], names)).toBe(meal);
    expect(findDuplicateFoodLog({ ...entry, names: ['carrot'] }, [meal], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, names: ['carrot', 'peas', 'egg'] }, [meal], names)).toBeNull();
  });

  it('matches a legacy single-food foodId row with an empty foods JSON', () => {
    expect(findDuplicateFoodLog(entry, [{ ...log, foods: '[]' }], names)).not.toBeNull();
  });

  it('never matches deleted logs, deleted entries, unknown food ids or blank names', () => {
    expect(findDuplicateFoodLog(entry, [{ ...log, deletedAt: new Date() }], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, deletedAt: new Date() }, [log], names)).toBeNull();
    expect(findDuplicateFoodLog(entry, [{ ...log, foodId: 'f-gone' }], names)).toBeNull();
    expect(findDuplicateFoodLog({ ...entry, names: ['  '] }, [log], names)).toBeNull();
  });

  it('treats a null and a missing family as the same family', () => {
    expect(findDuplicateFoodLog({ ...entry, familyId: undefined }, [{ ...log, familyId: null }], names)).not.toBeNull();
  });
});

describe('convertSolidsFeeds (mocked client)', () => {
  const time = new Date('2026-07-01T09:00:00Z');

  function mockClient(feeds: any[], existingLogs: any[], catalog: any[]) {
    const tx = {
      foodLog: { create: vi.fn(async ({ data }: any) => ({ id: 'new-log', ...data })) },
      photoLink: { findMany: vi.fn(async () => [{ photoId: 'photo-1' }]), updateMany: vi.fn(async () => ({ count: 0 })) },
      feedLog: { delete: vi.fn(async () => ({})) },
    };
    const prisma = {
      settings: { findMany: vi.fn(async () => []) },
      feedLog: { findMany: vi.fn(async () => feeds) },
      foodLog: {
        findMany: vi.fn(async ({ where }: any) => (where.feedLogId ? [] : existingLogs.filter((log) => log.babyId === where.babyId))),
      },
      food: {
        findMany: vi.fn(async () => catalog),
        create: vi.fn(async ({ data }: any) => ({ id: 'food-new', ...data })),
      },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    };
    return { prisma, tx };
  }

  const feed = { ...baseFeed, id: 'feed-again', type: 'SOLIDS', food: 'carrot ', time, deletedAt: null };
  const existing = { id: 'log-1', familyId: 'family-1', babyId: 'baby-1', time, foodId: 'f-carrot', foods: null, deletedAt: null };

  it('deletes a re-created feed that duplicates an existing food log instead of converting it again', async () => {
    const { prisma, tx } = mockClient([feed], [existing], [{ id: 'f-carrot', name: 'Carrot' }]);

    const result = await convertSolidsFeeds(prisma as any);

    expect(prisma.foodLog.findMany).toHaveBeenCalledWith({
      where: { familyId: 'family-1', babyId: 'baby-1', time, deletedAt: null },
    });
    expect(prisma.food.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['f-carrot'] }, familyId: 'family-1' },
      select: { id: true, name: true },
    });
    expect(tx.foodLog.create).not.toHaveBeenCalled();
    expect(prisma.food.create).not.toHaveBeenCalled();
    expect(tx.photoLink.updateMany).toHaveBeenCalledWith({
      where: { activityType: 'feed', activityId: 'feed-again', photoId: { notIn: ['photo-1'] } },
      data: { activityType: 'foodLog', activityId: 'log-1' },
    });
    expect(tx.feedLog.delete).toHaveBeenCalledWith({ where: { id: 'feed-again' } });
    expect(result).toMatchObject({ total: 1, converted: 0, duplicates: 1, errors: 0 });
    expect(summarizeConversion(result)).toContain('1 duplicate(s) of existing food logs removed');
  });

  it('converts a feed for another baby at the same time and food', async () => {
    const { prisma, tx } = mockClient([{ ...feed, babyId: 'baby-2' }], [existing], [{ id: 'f-carrot', name: 'Carrot' }]);

    const result = await convertSolidsFeeds(prisma as any);

    expect(tx.foodLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ babyId: 'baby-2', foodId: 'f-carrot', feedLogId: 'feed-again' }) });
    expect(tx.photoLink.findMany).not.toHaveBeenCalled();
    expect(tx.photoLink.updateMany).toHaveBeenCalledWith({
      where: { activityType: 'feed', activityId: 'feed-again' },
      data: { activityType: 'foodLog', activityId: 'new-log' },
    });
    expect(result).toMatchObject({ converted: 1, duplicates: 0 });
  });

  it('still converts a soft-deleted feed to a soft-deleted food log without a duplicate lookup', async () => {
    const deletedAt = new Date('2026-07-02T00:00:00Z');
    const { prisma, tx } = mockClient([{ ...feed, deletedAt }], [existing], [{ id: 'f-carrot', name: 'Carrot' }]);

    const result = await convertSolidsFeeds(prisma as any);

    expect(prisma.foodLog.findMany).toHaveBeenCalledTimes(1); // only the feedLogId idempotency query
    expect(tx.foodLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ deletedAt }) });
    expect(result).toMatchObject({ converted: 1, duplicates: 0 });
  });
});
