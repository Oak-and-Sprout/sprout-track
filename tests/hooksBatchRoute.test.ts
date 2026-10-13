import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const delegate = () => ({ findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() });
  return {
    prisma: {
      apiKey: { findUnique: vi.fn(), update: vi.fn() },
      appConfig: { findFirst: vi.fn() },
      baby: { findFirst: vi.fn() },
      caretaker: { findFirst: vi.fn(), findMany: vi.fn() },
      unit: { findMany: vi.fn() },
      activeBreastFeed: { findUnique: vi.fn() },
      externalImportRecord: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
      feedLog: delegate(),
      diaperLog: delegate(),
      sleepLog: delegate(),
      note: delegate(),
    },
    notifyActivityCreated: vi.fn(() => Promise.resolve()),
    resetTimerNotificationState: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../app/api/db', () => ({ default: mocks.prisma }));
vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: mocks.notifyActivityCreated,
  resetTimerNotificationState: mocks.resetTimerNotificationState,
}));

import { POST as BATCH } from '../app/api/hooks/v1/babies/[babyId]/activities/batch/route';
import { POST } from '../app/api/hooks/v1/babies/[babyId]/activities/route';
import { clearRateLimitConfigCache } from '../app/api/hooks/v1/rate-limiter';

const routeContext = { params: Promise.resolve({ babyId: 'baby-1' }) };

