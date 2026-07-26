import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
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
        findMany: vi.fn(),
      },
      sleepLog: {
        findMany: vi.fn(),
      },
      playLog: {
        findMany: vi.fn(),
      },
      unit: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('../app/api/db', () => ({
  default: mocks.prisma,
}));

import { GET } from '../app/api/hooks/v1/babies/[babyId]/reference/route';

const routeContext = {
  params: Promise.resolve({ babyId: 'baby-1' }),
};

function getRequest(query = '') {
  return new Request(`http://localhost/api/hooks/v1/babies/baby-1/reference${query}`, {
    method: 'GET',
    headers: { authorization: 'Bearer st_live_test' },
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

beforeEach(() => {
  vi.clearAllMocks();
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
  mocks.prisma.medicine.findMany.mockResolvedValue([]);
  mocks.prisma.sleepLog.findMany.mockResolvedValue([]);
  mocks.prisma.playLog.findMany.mockResolvedValue([]);
  mocks.prisma.unit.findMany.mockResolvedValue([
    { unitAbbr: 'ML', unitName: 'Milliliters' },
    { unitAbbr: 'OZ', unitName: 'Ounces' },
  ]);
});

describe('hooks reference route', () => {
  describe('new reference types', () => {
    it('returns the canonical diaper conditions', async () => {
      const response = await GET(getRequest('?type=diaper-conditions') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.diaperConditions).toEqual(['NORMAL', 'LOOSE', 'FIRM', 'OTHER']);
    });

    it('returns the canonical diaper colors', async () => {
      const response = await GET(getRequest('?type=diaper-colors') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.diaperColors).toEqual(['YELLOW', 'BROWN', 'GREEN', 'BLACK', 'RED', 'OTHER']);
    });

    it('returns the canonical sleep qualities', async () => {
      const response = await GET(getRequest('?type=sleep-qualities') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.sleepQualities).toEqual(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']);
    });

    it('returns the canonical bath types', async () => {
      const response = await GET(getRequest('?type=bath-types') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.bathTypes).toEqual(['Full Bath', 'Sponge Bath', 'Wipe Down']);
    });

    it('returns units from the Unit table', async () => {
      const response = await GET(getRequest('?type=units') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.units).toEqual([
        { unitAbbr: 'ML', unitName: 'Milliliters' },
        { unitAbbr: 'OZ', unitName: 'Ounces' },
      ]);
    });

    it('includes all new types in an unfiltered request', async () => {
      const response = await GET(getRequest() as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data).toHaveProperty('diaperConditions');
      expect(payload.data).toHaveProperty('diaperColors');
      expect(payload.data).toHaveProperty('sleepQualities');
      expect(payload.data).toHaveProperty('bathTypes');
      expect(payload.data).toHaveProperty('units');
    });
  });

  describe('sleep-locations dedup', () => {
    it('collapses a legacy underscore token onto its display-cased default (item 5)', async () => {
      mocks.prisma.sleepLog.findMany.mockResolvedValue([{ location: 'CAR_SEAT' }]);

      const response = await GET(getRequest('?type=sleep-locations') as any, routeContext);
      const payload = await json(response);

      expect(response.status).toBe(200);
      expect(payload.data.sleepLocations).toContain('Car Seat');
      expect(payload.data.sleepLocations).not.toContain('CAR_SEAT');
      expect(payload.data.sleepLocations.filter((l: string) => l.toLowerCase().replace(/[\s_]+/g, '') === 'carseat')).toHaveLength(1);
    });

    it('prefers a later display-cased custom location over an earlier underscore/caps variant', async () => {
      mocks.prisma.sleepLog.findMany.mockResolvedValue([{ location: 'GRANDMAS_HOUSE' }, { location: 'Grandmas House' }]);

      const response = await GET(getRequest('?type=sleep-locations') as any, routeContext);
      const payload = await json(response);

      expect(payload.data.sleepLocations).toContain('Grandmas House');
      expect(payload.data.sleepLocations).not.toContain('GRANDMAS_HOUSE');
    });

    it('still deduplicates pure case variants as before', async () => {
      mocks.prisma.sleepLog.findMany.mockResolvedValue([{ location: 'crib' }]);

      const response = await GET(getRequest('?type=sleep-locations') as any, routeContext);
      const payload = await json(response);

      expect(payload.data.sleepLocations.filter((l: string) => l.toLowerCase() === 'crib')).toHaveLength(1);
      expect(payload.data.sleepLocations).toContain('Crib');
    });

    it('keeps unrelated custom locations untouched', async () => {
      mocks.prisma.sleepLog.findMany.mockResolvedValue([{ location: 'Grandparents House' }]);

      const response = await GET(getRequest('?type=sleep-locations') as any, routeContext);
      const payload = await json(response);

      expect(payload.data.sleepLocations).toContain('Grandparents House');
    });
  });

  it('rejects an unknown reference type', async () => {
    const response = await GET(getRequest('?type=bogus-type') as any, routeContext);
    const payload = await json(response);

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_REF_TYPE');
  });
});
