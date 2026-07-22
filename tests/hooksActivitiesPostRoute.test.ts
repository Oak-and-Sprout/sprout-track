import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const delegate = () => ({
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
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
      caretaker: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      medicine: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      activeBreastFeed: {
        findUnique: vi.fn(),
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

vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: vi.fn(() => Promise.resolve()),
  resetTimerNotificationState: vi.fn(() => Promise.resolve()),
}));

import { GET, POST } from '../app/api/hooks/v1/babies/[babyId]/activities/route';

const routeContext = {
  params: Promise.resolve({ babyId: 'baby-1' }),
};

function postRequest(body: unknown) {
  return new Request('http://localhost/api/hooks/v1/babies/baby-1/activities', {
    method: 'POST',
    headers: {
      authorization: 'Bearer st_live_test',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function getRequest(query = '') {
  return new Request(`http://localhost/api/hooks/v1/babies/baby-1/activities${query}`, {
    method: 'GET',
    headers: { authorization: 'Bearer st_live_test' },
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
    delegate.findMany.mockReset();
    delegate.findUnique.mockReset();
    delegate.create.mockReset();
    delegate.update.mockReset();
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
  mocks.prisma.caretaker.findFirst.mockResolvedValue(null);
  mocks.prisma.caretaker.findMany.mockResolvedValue([]);
  mocks.prisma.medicine.findFirst.mockResolvedValue({ id: 'medicine-1', name: 'Vitamin D', unitAbbr: 'ML' });
  mocks.prisma.medicine.findMany.mockResolvedValue([{ name: 'Vitamin D' }]);
});

describe('hooks activities POST route', () => {
  describe('happy paths (documented payloads must keep working)', () => {
    it('creates a feed activity', async () => {
      mocks.prisma.feedLog.create.mockResolvedValue({ id: 'feed-1', time: new Date('2026-07-20T10:00:00Z'), amount: 4 });

      const response = await POST(postRequest({ type: 'feed', feedType: 'formula', amount: 4, unitAbbr: 'OZ' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(mocks.prisma.feedLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: 'BOTTLE', bottleType: 'formula', amount: 4, unitAbbr: 'OZ' }),
      }));
    });

    it('creates a diaper activity', async () => {
      mocks.prisma.diaperLog.create.mockResolvedValue({ id: 'diaper-1', time: new Date('2026-07-20T10:00:00Z'), blowout: false, creamApplied: false });

      const response = await POST(postRequest({ type: 'diaper', diaperType: 'WET' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('starts a sleep session', async () => {
      mocks.prisma.sleepLog.create.mockResolvedValue({ id: 'sleep-1', startTime: new Date('2026-07-20T10:00:00Z') });

      const response = await POST(postRequest({ type: 'sleep', sleepType: 'NAP', action: 'start', location: 'Crib' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a note', async () => {
      mocks.prisma.note.create.mockResolvedValue({ id: 'note-1', time: new Date('2026-07-20T10:00:00Z') });

      const response = await POST(postRequest({ type: 'note', content: 'First smile today!', category: 'milestone' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('starts a pump session', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-1', startTime: new Date('2026-07-20T10:00:00Z') });

      const response = await POST(postRequest({ type: 'pump', action: 'start' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a bath activity', async () => {
      mocks.prisma.bathLog.create.mockResolvedValue({ id: 'bath-1', time: new Date('2026-07-20T10:00:00Z'), soapUsed: true, shampooUsed: false });

      const response = await POST(postRequest({ type: 'bath', bathType: 'Sponge Bath', soapUsed: true, shampooUsed: false, notes: 'Quick sponge bath' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a measurement', async () => {
      mocks.prisma.measurement.create.mockResolvedValue({ id: 'measurement-1', date: new Date('2026-07-20T10:00:00Z'), value: 18.5, unit: 'LB' });

      const response = await POST(postRequest({ type: 'measurement', measurementType: 'WEIGHT', value: 18.5, unit: 'LB' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a medicine dose', async () => {
      mocks.prisma.medicineLog.create.mockResolvedValue({ id: 'dose-1', time: new Date('2026-07-20T10:00:00Z'), doseAmount: 1.25, unitAbbr: 'ML', notes: null });

      const response = await POST(postRequest({ type: 'medicine', medicineName: 'Infant Tylenol', amount: 1.25, unitAbbr: 'ML' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a supplement dose', async () => {
      mocks.prisma.medicine.findFirst.mockResolvedValue({ id: 'supp-1', name: 'Vitamin D Drops', unitAbbr: 'ML' });
      mocks.prisma.medicineLog.create.mockResolvedValue({ id: 'dose-2', time: new Date('2026-07-20T10:00:00Z'), doseAmount: 1, unitAbbr: 'ML', notes: null });

      const response = await POST(postRequest({ type: 'supplement', supplementName: 'Vitamin D Drops', amount: 1, unitAbbr: 'ML' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });

    it('creates a play activity', async () => {
      mocks.prisma.playLog.create.mockResolvedValue({ id: 'play-1', startTime: new Date('2026-07-20T10:00:00Z') });

      const response = await POST(postRequest({ type: 'play', playType: 'TUMMY_TIME', duration: 15, notes: 'Really enjoyed it today' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
    });
  });

  describe('1. unknown-field rejection', () => {
    it('rejects amount on a pump log — the field the pump handler never consumed', async () => {
      const response = await POST(postRequest({ type: 'pump', action: 'log', duration: 1, amount: 5, unitAbbr: 'OZ' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_FIELD');
      expect(payload.error.message).toContain('amount');
      expect(mocks.prisma.pumpLog.create).not.toHaveBeenCalled();
    });

    it('rejects the guessed-but-wrong diaper cream field names', async () => {
      const response = await POST(postRequest({
        type: 'diaper', diaperType: 'BOTH', diaperCream: true, diaperCreamApplied: true, cream: true,
      }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_FIELD');
      expect(payload.error.message).toContain('diaperCream');
      expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
    });
  });

  describe('2. totalAmount writable on pump', () => {
    it('accepts totalAmount alone, leaving sides null', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-2', startTime: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'pump', action: 'log', duration: 1, totalAmount: 7, unitAbbr: 'OZ' }) as any, routeContext);

      expect(mocks.prisma.pumpLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leftAmount: null, rightAmount: null, totalAmount: 7 }),
      }));
    });

    it('derives totalAmount from sides when totalAmount is absent', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-3', startTime: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'pump', action: 'log', duration: 1, leftAmount: 3, rightAmount: 2, unitAbbr: 'OZ' }) as any, routeContext);

      expect(mocks.prisma.pumpLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leftAmount: 3, rightAmount: 2, totalAmount: 5 }),
      }));
    });

    it('prefers an explicit totalAmount over the sum of sides', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-4', startTime: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'pump', action: 'log', leftAmount: 3, rightAmount: 2, totalAmount: 9, unitAbbr: 'OZ' }) as any, routeContext);

      expect(mocks.prisma.pumpLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leftAmount: 3, rightAmount: 2, totalAmount: 9 }),
      }));
    });

    it('stores explicit zero sides as 0, not null, with a 0 total', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-5', startTime: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'pump', action: 'log', leftAmount: 0, rightAmount: 0, unitAbbr: 'OZ' }) as any, routeContext);

      expect(mocks.prisma.pumpLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leftAmount: 0, rightAmount: 0, totalAmount: 0 }),
      }));
    });

    it('leaves everything null when no amount fields are sent at all', async () => {
      mocks.prisma.pumpLog.create.mockResolvedValue({ id: 'pump-6', startTime: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'pump', action: 'log', duration: 10 }) as any, routeContext);

      expect(mocks.prisma.pumpLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ leftAmount: null, rightAmount: null, totalAmount: null }),
      }));
    });
  });

  describe('3. zero-vs-absent amounts', () => {
    it('stores an explicit feed amount of 0 as 0, not null', async () => {
      mocks.prisma.feedLog.create.mockResolvedValue({ id: 'feed-2', time: new Date('2026-07-20T10:00:00Z'), amount: 0 });

      await POST(postRequest({ type: 'feed', feedType: 'BOTTLE', amount: 0, unitAbbr: 'OZ' }) as any, routeContext);

      expect(mocks.prisma.feedLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ amount: 0 }),
      }));
    });

    it('rejects a medicine dose with amount omitted instead of fabricating a 0 dose', async () => {
      const response = await POST(postRequest({ type: 'medicine', medicineName: 'Infant Tylenol' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_AMOUNT');
      expect(mocks.prisma.medicineLog.create).not.toHaveBeenCalled();
    });

    it('rejects a medicine dose with amount explicitly null', async () => {
      const response = await POST(postRequest({ type: 'medicine', medicineName: 'Infant Tylenol', amount: null }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_AMOUNT');
      expect(mocks.prisma.medicineLog.create).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric medicine amount', async () => {
      const response = await POST(postRequest({ type: 'medicine', medicineName: 'Infant Tylenol', amount: 'lots' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_AMOUNT');
      expect(mocks.prisma.medicineLog.create).not.toHaveBeenCalled();
    });

    it('rejects a supplement dose with amount omitted', async () => {
      mocks.prisma.medicine.findFirst.mockResolvedValue({ id: 'supp-1', name: 'Vitamin D Drops', unitAbbr: 'ML' });

      const response = await POST(postRequest({ type: 'supplement', supplementName: 'Vitamin D Drops' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('INVALID_AMOUNT');
      expect(mocks.prisma.medicineLog.create).not.toHaveBeenCalled();
    });
  });

  describe('4. creamApplied', () => {
    it('accepts and stores a boolean creamApplied on diaper create', async () => {
      mocks.prisma.diaperLog.create.mockResolvedValue({ id: 'diaper-2', time: new Date('2026-07-20T10:00:00Z'), blowout: true, creamApplied: true });

      await POST(postRequest({ type: 'diaper', diaperType: 'BOTH', blowout: true, creamApplied: true }) as any, routeContext);

      expect(mocks.prisma.diaperLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ creamApplied: true }),
      }));
    });

    it('rejects a non-boolean creamApplied value', async () => {
      const response = await POST(postRequest({ type: 'diaper', diaperType: 'WET', creamApplied: 'true' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
    });

    it('includes creamApplied in the GET /activities diaper details', async () => {
      mocks.prisma.diaperLog.findMany.mockResolvedValue([{
        id: 'diaper-3', time: new Date('2026-07-20T10:00:00Z'), type: 'WET', condition: null, color: null, blowout: false, creamApplied: true, caretaker: null,
      }]);

      const response = await GET(getRequest('?type=diaper') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.activities[0].details.creamApplied).toBe(true);
    });
  });

  describe('5. strict booleans', () => {
    it('rejects a non-boolean soapUsed on bath', async () => {
      const response = await POST(postRequest({ type: 'bath', bathType: 'Sponge Bath', soapUsed: 'false' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(mocks.prisma.bathLog.create).not.toHaveBeenCalled();
    });

    it('rejects a non-boolean blowout on diaper', async () => {
      const response = await POST(postRequest({ type: 'diaper', diaperType: 'WET', blowout: 1 }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
    });

    it('still defaults soapUsed/shampooUsed to true when omitted (unchanged default)', async () => {
      mocks.prisma.bathLog.create.mockResolvedValue({ id: 'bath-2', time: new Date('2026-07-20T10:00:00Z'), soapUsed: true, shampooUsed: true });

      await POST(postRequest({ type: 'bath', bathType: 'Full Bath' }) as any, routeContext);

      expect(mocks.prisma.bathLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ soapUsed: true, shampooUsed: true }),
      }));
    });
  });

  describe('6. caretakerName miss', () => {
    it('returns CARETAKER_NOT_FOUND with available names when caretakerName does not match', async () => {
      mocks.prisma.caretaker.findFirst.mockResolvedValue(null);
      mocks.prisma.caretaker.findMany.mockResolvedValue([{ name: 'Mom' }, { name: 'Dad' }]);

      const response = await POST(postRequest({ type: 'note', content: 'note', caretakerName: 'Grandpa' }) as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(400);
      expect(payload.error.code).toBe('CARETAKER_NOT_FOUND');
      expect(payload.error.message).toContain('Mom');
      expect(payload.error.message).toContain('Dad');
      expect(mocks.prisma.note.create).not.toHaveBeenCalled();
    });

    it('resolves a matching caretakerName and attributes the activity', async () => {
      mocks.prisma.caretaker.findFirst.mockResolvedValue({ id: 'caretaker-1' });
      mocks.prisma.note.create.mockResolvedValue({ id: 'note-2', time: new Date('2026-07-20T10:00:00Z') });

      await POST(postRequest({ type: 'note', content: 'note', caretakerName: 'Mom' }) as any, routeContext);

      expect(mocks.prisma.note.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ caretakerId: 'caretaker-1' }),
      }));
    });
  });

  describe('7. dropped fields wired through', () => {
    it('persists notes on a medicine dose', async () => {
      mocks.prisma.medicineLog.create.mockResolvedValue({ id: 'dose-3', time: new Date('2026-07-20T10:00:00Z'), doseAmount: 1, unitAbbr: 'ML', notes: 'before nap' });

      await POST(postRequest({ type: 'medicine', medicineName: 'Vitamin D', amount: 1, unitAbbr: 'ML', notes: 'before nap' }) as any, routeContext);

      expect(mocks.prisma.medicineLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ notes: 'before nap' }),
      }));
    });

    it('persists notes on a supplement dose', async () => {
      mocks.prisma.medicine.findFirst.mockResolvedValue({ id: 'supp-1', name: 'Vitamin D Drops', unitAbbr: 'ML' });
      mocks.prisma.medicineLog.create.mockResolvedValue({ id: 'dose-4', time: new Date('2026-07-20T10:00:00Z'), doseAmount: 1, unitAbbr: 'ML', notes: 'with breakfast' });

      await POST(postRequest({ type: 'supplement', supplementName: 'Vitamin D Drops', amount: 1, unitAbbr: 'ML', notes: 'with breakfast' }) as any, routeContext);

      expect(mocks.prisma.medicineLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ notes: 'with breakfast' }),
      }));
    });

    it('wires caretakerId through on measurement create', async () => {
      mocks.prisma.caretaker.findFirst.mockResolvedValue({ id: 'caretaker-2' });
      mocks.prisma.measurement.create.mockResolvedValue({ id: 'measurement-2', date: new Date('2026-07-20T10:00:00Z'), value: 18.5, unit: 'LB' });

      await POST(postRequest({ type: 'measurement', measurementType: 'WEIGHT', value: 18.5, unit: 'LB', caretakerName: 'Mom' }) as any, routeContext);

      expect(mocks.prisma.measurement.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ caretakerId: 'caretaker-2' }),
      }));
    });

    it('resolves caretakerName on GET measurement instead of hardcoding null', async () => {
      mocks.prisma.measurement.findMany.mockResolvedValue([{
        id: 'measurement-3', date: new Date('2026-07-20T10:00:00Z'), type: 'WEIGHT', value: 18.5, unit: 'LB', caretaker: { name: 'Mom' },
      }]);

      const response = await GET(getRequest('?type=measurement') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.activities[0].caretakerName).toBe('Mom');
    });
  });
});