function request(path: string, body: unknown) {
  return new Request(`http://localhost/api/hooks/v1/babies/baby-1/activities${path}`, {
    method: 'POST',
    headers: { authorization: 'Bearer st_live_test', 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function batch(body: unknown) {
  const response = await BATCH(request('/batch', body) as any, routeContext);
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

async function post(body: unknown) {
  const response = await POST(request('', body) as any, routeContext);
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}

const diaper = (extra: Record<string, unknown> = {}) => ({ type: 'diaper', time: '2025-08-01T08:00:00Z', diaperType: 'WET', ...extra });
const p2002 = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

let key: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  for (const d of [mocks.prisma.feedLog, mocks.prisma.diaperLog, mocks.prisma.sleepLog, mocks.prisma.note]) {
    d.create.mockReset().mockImplementation(async ({ data }: any) => ({ id: `row-${crypto.randomUUID()}`, ...data }));
  }
  for (const fn of Object.values(mocks.prisma.externalImportRecord)) fn.mockReset();
  mocks.prisma.externalImportRecord.create.mockImplementation(async ({ data }: any) => ({ id: `claim-${crypto.randomUUID()}`, ...data }));
  mocks.prisma.externalImportRecord.update.mockResolvedValue({});
  mocks.prisma.externalImportRecord.delete.mockResolvedValue({});
  key = { id: `key-${crypto.randomUUID()}`, familyId: 'family-1', babyId: null, scopes: JSON.stringify(['read', 'write']), revoked: false, expiresAt: null };
  mocks.prisma.apiKey.findUnique.mockImplementation(async () => key);
  mocks.prisma.apiKey.update.mockResolvedValue({});
  mocks.prisma.appConfig.findFirst.mockResolvedValue(null);
  clearRateLimitConfigCache();
  mocks.prisma.baby.findFirst.mockResolvedValue({ id: 'baby-1', familyId: 'family-1' });
  mocks.prisma.caretaker.findFirst.mockResolvedValue(null);
  mocks.prisma.caretaker.findMany.mockResolvedValue([]);
  mocks.prisma.unit.findMany.mockResolvedValue([{ unitAbbr: 'OZ' }]);
});

describe('POST /activities/batch', () => {
  it('creates each item in order and reports per-item results', async () => {
    const { status, body } = await batch({
      activities: [
        diaper(),
        { type: 'note', time: '2025-08-01T09:00:00Z', content: 'first tooth' },
        { type: 'feed', time: '2025-08-01T10:00:00Z', feedType: 'formula', amount: 4, unitAbbr: 'oz' },
        { type: 'sleep', time: '2025-08-01T11:00:00Z', action: 'log', sleepType: 'NAP', duration: 45 },
      ],
    });
    expect(status).toBe(200);
    expect(body.data).toMatchObject({ created: 4, duplicates: 0, failed: 0 });
    expect(body.data.results.map((r: any) => [r.index, r.success, r.data.activityType])).toEqual([
      [0, true, 'diaper'], [1, true, 'note'], [2, true, 'feed'], [3, true, 'sleep'],
    ]);
    expect(mocks.prisma.feedLog.create.mock.calls[0][0].data).toMatchObject({ familyId: 'family-1', babyId: 'baby-1', unitAbbr: 'OZ', bottleType: 'Formula' });
  });

  it('never sends notifications or resets notification timers', async () => {
    await batch({ activities: [diaper(), { type: 'feed', feedType: 'BOTTLE', amount: 3 }] });
    expect(mocks.prisma.diaperLog.create).toHaveBeenCalled();
    expect(mocks.notifyActivityCreated).not.toHaveBeenCalled();
    expect(mocks.resetTimerNotificationState).not.toHaveBeenCalled();
  });

  it('rejects timer actions per item and still creates the rest', async () => {
    const { body } = await batch({
      activities: [
        { type: 'sleep', action: 'start', sleepType: 'NAP' },
        { type: 'feed', feedType: 'BREAST', action: 'start', side: 'LEFT' },
        { type: 'pump', action: 'end' },
        diaper(),
      ],
    });
    expect(body.data).toMatchObject({ created: 1, failed: 3 });
    expect(body.data.results.slice(0, 3).map((r: any) => r.error.code)).toEqual(['INVALID_ACTION', 'INVALID_ACTION', 'INVALID_ACTION']);
    expect(mocks.prisma.sleepLog.create).not.toHaveBeenCalled();
    expect(mocks.prisma.activeBreastFeed.findUnique).not.toHaveBeenCalled();
  });

  it('reports validation errors per item with the same codes as single POST', async () => {
    const { body } = await batch({ activities: [diaper({ diaperType: 'SOAKED' }), 'nope', [1], { type: 'bogus' }, diaper()] });
    expect(body.data).toMatchObject({ created: 1, failed: 4 });
    expect(body.data.results.map((r: any) => r.error?.code ?? 'ok')).toEqual(['INVALID_DIAPER_TYPE', 'INVALID_ITEM', 'INVALID_ITEM', 'INVALID_ACTIVITY_TYPE', 'ok']);
  });

  it('isolates an unexpected failure to its item', async () => {
    mocks.prisma.diaperLog.create.mockRejectedValueOnce(new Error('database is locked'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { status, body } = await batch({ activities: [diaper(), diaper()] });
    expect(status).toBe(200);
    expect(body.data.results.map((r: any) => r.success)).toEqual([false, true]);
    expect(body.data.results[0].error.code).toBe('INTERNAL_ERROR');
    error.mockRestore();
  });

  it.each([
    ['a missing activities array', {}],
    ['a non-array', { activities: diaper() }],
    ['an empty array', { activities: [] }],
    ['more than 100 items', { activities: Array.from({ length: 101 }, () => diaper()) }],
  ])('rejects %s with 400 INVALID_BATCH and creates nothing', async (_label, body) => {
    const result = await batch(body);
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('INVALID_BATCH');
    expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
  });

  it('accepts exactly 100 items', async () => {
    const { body } = await batch({ activities: Array.from({ length: 100 }, () => diaper()) });
    expect(body.data.created).toBe(100);
  });

  it('rejects invalid JSON', async () => {
    const { status, body } = await batch('{not json');
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_JSON');
  });

  it('requires the write scope', async () => {
    key = { ...key, scopes: JSON.stringify(['read']) };
    const { status } = await batch({ activities: [diaper()] });
    expect(status).toBe(403);
    expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
  });

  it('refuses a baby the key is not scoped to', async () => {
    key = { ...key, babyId: 'baby-2' };
    const { status } = await batch({ activities: [diaper()] });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
  });

  it('has its own rate limit bucket, separate from single writes', async () => {
    mocks.prisma.appConfig.findFirst.mockResolvedValue({ hooksReadsPerMinute: 60, hooksWritesPerMinute: 30, hooksBatchPerMinute: 1 });
    clearRateLimitConfigCache();
    expect((await batch({ activities: [diaper()] })).status).toBe(200);
    const limited = await batch({ activities: [diaper()] });
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toContain('batch');
    expect((await post(diaper())).status).toBe(200);
  });
});

describe('externalId idempotency', () => {
  it('records the created activity against the externalId', async () => {
    const { body } = await post(diaper({ externalId: 'src-1' }));
    expect(body.success).toBe(true);
    expect(mocks.prisma.externalImportRecord.create).toHaveBeenCalledWith({
      data: { familyId: 'family-1', providerId: 'webhook', sourceEntityType: 'diaper', sourceRecordId: 'src-1', sourceChildId: 'baby-1', targetEntityType: 'diaper', targetRecordId: '' },
    });
    expect(mocks.prisma.externalImportRecord.update.mock.calls[0][0].data).toEqual({ targetEntityType: 'diaper', targetRecordId: body.data.id });
  });

  it('returns the original activity for a replayed externalId without creating another', async () => {
    mocks.prisma.externalImportRecord.create.mockRejectedValue(p2002());
    mocks.prisma.externalImportRecord.findUnique.mockResolvedValue({ id: 'rec-1', targetEntityType: 'diaper', targetRecordId: 'diaper-9', importedAt: new Date() });
    const { status, body } = await post(diaper({ externalId: 'src-1' }));
    expect(status).toBe(200);
    expect(body.data).toEqual({ activityType: 'diaper', id: 'diaper-9', duplicate: true });
    expect(mocks.prisma.externalImportRecord.findUnique).toHaveBeenCalledWith({
      where: { familyId_providerId_sourceEntityType_sourceRecordId: { familyId: 'family-1', providerId: 'webhook', sourceEntityType: 'diaper', sourceRecordId: 'src-1' } },
    });
    expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
  });

  it('counts replays as duplicates in a batch', async () => {
    mocks.prisma.externalImportRecord.create
      .mockRejectedValueOnce(p2002())
      .mockImplementation(async ({ data }: any) => ({ id: 'claim-2', ...data }));
    mocks.prisma.externalImportRecord.findUnique.mockResolvedValue({ id: 'rec-1', targetEntityType: 'diaper', targetRecordId: 'diaper-9', importedAt: new Date() });
    const { body } = await batch({ activities: [diaper({ externalId: 'old' }), diaper({ externalId: 'new' })] });
    expect(body.data).toMatchObject({ created: 1, duplicates: 1, failed: 0 });
  });

  it('answers 409 while another request holds a fresh claim', async () => {
    mocks.prisma.externalImportRecord.create.mockRejectedValue(p2002());
    mocks.prisma.externalImportRecord.findUnique.mockResolvedValue({ id: 'rec-1', targetEntityType: 'diaper', targetRecordId: '', importedAt: new Date() });
    const { status, body } = await post(diaper({ externalId: 'src-1' }));
    expect(status).toBe(409);
    expect(body.error.code).toBe('EXTERNAL_ID_IN_PROGRESS');
    expect(mocks.prisma.diaperLog.create).not.toHaveBeenCalled();
  });

  it('takes over a claim left behind by a crashed request', async () => {
    mocks.prisma.externalImportRecord.create
      .mockRejectedValueOnce(p2002())
      .mockImplementation(async ({ data }: any) => ({ id: 'claim-2', ...data }));
    mocks.prisma.externalImportRecord.findUnique.mockResolvedValue({ id: 'stale', targetEntityType: 'diaper', targetRecordId: '', importedAt: new Date(Date.now() - 120_000) });
    const { status } = await post(diaper({ externalId: 'src-1' }));
    expect(status).toBe(200);
    expect(mocks.prisma.externalImportRecord.deleteMany).toHaveBeenCalledWith({ where: { id: 'stale', targetRecordId: '' } });
    expect(mocks.prisma.diaperLog.create).toHaveBeenCalledTimes(1);
  });

  it('releases the claim when the activity fails validation, so a corrected retry can succeed', async () => {
    const { status } = await post(diaper({ externalId: 'src-1', diaperType: 'SOAKED' }));
    expect(status).toBe(400);
    expect(mocks.prisma.externalImportRecord.delete).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.externalImportRecord.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a number', 42],
    ['an empty string', ''],
    ['whitespace', '   '],
    ['over 255 characters', 'x'.repeat(256)],
  ])('rejects an externalId that is %s', async (_label, externalId) => {
    const { status, body } = await post(diaper({ externalId }));
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_EXTERNAL_ID');
    expect(mocks.prisma.externalImportRecord.create).not.toHaveBeenCalled();
  });

  it('rejects externalId on timer actions', async () => {
    const { status, body } = await post({ type: 'sleep', action: 'start', sleepType: 'NAP', externalId: 'src-1' });
    expect(status).toBe(400);
    expect(body.error.code).toBe('INVALID_EXTERNAL_ID');
  });

  it('keeps single POST notifications', async () => {
    await post(diaper({ externalId: 'src-1' }));
    expect(mocks.notifyActivityCreated).toHaveBeenCalledWith('baby-1', 'diaper', { caretakerId: null }, { type: 'WET' });
    expect(mocks.resetTimerNotificationState).toHaveBeenCalledWith('baby-1', 'diaper');
  });
});
