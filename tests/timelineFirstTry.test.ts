import { describe, it, expect } from 'vitest';
import {
  collectWindowFoodIds,
  buildFirstTryScopeWhere,
} from '@/app/api/timeline/route';
import { computeFoodProgress, serializeFoodItems } from '@/src/utils/foodLogUtils';

const log = (over: Record<string, any>) => ({
  foodId: null,
  foods: null,
  time: '2026-07-01T12:00:00.000Z',
  hadReaction: false,
  reactionDescription: null,
  deletedAt: null,
  ...over,
});

describe('collectWindowFoodIds', () => {
  it('collects ids from single-food (FK) meals', () => {
    const ids = collectWindowFoodIds([
      log({ foodId: 'banana' }),
      log({ foodId: 'avocado' }),
    ]);
    expect(ids.sort()).toEqual(['avocado', 'banana']);
  });

  it('extracts ids from a multi-food meal (foodId NULL, foods JSON)', () => {
    const ids = collectWindowFoodIds([
      log({ foodId: null, foods: serializeFoodItems([{ foodId: 'pear' }, { foodId: 'oat' }]) }),
    ]);
    expect(ids.sort()).toEqual(['oat', 'pear']);
  });

  it('unions FK and JSON meals and de-duplicates', () => {
    const ids = collectWindowFoodIds([
      log({ foodId: 'banana' }),
      log({ foodId: null, foods: serializeFoodItems([{ foodId: 'banana' }, { foodId: 'pear' }]) }),
      log({ foodId: 'oat' }),
    ]);
    expect(ids.sort()).toEqual(['banana', 'oat', 'pear']);
  });

  it('prefers the foods JSON over a stale FK on the same row', () => {
    // Dual-write keeps the FK for N=1; the JSON is the canonical read path.
    const ids = collectWindowFoodIds([
      log({ foodId: 'banana', foods: serializeFoodItems([{ foodId: 'banana' }, { foodId: 'pear' }]) }),
    ]);
    expect(ids.sort()).toEqual(['banana', 'pear']);
  });

  it('returns an empty set for an empty window, so the caller skips the query', () => {
    expect(collectWindowFoodIds([])).toEqual([]);
  });

  it('returns an empty set for rows referencing no food at all', () => {
    // Guards the `windowFoodIds.length > 0` skip: a food log with neither a FK
    // nor parseable JSON must not trigger the all-time read.
    expect(collectWindowFoodIds([log({ foodId: null, foods: '' })])).toEqual([]);
    expect(collectWindowFoodIds([log({ foodId: '', foods: 'not json' })])).toEqual([]);
  });
});

describe('buildFirstTryScopeWhere', () => {
  it('always scopes to babyId, familyId and deletedAt: null', () => {
    const where = buildFirstTryScopeWhere({ babyId: 'baby1', familyId: 'fam1', foodIds: ['banana'] });
    expect(where.babyId).toBe('baby1');
    expect(where.familyId).toBe('fam1');
    expect(where.deletedAt).toBeNull();
  });

  it('keeps the family scope even when there are no ids (fails closed)', () => {
    const where = buildFirstTryScopeWhere({ babyId: 'baby1', familyId: 'fam1', foodIds: [] });
    expect(where).toEqual({
      babyId: 'baby1',
      familyId: 'fam1',
      deletedAt: null,
      id: { in: [] },
    });
    // Never an empty OR — Prisma drops a nested empty OR and would widen the read.
    expect(where.OR).toBeUndefined();
  });

  it('matches the FK in one IN plus a substring LIKE per id for JSON meals', () => {
    const where = buildFirstTryScopeWhere({
      babyId: 'baby1',
      familyId: 'fam1',
      foodIds: ['banana', 'pear'],
    });
    expect(where.OR).toEqual([
      { foodId: { in: ['banana', 'pear'] } },
      { foods: { contains: 'banana' } },
      { foods: { contains: 'pear' } },
    ]);
    expect(where.id).toBeUndefined();
  });
});

