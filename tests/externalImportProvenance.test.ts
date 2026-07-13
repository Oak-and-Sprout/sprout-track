import { describe, expect, it } from 'vitest';
import {
  externalImportProvenanceKey,
  externalImportTargetEntityType,
} from '../src/lib/importers/provenance';
import {
  ExternalImportRecord,
  ExternalImportSleepRecord,
} from '../src/types/external-import';

const sleep: ExternalImportSleepRecord = {
  targetType: 'sleep',
  source: {
    providerId: 'baby-buddy',
    entityType: 'sleep',
    recordId: '12',
    childId: '7',
  },
  sourceChildId: '7',
  startTime: '2026-01-02T10:00:00',
  endTime: '2026-01-02T11:00:00',
  type: 'NAP',
};

describe('external import provenance', () => {
  it('creates a family-scoped provenance key', () => {
    expect(
      externalImportProvenanceKey(
        'family-1',
        sleep.source,
      ),
    ).toEqual({
      familyId: 'family-1',
      providerId: 'baby-buddy',
      sourceEntityType: 'sleep',
      sourceRecordId: '12',
    });
  });

  it('rejects a missing family ID', () => {
    expect(() =>
      externalImportProvenanceKey('', sleep.source),
    ).toThrow('Family ID is required');
  });

  it.each([
    ['baby', 'Baby'],
    ['sleep', 'SleepLog'],
    ['feed', 'FeedLog'],
    ['diaper', 'DiaperLog'],
    ['note', 'Note'],
    ['measurement', 'Measurement'],
    ['pump', 'PumpLog'],
    ['play', 'PlayLog'],
  ] as const)(
    'maps %s to Prisma model %s',
    (targetType, expected) => {
      const record = {
        ...sleep,
        targetType,
      } as unknown as ExternalImportRecord;

      expect(
        externalImportTargetEntityType(record),
      ).toBe(expected);
    },
  );
});
