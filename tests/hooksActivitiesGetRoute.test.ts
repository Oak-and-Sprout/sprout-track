import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const delegate = () => ({ findMany: vi.fn() });
  return {
    prisma: {
      apiKey: { findUnique: vi.fn(), update: vi.fn() },
      baby: { findFirst: vi.fn() },
      food: { findMany: vi.fn() },
      foodLog: delegate(),
      sleepLog: delegate(),
      feedLog: delegate(),
      diaperLog: delegate(),
      note: delegate(),
      pumpLog: delegate(),
      playLog: delegate(),
      bathLog: delegate(),
      measurement: delegate(),
      medicineLog: delegate(),
    },
  };
});

vi.mock('../app/api/db', () => ({ default: mocks.prisma }));
vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: vi.fn(() => Promise.resolve()),
  resetTimerNotificationState: vi.fn(() => Promise.resolve()),
}));

import { GET } from '../app/api/hooks/v1/babies/[babyId]/activities/route';
import { decodeCursor, encodeCursor } from '../app/api/hooks/v1/pagination';

const routeContext = { params: Promise.resolve({ babyId: 'baby-1' }) };

function getRequest(query = '') {
  return new Request(`http://localhost/api/hooks/v1/babies/baby-1/activities${query}`, {
    method: 'GET',
    headers: { authorization: 'Bearer st_live_test' },
  });
}

async function get(query: string) {
  const response = await GET(getRequest(query) as any, routeContext);
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const diaper = (id: string, time: string) => ({ id, time: new Date(time), type: 'WET', caretaker: null });

beforeEach(() => {
  vi.clearAllMocks();
  for (const d of Object.values(mocks.prisma)) {
    if ('findMany' in d) (d.findMany as any).mockReset().mockResolvedValue([]);
  }
  mocks.prisma.apiKey.findUnique.mockResolvedValue({
    id: `key-${crypto.randomUUID()}`,
    familyId: 'family-1',
    babyId: null,
    scopes: JSON.stringify(['read']),
    revoked: false,
    expiresAt: null,
  });
  mocks.prisma.apiKey.update.mockResolvedValue({});
  mocks.prisma.baby.findFirst.mockResolvedValue({ id: 'baby-1', familyId: 'family-1' });
});

describe('hooks activities GET pagination', () => {
  it('queries a since/until window in ascending order with limit + 1 rows', async () => {
    await get('?type=diaper&since=2025-08-01T00:00:00Z&until=2025-09-01T00:00:00Z&order=asc&limit=50');
    expect(mocks.prisma.diaperLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        babyId: 'baby-1',
        deletedAt: null,
        AND: [{ time: { gte: new Date('2025-08-01T00:00:00Z'), lt: new Date('2025-09-01T00:00:00Z') } }],
      },
      orderBy: [{ time: 'asc' }, { id: 'asc' }],
      take: 51,
    }));
  });

  it('uses each table\'s own time field', async () => {
    await get('?type=sleep&until=2025-09-01T00:00:00Z');
    expect(mocks.prisma.sleepLog.findMany.mock.calls[0][0]).toMatchObject({
      where: { AND: [{ startTime: { lt: new Date('2025-09-01T00:00:00Z') } }] },
      orderBy: [{ startTime: 'desc' }, { id: 'desc' }],
    });
  });

  it('keeps medicine/supplement and food scoping alongside the range', async () => {
    await get('?until=2025-09-01T00:00:00Z');
    const [medicine, supplement] = mocks.prisma.medicineLog.findMany.mock.calls.map((c) => c[0].where);
    expect(medicine).toMatchObject({ babyId: 'baby-1', medicine: { isSupplement: false } });
    expect(supplement).toMatchObject({ babyId: 'baby-1', medicine: { isSupplement: true } });
    expect(mocks.prisma.foodLog.findMany.mock.calls[0][0].where).toMatchObject({ babyId: 'baby-1', familyId: 'family-1' });
  });

  it('returns an honest hasMore and a cursor that resumes after the last row', async () => {
    mocks.prisma.diaperLog.findMany.mockResolvedValue([
      diaper('d3', '2025-08-03T00:00:00Z'),
      diaper('d2', '2025-08-02T00:00:00Z'),
      diaper('d1', '2025-08-01T00:00:00Z'),
    ]);
    const first = await get('?type=diaper&since=2025-01-01&limit=2');
    expect(first.status).toBe(200);
    expect(first.body.data.activities.map((a: any) => a.id)).toEqual(['d3', 'd2']);
    expect(first.body.data).toMatchObject({ count: 2, hasMore: true });
    expect(decodeCursor(first.body.data.nextCursor)).toEqual({ time: new Date('2025-08-02T00:00:00Z'), type: 'diaper', id: 'd2' });

    mocks.prisma.diaperLog.findMany.mockResolvedValue([diaper('d1', '2025-08-01T00:00:00Z')]);
    const second = await get(`?type=diaper&since=2025-01-01&limit=2&cursor=${first.body.data.nextCursor}`);
    expect(mocks.prisma.diaperLog.findMany.mock.calls[1][0].where.AND[1]).toEqual({
      OR: [{ time: { lt: new Date('2025-08-02T00:00:00Z') } }, { time: new Date('2025-08-02T00:00:00Z'), id: { lt: 'd2' } }],
    });
    expect(second.body.data).toMatchObject({ count: 1, hasMore: false, nextCursor: null });
  });

  it('keeps the legacy 24-hour default when no window is given', async () => {
    const before = Date.now();
    await get('?type=diaper');
    const bound = mocks.prisma.diaperLog.findMany.mock.calls[0][0].where.AND[0].time.gte.getTime();
    expect(before - bound).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
    expect(before - bound).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
  });

  it('allows up to 200 rows per page', async () => {
    await get('?type=diaper&limit=1000');
    expect(mocks.prisma.diaperLog.findMany.mock.calls[0][0].take).toBe(201);
  });

  it.each([
    ['cursor=garbage', 'INVALID_CURSOR'],
    ['since=yesterday', 'INVALID_TIME'],
    ['until=nope', 'INVALID_TIME'],
    ['order=up', 'INVALID_ORDER'],
  ])('rejects %s with 400 %s', async (query, code) => {
    const { status, body } = await get(`?type=diaper&${query}`);
    expect(status).toBe(400);
    expect(body.error.code).toBe(code);
    expect(mocks.prisma.diaperLog.findMany).not.toHaveBeenCalled();
  });

  it('accepts a cursor issued for another type when paging all types', async () => {
    const cursor = encodeCursor('2025-08-02T00:00:00Z', 'feed', 'f1');
    const { status } = await get(`?cursor=${cursor}`);
    expect(status).toBe(200);
    expect(mocks.prisma.diaperLog.findMany.mock.calls[0][0].where.AND).toEqual([{ time: { lte: new Date('2025-08-02T00:00:00Z') } }]);
  });
});
