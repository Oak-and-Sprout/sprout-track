import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Editing a medicine log in /api/medicine-log (#299): a changed medicineId is
 * saved, but only for a medicine of the caller's family; the other ownership
 * fields stay untouchable.
 */

const mocks = vi.hoisted(() => ({
  prisma: {
    medicine: { findFirst: vi.fn() },
    medicineLog: { findFirst: vi.fn(), update: vi.fn() },
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
vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: vi.fn(),
  resetTimerNotificationState: vi.fn(),
}));

import { PUT } from '../app/api/medicine-log/route';

const FAMILY_MEDICINES = [
  { id: 'tylenol', familyId: 'fam-1' },
  { id: 'vitamin-d', familyId: 'fam-1' },
];

function put(body: unknown) {
  return new NextRequest('http://localhost/api/medicine-log?id=log-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.medicineLog.findFirst.mockResolvedValue({ id: 'log-1', familyId: 'fam-1', medicineId: 'tylenol' });
  mocks.prisma.medicine.findFirst.mockImplementation(({ where }: { where: { id: string; familyId: string } }) =>
    Promise.resolve(FAMILY_MEDICINES.find(m => m.id === where.id && m.familyId === where.familyId) ?? null));
  mocks.prisma.medicineLog.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: 'log-1', familyId: 'fam-1', medicineId: 'tylenol', time: new Date(),
      createdAt: new Date(), updatedAt: new Date(), deletedAt: null, ...data,
    }));
});

describe('PUT /api/medicine-log', () => {
  it('saves a medicine changed to another one of the family', async () => {
    const response = await PUT(put({ medicineId: 'vitamin-d', doseAmount: 1 }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.medicineId).toBe('vitamin-d');
    expect(mocks.prisma.medicine.findFirst).toHaveBeenCalledWith({
      where: { id: 'vitamin-d', familyId: 'fam-1', deletedAt: null },
    });
    expect(mocks.prisma.medicineLog.update.mock.calls[0][0].data).toMatchObject({ medicineId: 'vitamin-d', doseAmount: 1 });
  });

  it('refuses a medicine of another family', async () => {
    const response = await PUT(put({ medicineId: 'other-family-medicine' }));

    expect(response.status).toBe(404);
    expect(mocks.prisma.medicineLog.update).not.toHaveBeenCalled();
  });

  it('leaves the medicine alone when it did not change', async () => {
    const response = await PUT(put({ medicineId: 'tylenol', doseAmount: 2 }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.medicine.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.medicineLog.update.mock.calls[0][0].data).not.toHaveProperty('medicineId');
  });

  it('still ignores familyId, babyId and caretakerId from the body', async () => {
    await PUT(put({ familyId: 'fam-2', babyId: 'baby-2', caretakerId: 'ct-2', doseAmount: 1 }));

    const data = mocks.prisma.medicineLog.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('familyId');
    expect(data).not.toHaveProperty('babyId');
    expect(data).not.toHaveProperty('caretakerId');
  });
});
