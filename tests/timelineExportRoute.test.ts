import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const findMany = () => ({ findMany: vi.fn() });

  return {
    prisma: {
      baby: { findFirst: vi.fn() },
      sleepLog: findMany(),
      feedLog: findMany(),
      diaperLog: findMany(),
      note: findMany(),
      bathLog: findMany(),
      pumpLog: findMany(),
      playLog: findMany(),
      milestone: findMany(),
      measurement: findMany(),
      medicineLog: findMany(),
      breastMilkAdjustment: findMany(),
      vaccineLog: findMany(),
      foodLog: findMany(),
    },
  };
});

vi.mock('../app/api/db', () => ({
  default: mocks.prisma,
}));

vi.mock('../app/api/utils/auth', () => ({
  withAuthContext:
    (handler: (request: Request, auth: Record<string, unknown>) => Promise<Response>) =>
    (request: Request) =>
      handler(request, { authenticated: true, familyId: 'family-1' }),
}));

import { GET } from '../app/api/timeline/export/route';

function exportRequest(format: 'csv' | 'xlsx') {
  return new Request(
    'http://localhost/api/timeline/export?babyId=baby-1' +
      '&startDate=2026-08-23T22%3A00%3A00.000Z' +
      '&endDate=2026-08-31T21%3A59%3A59.999Z' +
      `&format=${format}&timezone=Europe%2FWarsaw&language=pl`
  );
}

const findManyDelegates = [
  mocks.prisma.sleepLog,
  mocks.prisma.feedLog,
  mocks.prisma.diaperLog,
  mocks.prisma.note,
  mocks.prisma.bathLog,
  mocks.prisma.pumpLog,
  mocks.prisma.playLog,
  mocks.prisma.milestone,
  mocks.prisma.measurement,
  mocks.prisma.medicineLog,
  mocks.prisma.breastMilkAdjustment,
  mocks.prisma.vaccineLog,
  mocks.prisma.foodLog,
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.baby.findFirst.mockResolvedValue({
    id: 'baby-1',
    familyId: 'family-1',
    firstName: 'Łucja',
    lastName: 'Żółć',
  });
  for (const delegate of findManyDelegates) {
    delegate.findMany.mockResolvedValue([]);
  }
  mocks.prisma.feedLog.findMany.mockResolvedValue([
    {
      id: 'feed-1',
      babyId: 'baby-1',
      familyId: 'family-1',
      time: new Date('2026-08-31T10:00:00.000Z'),
      type: 'BOTTLE',
      amount: 120,
      unitAbbr: 'ML',
      bottleType: 'Formula',
      caretaker: { name: 'Mama' },
    },
  ]);
});

describe('timeline export route', () => {
  it.each([
    ['csv', 'text/csv'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ] as const)('downloads %s when the baby name contains Polish characters', async (format, contentType) => {
    const response = await GET(exportRequest(format) as any);
    const disposition = response.headers.get('content-disposition');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain(contentType);
    expect(disposition).toMatch(
      new RegExp(
        `^attachment; filename="activity-log-_ucja-Zo_c-\\d{4}-\\d{2}-\\d{2}\\.${format}"; ` +
          `filename\\*=UTF-8''activity-log-%C5%81ucja-%C5%BB%C3%B3%C5%82%C4%87-\\d{4}-\\d{2}-\\d{2}\\.${format}$`
      )
    );
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });
});
