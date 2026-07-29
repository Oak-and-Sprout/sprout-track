import { describe, expect, it, vi } from 'vitest';
import { parseFoodsJson } from '@/src/utils/foodLogUtils';

// The route module imports the Prisma client at load time; the merge planning
// helpers under test are pure, so stub the client out.
vi.mock('../app/api/db', () => ({ default: {} }));

import {
  buildFoodMergeCandidateWhere,
  groupFoodMergeUpdates,
  planFoodMergeUpdates,
  type FoodMergeCandidate,
} from '../app/api/food/merge/route';

const SOURCE = 'food-source';
const TARGET = 'food-target';
const FAMILY = 'family-1';

const candidate = (over: Partial<FoodMergeCandidate> & { id: string }): FoodMergeCandidate => ({
  foodId: null,
  foods: null,
  hadReaction: false,
  reactionDescription: null,
  ...over,
});

describe('buildFoodMergeCandidateWhere', () => {
  const where = buildFoodMergeCandidateWhere(FAMILY, SOURCE);

  it('scopes every candidate to the authenticated family', () => {
    expect(where.familyId).toBe(FAMILY);
  });

  it('never pulls in rows that only belong to the merge target (B3)', () => {
    // Rows already on the target need no work: expandFoodItems() synthesizes an
    // item from the legacy foodId when foods is NULL, so fetching them only to
    // backfill JSON made merge cost scale with the target's popularity.
    expect(JSON.stringify(where)).not.toContain(TARGET);
    expect(where.OR).toEqual([{ foodId: SOURCE }, { foods: { contains: SOURCE } }]);
  });

  it('does not filter out soft-deleted logs so history stays intact', () => {
    expect(where).not.toHaveProperty('deletedAt');
  });
});

describe('planFoodMergeUpdates', () => {
  it('visits each dual-write single-food row exactly once (B2)', () => {
    const candidates = Array.from({ length: 5 }, (_, i) =>
      candidate({
        id: `log-${i}`,
        foodId: SOURCE,
        foods: JSON.stringify([{ foodId: SOURCE }]),
      })
    );

    const updates = planFoodMergeUpdates(candidates, SOURCE, TARGET);

    // Previously updateMany's count (5) was added to the loop's count (5) => 10.
    expect(updates).toHaveLength(5);
    expect(new Set(updates.map(u => u.id)).size).toBe(5);
    for (const update of updates) {
      expect(update.data.foodId).toBe(TARGET);
      expect(parseFoodsJson(update.data.foods)).toEqual([
        { foodId: TARGET, hadReaction: false, reactionDescription: null },
      ]);
    }
  });

  it('rewrites a multi-food meal once, keeping the other foods and null FK', () => {
    const updates = planFoodMergeUpdates(
      [
        candidate({
          id: 'meal-1',
          foodId: null,
          foods: JSON.stringify([{ foodId: 'other-a' }, { foodId: SOURCE }, { foodId: 'other-b' }]),
        }),
      ],
      SOURCE,
      TARGET
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].data.foodId).toBeNull();
    expect(parseFoodsJson(updates[0].data.foods).map(i => i.foodId)).toEqual([
      'other-a',
      TARGET,
      'other-b',
    ]);
  });

  it('dedupes a meal holding both source and target, OR-ing the reaction flags', () => {
    const updates = planFoodMergeUpdates(
      [
        candidate({
          id: 'meal-2',
          foodId: null,
          foods: JSON.stringify([
            { foodId: TARGET },
            { foodId: 'other-a' },
            { foodId: SOURCE, hadReaction: true, reactionDescription: 'hives' },
          ]),
          hadReaction: true,
          reactionDescription: 'hives',
        }),
      ],
      SOURCE,
      TARGET
    );

    expect(updates).toHaveLength(1);
    const items = parseFoodsJson(updates[0].data.foods);
    expect(items).toHaveLength(2);
    const merged = items.find(item => item.foodId === TARGET);
    expect(merged).toEqual({ foodId: TARGET, hadReaction: true, reactionDescription: 'hives' });
    expect(updates[0].data.hadReaction).toBe(true);
    expect(updates[0].data.reactionDescription).toBe('hives');
  });

  it('backfills foods JSON for a legacy row that has only the source FK', () => {
    const updates = planFoodMergeUpdates(
      [
        candidate({
          id: 'legacy-1',
          foodId: SOURCE,
          foods: null,
          hadReaction: true,
          reactionDescription: ' rash ',
        }),
      ],
      SOURCE,
      TARGET
    );

    expect(updates).toHaveLength(1);
    expect(updates[0].data.foodId).toBe(TARGET);
    expect(parseFoodsJson(updates[0].data.foods)).toEqual([
      { foodId: TARGET, hadReaction: true, reactionDescription: 'rash' },
    ]);
    expect(updates[0].data.hadReaction).toBe(true);
  });

  it('remaps soft-deleted rows too (they are never filtered from the work set)', () => {
    // Soft-deleted logs reach the planner exactly like live ones.
    const updates = planFoodMergeUpdates(
      [candidate({ id: 'deleted-1', foodId: SOURCE, foods: JSON.stringify([{ foodId: SOURCE }]) })],
      SOURCE,
      TARGET
    );

    expect(updates.map(u => u.id)).toEqual(['deleted-1']);
    expect(updates[0].data.foodId).toBe(TARGET);
  });

  it('ignores rows that do not reference the source at all (B3)', () => {
    const updates = planFoodMergeUpdates(
      [
        candidate({ id: 'target-only', foodId: TARGET, foods: JSON.stringify([{ foodId: TARGET }]) }),
        candidate({ id: 'target-legacy', foodId: TARGET, foods: null }),
        candidate({ id: 'unrelated', foodId: 'other-a', foods: null }),
      ],
      SOURCE,
      TARGET
    );

    expect(updates).toEqual([]);
  });
});

describe('groupFoodMergeUpdates', () => {
  it('collapses identical payloads into one batch without losing rows', () => {
    const updates = planFoodMergeUpdates(
      [
        candidate({ id: 'a', foodId: SOURCE }),
        candidate({ id: 'b', foodId: SOURCE }),
        candidate({ id: 'c', foodId: SOURCE, hadReaction: true, reactionDescription: 'hives' }),
      ],
      SOURCE,
      TARGET
    );

    const batches = groupFoodMergeUpdates(updates);

    expect(batches).toHaveLength(2);
    expect(batches[0].ids).toEqual(['a', 'b']);
    expect(batches[1].ids).toEqual(['c']);
    expect(batches.reduce((sum, batch) => sum + batch.ids.length, 0)).toBe(updates.length);
  });

  it('returns nothing for an empty work set', () => {
    expect(groupFoodMergeUpdates([])).toEqual([]);
  });
});