describe('bounded all-time read is equivalent for in-window foods', () => {
  // Simulates the route: filter an all-time table with the built where-clause,
  // then compare firstTryByFoodId against the old unbounded computation.
  const matches = (row: any, where: any): boolean => {
    if (row.babyId !== where.babyId) return false;
    if (row.familyId !== where.familyId) return false;
    if (row.deletedAt !== null) return false;
    if (where.id) return false;
    return where.OR.some((clause: any) =>
      clause.foodId
        ? row.foodId != null && clause.foodId.in.includes(row.foodId)
        : typeof row.foods === 'string' && row.foods.includes(clause.foods.contains)
    );
  };

  const scope = { babyId: 'baby1', familyId: 'fam1' };
  const row = (over: Record<string, any>) => ({ ...log(over), ...scope });

  const allTime = [
    row({ foodId: 'banana', time: '2025-01-01T00:00:00.000Z' }),
    row({ foodId: 'banana', time: '2026-07-01T00:00:00.000Z' }),
    row({ foods: serializeFoodItems([{ foodId: 'banana' }, { foodId: 'pear' }]), time: '2024-05-05T00:00:00.000Z' }),
    row({ foodId: 'pear', time: '2026-07-01T00:00:00.000Z' }),
    // Noise the bounded query must exclude: other foods, and a soft-deleted row.
    row({ foodId: 'kale', time: '2023-01-01T00:00:00.000Z' }),
    row({ foods: serializeFoodItems([{ foodId: 'kale' }, { foodId: 'oat' }]), time: '2023-02-02T00:00:00.000Z' }),
    row({ foodId: 'banana', time: '2020-01-01T00:00:00.000Z', deletedAt: '2020-01-02T00:00:00.000Z' }),
    // Another family / another baby must never leak in.
    { ...log({ foodId: 'banana', time: '2019-01-01T00:00:00.000Z' }), babyId: 'baby1', familyId: 'fam2' },
    { ...log({ foodId: 'banana', time: '2019-01-01T00:00:00.000Z' }), babyId: 'baby2', familyId: 'fam1' },
  ];

  it('produces the same first-try times as the unbounded read for window foods', () => {
    const windowLogs = [
      log({ foodId: 'banana', time: '2026-07-01T00:00:00.000Z' }),
      log({ foods: serializeFoodItems([{ foodId: 'pear' }]), time: '2026-07-01T00:00:00.000Z' }),
    ];
    const windowFoodIds = collectWindowFoodIds(windowLogs);
    const where = buildFirstTryScopeWhere({ ...scope, foodIds: windowFoodIds });

    const unbounded = computeFoodProgress(
      allTime.filter(r => r.babyId === 'baby1' && r.familyId === 'fam1' && r.deletedAt === null)
    ).firstTryByFoodId;
    const bounded = computeFoodProgress(allTime.filter(r => matches(r, where))).firstTryByFoodId;

    for (const id of windowFoodIds) {
      expect(bounded[id]).toBe(unbounded[id]);
    }
    // The earliest try for both window foods is the 2024 multi-food meal.
    expect(bounded.banana).toBe('2024-05-05T00:00:00.000Z');
    expect(bounded.pear).toBe('2024-05-05T00:00:00.000Z');
    // Foods outside the window may be absent — nothing in the route reads them.
    expect(bounded.kale).toBeUndefined();
  });

  it('over-matching on the JSON substring cannot change a window food answer', () => {
    // `contains` is a substring LIKE, so an id that is a prefix of another id
    // pulls extra rows in. computeFoodProgress re-parses, so they contribute
    // only to their own foods.
    const overMatch = [
      row({ foods: serializeFoodItems([{ foodId: 'banana-bread' }]), time: '2020-01-01T00:00:00.000Z' }),
      row({ foods: serializeFoodItems([{ foodId: 'banana' }]), time: '2025-03-03T00:00:00.000Z' }),
    ];
    const where = buildFirstTryScopeWhere({ ...scope, foodIds: ['banana'] });
    const selected = overMatch.filter(r => matches(r, where));
    expect(selected).toHaveLength(2); // the LIKE over-matched, as expected

    const { firstTryByFoodId } = computeFoodProgress(selected);
    expect(firstTryByFoodId.banana).toBe('2025-03-03T00:00:00.000Z');
    expect(firstTryByFoodId['banana-bread']).toBe('2020-01-01T00:00:00.000Z');
  });
});
