import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Server-side handling of per-food details (#271) in /api/food-log: the
 * `foods` array is validated (types, ranges, distinct ids), every food id is
 * scoped to the caller's family, details persist in the `foods` JSON, and the
 * row-level amount is derived from per-food amounts so totals keep working.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    baby: { findFirst: vi.fn() },
    food: { findMany: vi.fn() },
    foodLog: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  },
}));

vi.mock('../app/api/db', () => ({ default: mocks.prisma }));
vi.mock('../app/api/utils/auth', () => ({
  withAuthContext: (handler: (req: NextRequest, ctx: unknown) => unknown) => (req: NextRequest) =>
    handler(req, { authenticated: true, familyId: 'fam-1', caretakerId: 'ct-1' }),
}));
vi.mock('../app/api/utils/writeProtection', () => ({
  checkWritePermission: () => ({ allowed: true }),
}));

import { POST, PUT } from '../app/api/food-log/route';

const FAMILY_FOODS = [
  { id: 'carrot', name: 'Carrot', commonAllergen: false },
  { id: 'pea', name: 'Pea', commonAllergen: false },
];

function request(method: 'POST' | 'PUT', body: unknown, query = '') {
  return new NextRequest(`http://localhost/api/food-log${query}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const baseBody = { babyId: 'baby-1', time: '2026-10-01T12:00:00.000Z' };
const echo = ({ data }: { data: Record<string, unknown> }) => ({
  id: 'log-1', createdAt: new Date(), updatedAt: new Date(), deletedAt: null, food: null, ...data,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.baby.findFirst.mockResolvedValue({ id: 'baby-1', familyId: 'fam-1' });
  // Only foods in fam-1 (with the requested ids) come back
  mocks.prisma.food.findMany.mockImplementation(({ where }: { where: { id: { in: string[] }; familyId: string } }) =>
    Promise.resolve(where.familyId === 'fam-1' ? FAMILY_FOODS.filter(f => where.id.in.includes(f.id)) : []));
  mocks.prisma.foodLog.create.mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve(echo(args)));
  mocks.prisma.foodLog.update.mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve(echo(args)));
  mocks.prisma.foodLog.findFirst.mockResolvedValue({ id: 'log-1', familyId: 'fam-1', amount: 3, unitAbbr: 'TBSP' });
});

describe('POST /api/food-log with per-food details', () => {
  it('stores each food’s details in the foods JSON and derives the row total', async () => {
    const res = await POST(request('POST', {
      ...baseBody,
      amount: 9,
      unitAbbr: 'G',
      foods: [
        { foodId: 'carrot', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
        { foodId: 'pea', amount: 1, unitAbbr: 'TBSP', enjoyment: 'HATED', hadReaction: true, reactionDescription: 'rash' },
      ],
    }));
    expect(res.status).toBe(200);
    const data = mocks.prisma.foodLog.create.mock.calls[0][0].data;
    expect(JSON.parse(data.foods)).toEqual([
      { foodId: 'carrot', amount: 2, unitAbbr: 'TBSP', enjoyment: 'LOVED' },
      { foodId: 'pea', hadReaction: true, reactionDescription: 'rash', amount: 1, unitAbbr: 'TBSP', enjoyment: 'HATED' },
    ]);
    expect(data).toMatchObject({ foodId: null, amount: 3, unitAbbr: 'TBSP', hadReaction: true, familyId: 'fam-1' });
    const body = await res.json();
    expect(body.data.foodItems[1]).toMatchObject({ name: 'Pea', amount: 1, enjoyment: 'HATED', hadReaction: true });
  });

  it('keeps the meal amount when no food carries its own (pre-#271 clients)', async () => {
    await POST(request('POST', { ...baseBody, amount: 3, unitAbbr: 'TBSP', foods: [{ foodId: 'carrot' }, { foodId: 'pea' }] }));
    expect(mocks.prisma.foodLog.create.mock.calls[0][0].data).toMatchObject({ amount: 3, unitAbbr: 'TBSP' });
  });

  it('rejects malformed per-food details with 400 and writes nothing', async () => {
    for (const foods of [
      [{ foodId: 'carrot', amount: -1 }],
      [{ foodId: 'carrot', enjoyment: 'GREAT' }],
      [{ foodId: 'carrot' }, { foodId: 'carrot' }],
      [{ foodId: 'carrot', hadReaction: 'yes' }],
    ]) {
      const res = await POST(request('POST', { ...baseBody, foods }));
      expect(res.status).toBe(400);
    }
    expect(mocks.prisma.foodLog.create).not.toHaveBeenCalled();
  });

  it('rejects a food id outside the caller’s family with 404', async () => {
    const res = await POST(request('POST', { ...baseBody, foods: [{ foodId: 'carrot' }, { foodId: 'other-family-food' }] }));
    expect(res.status).toBe(404);
    expect(mocks.prisma.food.findMany.mock.calls[0][0].where).toMatchObject({ familyId: 'fam-1' });
    expect(mocks.prisma.foodLog.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/food-log with per-food details', () => {
  it('re-derives the row amount from per-food amounts, ignoring a stale meal amount', async () => {
    const res = await PUT(request('PUT', {
      amount: null,
      foods: [
        { foodId: 'carrot', amount: 2, unitAbbr: 'TBSP' },
        { foodId: 'pea', amount: 15, unitAbbr: 'G' },
      ],
    }, '?id=log-1'));
    expect(res.status).toBe(200);
    expect(mocks.prisma.foodLog.update.mock.calls[0][0].data).toMatchObject({ amount: null, unitAbbr: null });
  });

  it('rejects malformed per-food details with 400', async () => {
    const res = await PUT(request('PUT', { foods: [{ foodId: 'carrot', amount: 'lots' }] }, '?id=log-1'));
    expect(res.status).toBe(400);
    expect(mocks.prisma.foodLog.update).not.toHaveBeenCalled();
  });
});
