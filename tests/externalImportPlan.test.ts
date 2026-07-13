import { describe, expect, it } from 'vitest';
import {
  createExternalImportExecutionPlan,
} from '../src/lib/importers/plan';
import {
  ExternalImportBabyRecord,
  ExternalImportSleepRecord,
} from '../src/types/external-import';

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
