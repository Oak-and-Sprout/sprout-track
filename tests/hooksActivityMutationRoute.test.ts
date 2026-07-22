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
      unit: {
        findMany: vi.fn(),
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
  mocks.prisma.unit.findMany.mockResolvedValue([
    { unitAbbr: 'OZ' }, { unitAbbr: 'ML' }, { unitAbbr: 'LB' }, { unitAbbr: 'KG' }, { unitAbbr: 'G' }, { unitAbbr: 'TBSP' },
  ]);
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

  describe('enum-like field validation and normalization', () => {
    it('normalizes a lowercase diaper condition and color to canonical casing', async () => {
      mocks.prisma.diaperLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.diaperLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), type: 'WET', condition: 'LOOSE', color: 'YELLOW', blowout: false, creamApplied: false });

      await PUT(request('PUT', { type: 'diaper', condition: 'loose', color: 'yellow' }) as any, routeContext);

      expect(mocks.prisma.diaperLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ condition: 'LOOSE', color: 'YELLOW' }),
      }));
    });

    it('rejects an unknown diaper condition, listing valid values', async () => {
      mocks.prisma.diaperLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'diaper', condition: 'ZZZ_BOGUS' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('NORMAL');
      expect(mocks.prisma.diaperLog.update).not.toHaveBeenCalled();
    });

    it('normalizes a lowercase sleep quality to canonical casing', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.sleepLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z'), endTime: null, duration: 30, type: 'NAP', location: null, quality: 'GOOD' });

      await PUT(request('PUT', { type: 'sleep', quality: 'good' }) as any, routeContext);

      expect(mocks.prisma.sleepLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ quality: 'GOOD' }),
      }));
    });

    it('rejects an unknown sleep quality, listing valid values', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'sleep', quality: 'meh' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('EXCELLENT');
      expect(mocks.prisma.sleepLog.update).not.toHaveBeenCalled();
    });

    it('normalizes a known bathType to canonical casing but passes an unrecognized custom type through verbatim', async () => {
      mocks.prisma.bathLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.bathLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), bathType: 'Sponge Bath', soapUsed: true, shampooUsed: true, notes: null });

      await PUT(request('PUT', { type: 'bath', bathType: 'sponge bath' }) as any, routeContext);

      expect(mocks.prisma.bathLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ bathType: 'Sponge Bath' }),
      }));

      mocks.prisma.bathLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), bathType: 'Baby Spa Day', soapUsed: true, shampooUsed: true, notes: null });
      await PUT(request('PUT', { type: 'bath', bathType: 'Baby Spa Day' }) as any, routeContext);

      expect(mocks.prisma.bathLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ bathType: 'Baby Spa Day' }),
      }));
    });

    it('normalizes feed bottleType and side to canonical casing', async () => {
      mocks.prisma.feedLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.feedLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), type: 'BOTTLE', amount: 2, unitAbbr: 'OZ', notes: null });

      await PUT(request('PUT', { type: 'feed', bottleType: 'breast milk', side: 'left' }) as any, routeContext);

      expect(mocks.prisma.feedLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ bottleType: 'Breast Milk', side: 'LEFT' }),
      }));
    });

    it('rejects an unknown feed bottleType, listing valid values', async () => {
      mocks.prisma.feedLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'feed', bottleType: 'Juice' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('Formula');
      expect(mocks.prisma.feedLog.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown feed side, listing valid values', async () => {
      mocks.prisma.feedLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'feed', side: 'UP' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('LEFT');
      expect(mocks.prisma.feedLog.update).not.toHaveBeenCalled();
    });

    it('resolves a lowercase feed unitAbbr against the Unit table to its canonical casing', async () => {
      mocks.prisma.feedLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.feedLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z'), type: 'BOTTLE', amount: 2, unitAbbr: 'OZ', notes: null });

      await PUT(request('PUT', { type: 'feed', unitAbbr: 'oz' }) as any, routeContext);

      expect(mocks.prisma.feedLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ unitAbbr: 'OZ' }),
      }));
    });

    it('rejects an unrecognized feed unitAbbr, listing available units', async () => {
      mocks.prisma.feedLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'feed', unitAbbr: 'gallons' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('OZ');
      expect(mocks.prisma.feedLog.update).not.toHaveBeenCalled();
    });

    it('rejects an unrecognized medicine unitAbbr, listing available units', async () => {
      mocks.prisma.medicineLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'medicine', unitAbbr: 'gallons' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.message).toContain('OZ');
      expect(mocks.prisma.medicineLog.update).not.toHaveBeenCalled();
    });
  });

  describe('sleep duration recompute on PUT', () => {
    it('recomputes duration in whole minutes from endTime and the body startTime when duration is omitted', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T10:00:00Z') });
      mocks.prisma.sleepLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T09:00:00Z'), endTime: new Date('2026-07-18T10:30:00Z'), duration: 90, type: 'NAP', location: null, quality: null });

      await PUT(request('PUT', { type: 'sleep', startTime: '2026-07-18T09:00:00.000Z', endTime: '2026-07-18T10:30:00.000Z' }) as any, routeContext);

      expect(mocks.prisma.sleepLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ duration: 90 }),
      }));
    });

    it('recomputes duration from the existing row startTime when only endTime is provided', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T08:00:00Z') });
      mocks.prisma.sleepLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T08:00:00Z'), endTime: new Date('2026-07-18T08:45:00Z'), duration: 45, type: 'NAP', location: null, quality: null });

      await PUT(request('PUT', { type: 'sleep', endTime: '2026-07-18T08:45:00.000Z' }) as any, routeContext);

      const call = mocks.prisma.sleepLog.update.mock.calls[0][0];
      expect(call.data.duration).toBe(45);
      expect(call.data.startTime).toBeUndefined();
    });

    it('keeps an explicit duration even when endTime is also provided', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T08:00:00Z') });
      mocks.prisma.sleepLog.update.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T08:00:00Z'), endTime: new Date('2026-07-18T08:45:00Z'), duration: 999, type: 'NAP', location: null, quality: null });

      await PUT(request('PUT', { type: 'sleep', endTime: '2026-07-18T08:45:00.000Z', duration: 999 }) as any, routeContext);

      expect(mocks.prisma.sleepLog.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ duration: 999 }),
      }));
    });

    it('rejects an endTime earlier than the effective startTime', async () => {
      mocks.prisma.sleepLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', startTime: new Date('2026-07-18T08:00:00Z') });

      const response = await PUT(request('PUT', { type: 'sleep', endTime: '2026-07-18T07:00:00.000Z' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_UPDATE');
      expect(mocks.prisma.sleepLog.update).not.toHaveBeenCalled();
    });
  });

  describe('medicine/supplement PUT rejects a null dose', () => {
    it('rejects a null amount for medicine PUT instead of fabricating a zero dose', async () => {
      mocks.prisma.medicineLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'medicine', amount: null }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(mocks.prisma.medicineLog.update).not.toHaveBeenCalled();
    });

    it('rejects a null doseAmount for supplement PUT instead of fabricating a zero dose', async () => {
      mocks.prisma.medicineLog.findFirst.mockResolvedValue({ id: 'activity-1', babyId: 'baby-1', time: new Date('2026-07-18T10:00:00Z') });

      const response = await PUT(request('PUT', { type: 'supplement', doseAmount: null }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(mocks.prisma.medicineLog.update).not.toHaveBeenCalled();
    });
  });
});
