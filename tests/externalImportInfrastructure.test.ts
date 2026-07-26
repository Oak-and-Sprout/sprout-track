import { describe, expect, it } from 'vitest';

import {
  createExternalImportExecutionPlan,
} from '../src/lib/importers/plan';
import {
  externalImportProvenanceKey,
  externalImportTargetEntityType,
} from '../src/lib/importers/provenance';
import {
  externalImportProviders,
  getExternalImportProvider,
} from '../src/lib/importers/registry';
import {
  externalImportDateToUtc,
  externalImportLocalTimeToUtc,
} from '../src/lib/importers/timezone';
import {
  ExternalImportBabyRecord,
  ExternalImportRecord,
  ExternalImportSleepRecord,
} from '../src/types/external-import';

{
// Consolidated from tests/externalImportPlan.test.ts
const baby: ExternalImportBabyRecord = {
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

describe('external import execution planning', () => {
  it('plans creation of a new baby before activities', () => {
    const plan = createExternalImportExecutionPlan(
      [sleep, baby],
      {
        sourceTimezone: 'Europe/Copenhagen',
        childDestinations: {
          '7': {
            mode: 'new',
            gender: 'FEMALE',
          },
        },
      },
    );

    expect(plan.newBabies).toEqual([
      {
        sourceRecord: baby,
        gender: 'FEMALE',
      },
    ]);
    expect(plan.existingBabyIds).toEqual([]);
    expect(plan.activityRecords).toEqual([sleep]);
  });

  it('plans import into an existing baby', () => {
    const plan = createExternalImportExecutionPlan(
      [sleep],
      {
        sourceTimezone: 'Europe/Copenhagen',
        childDestinations: {
          '7': {
            mode: 'existing',
            targetBabyId: 'target-baby',
          },
        },
      },
    );

    expect(plan.newBabies).toEqual([]);
    expect(plan.existingBabyIds).toEqual([
      'target-baby',
    ]);
    expect(plan.activityRecords).toEqual([sleep]);
  });

  it('deduplicates existing target baby IDs', () => {
    const secondSleep: ExternalImportSleepRecord = {
      ...sleep,
      source: {
        ...sleep.source,
        recordId: '13',
        childId: '8',
      },
      sourceChildId: '8',
    };

    const plan = createExternalImportExecutionPlan(
      [sleep, secondSleep],
      {
        sourceTimezone: 'UTC',
        childDestinations: {
          '7': {
            mode: 'existing',
            targetBabyId: 'target-baby',
          },
          '8': {
            mode: 'existing',
            targetBabyId: 'target-baby',
          },
        },
      },
    );

    expect(plan.existingBabyIds).toEqual([
      'target-baby',
    ]);
  });

  it('rejects a missing child destination', () => {
    expect(() =>
      createExternalImportExecutionPlan(
        [sleep],
        {
          sourceTimezone: 'Europe/Copenhagen',
          childDestinations: {},
        },
      ),
    ).toThrow(
      'Missing destination for source child: 7',
    );
  });

  it('rejects new-child mode without a child export', () => {
    expect(() =>
      createExternalImportExecutionPlan(
        [sleep],
        {
          sourceTimezone: 'Europe/Copenhagen',
          childDestinations: {
            '7': {
              mode: 'new',
              gender: 'MALE',
            },
          },
        },
      ),
    ).toThrow(
      'Cannot create source child without a child export: 7',
    );
  });

  it('rejects duplicate child source records', () => {
    expect(() =>
      createExternalImportExecutionPlan(
        [baby, baby],
        {
          sourceTimezone: 'Europe/Copenhagen',
          childDestinations: {
            '7': {
              mode: 'new',
              gender: 'MALE',
            },
          },
        },
      ),
    ).toThrow(
      'Duplicate source child record: 7',
    );
  });

  it('rejects a blank source timezone', () => {
    expect(() =>
      createExternalImportExecutionPlan(
        [baby],
        {
          sourceTimezone: '',
          childDestinations: {
            '7': {
              mode: 'new',
              gender: 'MALE',
            },
          },
        },
      ),
    ).toThrow('Source timezone is required');
  });
});

}


{
// Consolidated from tests/externalImportProvenance.test.ts
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

}


{
// Consolidated from tests/externalImportRegistry.test.ts
describe('external import provider registry', () => {
  it('registers Baby Buddy as a multi-file CSV provider', () => {
    const provider = getExternalImportProvider('baby-buddy');

    expect(provider).toEqual({
      id: 'baby-buddy',
      name: 'Baby Buddy',
      description:
        'Import children and activity history exported from Baby Buddy.',
      acceptedExtensions: ['.csv'],
      supportsMultipleFiles: true,
    });
  });

  it('returns undefined for an unknown provider', () => {
    expect(getExternalImportProvider('unknown')).toBeUndefined();
  });

  it('contains unique provider IDs', () => {
    const ids = externalImportProviders.map(provider => provider.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});

}


{
// Consolidated from tests/externalImportTimezone.test.ts
describe('external import timezone conversion', () => {
  it('converts Copenhagen winter time to UTC', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        'Europe/Copenhagen',
      ).toISOString(),
    ).toBe('2026-01-15T09:00:00.000Z');
  });

  it('converts Copenhagen summer time to UTC', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-07-15T10:00:00',
        'Europe/Copenhagen',
      ).toISOString(),
    ).toBe('2026-07-15T08:00:00.000Z');
  });

  it('preserves UTC input when UTC is selected', () => {
    expect(
      externalImportLocalTimeToUtc(
        '2026-07-15T10:00:00',
        'UTC',
      ).toISOString(),
    ).toBe('2026-07-15T10:00:00.000Z');
  });

  it('converts a date-only value to UTC midnight', () => {
    expect(
      externalImportDateToUtc('2026-01-15').toISOString(),
    ).toBe('2026-01-15T00:00:00.000Z');
  });

  it('rejects a missing timezone', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        '',
      ),
    ).toThrow('Source timezone is required');
  });

  it('rejects an invalid timezone', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        '2026-01-15T10:00:00',
        'Not/A-Timezone',
      ),
    ).toThrow('Invalid source timezone');
  });

  it('rejects an invalid local date-time', () => {
    expect(() =>
      externalImportLocalTimeToUtc(
        'not-a-date',
        'Europe/Copenhagen',
      ),
    ).toThrow('Invalid external import date-time');
  });
});

}
