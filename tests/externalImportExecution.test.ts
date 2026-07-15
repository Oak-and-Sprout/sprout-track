import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  executeExternalImport,
} from '../src/lib/importers/execute';
import {
  ExternalImportBabyRecord,
  ExternalImportSleepRecord,
} from '../src/types/external-import';

const babyRecord: ExternalImportBabyRecord = {
  targetType: 'baby',
  source: {
    providerId: 'baby-buddy',
    entityType: 'child',
    recordId: '7',
    childId: '7',
  },
  firstName: 'Test',
  lastName: 'Child',
  birthDate: '2026-01-01',
};

const sleepRecord: ExternalImportSleepRecord = {
  targetType: 'sleep',
  source: {
    providerId: 'baby-buddy',
    entityType: 'sleep',
    recordId: '12',
    childId: '7',
  },
  sourceChildId: '7',
  startTime: '2026-01-15T10:00:00',
  endTime: '2026-01-15T11:00:00',
  type: 'NAP',
};

function createTransactionMock() {
  return {
    baby: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    externalImportRecord: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    sleepLog: {
      create: vi.fn(),
    },
    feedLog: {
      create: vi.fn(),
    },
    diaperLog: {
      create: vi.fn(),
    },
    note: {
      create: vi.fn(),
    },
    measurement: {
      create: vi.fn(),
    },
    pumpLog: {
      create: vi.fn(),
    },
    playLog: {
      create: vi.fn(),
    },
  };
}

describe('external import execution', () => {
  it('creates a new baby and activity with provenance', async () => {
    const tx = createTransactionMock();

    tx.externalImportRecord.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    tx.externalImportRecord.create
      .mockResolvedValue({ id: 'provenance' });

    tx.baby.create.mockResolvedValue({
      id: 'baby-new',
    });

    tx.sleepLog.create.mockResolvedValue({
      id: 'sleep-new',
    });

    const result = await executeExternalImport(
      tx as unknown as Prisma.TransactionClient,
      {
        familyId: 'family-1',
        caretakerId: 'caretaker-1',
        records: [sleepRecord, babyRecord],
        configuration: {
          sourceTimezone: 'Europe/Copenhagen',
          childDestinations: {
            '7': {
              mode: 'new',
              gender: 'FEMALE',
            },
          },
        },
      },
    );

    expect(tx.baby.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyId: 'family-1',
        firstName: 'Test',
        lastName: 'Child',
        gender: 'FEMALE',
        birthDate: new Date(
          '2026-01-01T00:00:00.000Z',
        ),
      }),
    });

    expect(tx.sleepLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        familyId: 'family-1',
        caretakerId: 'caretaker-1',
        babyId: 'baby-new',
        startTime: new Date(
          '2026-01-15T09:00:00.000Z',
        ),
        endTime: new Date(
          '2026-01-15T10:00:00.000Z',
        ),
        duration: 60,
        type: 'NAP',
      }),
    });

    expect(
      tx.externalImportRecord.create,
    ).toHaveBeenCalledTimes(2);

    expect(result).toEqual(
      expect.objectContaining({
        created: 2,
        duplicates: 0,
        babyMappings: {
          '7': 'baby-new',
        },
      }),
    );
  });

  it('rejects an existing baby outside the family', async () => {
    const tx = createTransactionMock();

    tx.baby.findMany.mockResolvedValue([]);

    await expect(
      executeExternalImport(
        tx as unknown as Prisma.TransactionClient,
        {
          familyId: 'family-1',
          records: [sleepRecord],
          configuration: {
            sourceTimezone: 'Europe/Copenhagen',
            childDestinations: {
              '7': {
                mode: 'existing',
                targetBabyId: 'other-family-baby',
              },
            },
          },
        },
      ),
    ).rejects.toThrow(
      'One or more target babies were not found in this family',
    );

    expect(tx.sleepLog.create).not.toHaveBeenCalled();
    expect(
      tx.externalImportRecord.create,
    ).not.toHaveBeenCalled();
  });

  it('skips an activity with existing provenance', async () => {
    const tx = createTransactionMock();

    tx.baby.findMany.mockResolvedValue([
      {
        id: 'baby-existing',
      },
    ]);

    tx.externalImportRecord.findUnique.mockResolvedValue({
      id: 'provenance-existing',
      targetRecordId: 'sleep-existing',
    });

    const result = await executeExternalImport(
      tx as unknown as Prisma.TransactionClient,
      {
        familyId: 'family-1',
        records: [sleepRecord],
        configuration: {
          sourceTimezone: 'Europe/Copenhagen',
          childDestinations: {
            '7': {
              mode: 'existing',
              targetBabyId: 'baby-existing',
            },
          },
        },
      },
    );

    expect(tx.sleepLog.create).not.toHaveBeenCalled();
    expect(
      tx.externalImportRecord.create,
    ).not.toHaveBeenCalled();

    expect(result).toEqual({
      created: 0,
      duplicates: 1,
      records: [
        {
          providerId: 'baby-buddy',
          sourceEntityType: 'sleep',
          sourceRecordId: '12',
          targetEntityType: 'SleepLog',
          targetRecordId: 'sleep-existing',
          status: 'duplicate',
        },
      ],
      babyMappings: {
        '7': 'baby-existing',
      },
    });
  });

  it('rejects conflicting previous child mappings', async () => {
    const tx = createTransactionMock();

    tx.baby.findMany.mockResolvedValue([
      {
        id: 'baby-existing',
      },
    ]);

    tx.externalImportRecord.findUnique.mockResolvedValue({
      id: 'provenance-existing',
      targetRecordId: 'different-baby',
    });

    await expect(
      executeExternalImport(
        tx as unknown as Prisma.TransactionClient,
        {
          familyId: 'family-1',
          records: [babyRecord],
          configuration: {
            sourceTimezone: 'UTC',
            childDestinations: {
              '7': {
                mode: 'existing',
                targetBabyId: 'baby-existing',
              },
            },
          },
        },
      ),
    ).rejects.toThrow(
      'Source child 7 was previously mapped to another baby',
    );
  });
});
