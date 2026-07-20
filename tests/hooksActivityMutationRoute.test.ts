import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE, PUT } from '../app/api/hooks/v1/babies/[babyId]/activities/[activityId]/route';

const mocks = vi.hoisted(() => {
  const delegate = () => ({
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  });

  return {
    prisma: {
      apiKey: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      baby: {
        findFirst: vi.fn(),
      },
      medicine: {
        findFirst: vi.fn(),
      },
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

vi.mock('../app/api/db', () => ({
  default: mocks.prisma,
}));

const routeContext = {
  params: Promise.resolve({ babyId: 'baby-1', activityId: 'activity-1' }),
};

function request(method: 'PUT' | 'DELETE', body?: unknown, query = '') {
  return new Request(`http://localhost/api/hooks/v1/babies/baby-1/activities/activity-1${query}`, {
    method,
    headers: {
      authorization: 'Bearer st_live_test',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

function resetDelegates() {
  for (const delegate of [
    mocks.prisma.sleepLog,
    mocks.prisma.feedLog,
    mocks.prisma.diaperLog,
    mocks.prisma.note,
    mocks.prisma.pumpLog,
    mocks.prisma.playLog,
    mocks.prisma.bathLog,
    mocks.prisma.measurement,
    mocks.prisma.medicineLog,
  ]) {
    delegate.findFirst.mockReset();
    delegate.update.mockReset();
    delegate.delete.mockReset();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  resetDelegates();
  mocks.prisma.apiKey.findUnique.mockResolvedValue({
    id: `key-${crypto.randomUUID()}`,
    familyId: 'family-1',
    babyId: null,
    scopes: JSON.stringify(['read', 'write']),
    revoked: false,
    expiresAt: null,
  });
  mocks.prisma.apiKey.update.mockResolvedValue({});
  mocks.prisma.baby.findFirst.mockResolvedValue({ id: 'baby-1', familyId: 'family-1' });
  mocks.prisma.medicine.findFirst.mockResolvedValue({ id: 'medicine-1', name: 'Vitamin D' });
});

describe('hooks activity mutation route', () => {
  it.each([
    ['feed', mocks.prisma.feedLog, { type: 'feed', notes: 'corrected' }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), type: 'BOTTLE', amount: 2, unitAbbr: 'OZ', notes: 'corrected' }],
    ['diaper', mocks.prisma.diaperLog, { type: 'diaper', diaperType: 'WET' }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), type: 'WET', condition: null, color: null, blowout: false, creamApplied: false }],
    ['sleep', mocks.prisma.sleepLog, { type: 'sleep', sleepType: 'NAP' }, { id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z'), endTime: null, duration: 30, type: 'NAP', location: null, quality: null }],
    ['note', mocks.prisma.note, { type: 'note', content: 'updated note' }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), content: 'updated note', category: null }],
    ['pump', mocks.prisma.pumpLog, { type: 'pump', totalAmount: 3 }, { id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z'), endTime: null, duration: 15, totalAmount: 3, unitAbbr: 'OZ', pumpAction: 'STORED' }],
    ['play', mocks.prisma.playLog, { type: 'play', playType: 'TUMMY_TIME' }, { id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z'), endTime: null, duration: 10, type: 'TUMMY_TIME', notes: null, activities: null }],
    ['bath', mocks.prisma.bathLog, { type: 'bath', soapUsed: false }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), bathType: null, soapUsed: false, shampooUsed: true, notes: null }],
    ['measurement', mocks.prisma.measurement, { type: 'measurement', value: 12.5 }, { id: 'activity-1', babyId: 'baby-1', date: new Date('2026-07-18T10:00:00Z'), type: 'WEIGHT', value: 12.5, unit: 'LB', notes: null }],
    ['medicine', mocks.prisma.medicineLog, { type: 'medicine', medicineName: 'Vitamin D' }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), medicine: { name: 'Vitamin D' }, doseAmount: 1, unitAbbr: 'ML', notes: null }],
    ['supplement', mocks.prisma.medicineLog, { type: 'supplement', supplementName: 'Vitamin D' }, { id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), medicine: { name: 'Vitamin D' }, doseAmount: 1, unitAbbr: 'ML', notes: null }],
  ])('updates %s activities through API-key auth', async (type, delegate, body, row) => {
    const existing = row as Record<string, unknown>;
    delegate.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: existing.time, startTime: existing.startTime, date: existing.date });
    delegate.update.mockResolvedValue(row);

    const response = await PUT(request('PUT', body) as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({ activityType: type, id: 'activity-1', babyId: 'baby-1', status: 'updated' });
    expect(delegate.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'activity-1', babyId: 'baby-1', familyId: 'family-1', deletedAt: null }),
    }));
    expect(delegate.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'activity-1' } }));
  });

  it('rejects fields that do not belong to the requested activity type', async () => {
    const response = await PUT(request('PUT', { type: 'diaper', medicineName: 'Vitamin D' }) as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_FIELD');
    expect(mocks.prisma.diaperLog.update).not.toHaveBeenCalled();
  });

  it('rejects API keys without write scope before touching activity rows', async () => {
    mocks.prisma.apiKey.findUnique.mockResolvedValue({
      id: 'read-key',
      familyId: 'family-1',
      babyId: null,
      scopes: JSON.stringify(['read']),
      revoked: false,
      expiresAt: null,
    });

    const response = await PUT(request('PUT', { type: 'feed', notes: 'blocked' }) as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('INSUFFICIENT_SCOPE');
    expect(mocks.prisma.feedLog.findFirst).not.toHaveBeenCalled();
  });

  it('deletes the located activity when type is omitted', async () => {
    mocks.prisma.feedLog.findFirst.mockResolvedValue({
      id: 'activity-1',
      babyId: 'baby-1',
      time: new Date('2026-07-18T10:00:00Z'),
    });
    mocks.prisma.feedLog.delete.mockResolvedValue({});

    const response = await DELETE(request('DELETE') as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(200);
    expect(payload.data).toMatchObject({ activityType: 'feed', id: 'activity-1', status: 'deleted' });
    expect(mocks.prisma.feedLog.delete).toHaveBeenCalledWith({ where: { id: 'activity-1' } });
    expect(mocks.prisma.diaperLog.findFirst).not.toHaveBeenCalled();
  });

  it('returns not found instead of deleting an already missing activity', async () => {
    const response = await DELETE(request('DELETE') as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('ACTIVITY_NOT_FOUND');
    expect(mocks.prisma.feedLog.delete).not.toHaveBeenCalled();
  });
});
