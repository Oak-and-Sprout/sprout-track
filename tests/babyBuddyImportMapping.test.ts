import { describe, expect, it } from 'vitest';

import {
  buildBabyBuddyImportRecords,
  mapBabyBuddyChild,
  mapBabyBuddyNote,
  mapBabyBuddySleep,
} from '../src/lib/importers/baby-buddy';
import {
  mapBabyBuddyDiaperChange,
  mapBabyBuddyFeeding,
} from '../src/lib/importers/baby-buddy';
import {
  mapBabyBuddyMeasurement,
  mapBabyBuddyPumping,
  mapBabyBuddyTummyTime,
} from '../src/lib/importers/baby-buddy';

{
// Consolidated from tests/babyBuddyMapping.test.ts
describe('Baby Buddy record mapping', () => {
  it('maps a child without importing birth time', () => {
    expect(
      mapBabyBuddyChild({
        id: '7',
        first_name: 'Test',
        last_name: 'Child',
        birth_date: '2026-01-01',
        birth_time: '12:30:00',
      }),
    ).toEqual({
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
    });
  });

  it.each([
    ['1', 'NAP'],
    ['0', 'NIGHT_SLEEP'],
  ] as const)(
    'maps nap=%s to %s',
    (nap, expectedType) => {
      expect(
        mapBabyBuddySleep({
          id: '12',
          child_id: '7',
          start: '2026-01-01 10:00:00',
          end: '2026-01-01 11:00:00',
          nap,
        }),
      ).toEqual({
        targetType: 'sleep',
        source: {
          providerId: 'baby-buddy',
          entityType: 'sleep',
          recordId: '12',
          childId: '7',
        },
        sourceChildId: '7',
        startTime: '2026-01-01T10:00:00',
        endTime: '2026-01-01T11:00:00',
        type: expectedType,
      });
    },
  );

  it('maps a standalone note', () => {
    expect(
      mapBabyBuddyNote({
        id: '3',
        child_id: '7',
        note: 'A test note',
        time: '2026-01-01 12:00:00',
      }),
    ).toEqual({
      targetType: 'note',
      source: {
        providerId: 'baby-buddy',
        entityType: 'note',
        recordId: '3',
        childId: '7',
      },
      sourceChildId: '7',
      time: '2026-01-01T12:00:00',
      content: 'A test note',
    });
  });

  it('rejects a missing required source field', () => {
    expect(() =>
      mapBabyBuddySleep({
        id: '12',
        child_id: '',
        start: '2026-01-01 10:00:00',
        end: '2026-01-01 11:00:00',
        nap: '1',
      }),
    ).toThrow('Required field is missing: child_id');
  });

  it('rejects an invalid Baby Buddy date-time', () => {
    expect(() =>
      mapBabyBuddyNote({
        id: '3',
        child_id: '7',
        note: 'A test note',
        time: 'not-a-date',
      }),
    ).toThrow('Invalid Baby Buddy date-time');
  });
});

describe('Baby Buddy server-side record building', () => {
  it('builds normalised records from multiple exports', () => {
    const records = buildBabyBuddyImportRecords(
      [
        {
          name: 'Child.csv',
          content: [
            'id,first_name,last_name,birth_date,birth_time',
            '7,Test,Child,2026-01-01,12:30:00',
          ].join('\n'),
        },
        {
          name: 'Sleep.csv',
          content: [
            'id,child_id,start,end,nap,notes,tags',
            '12,7,2026-01-02 10:00:00,2026-01-02 11:00:00,1,,',
          ].join('\n'),
        },
      ],
      {},
    );

    expect(records).toHaveLength(2);
    expect(records.map(record => record.targetType)).toEqual([
      'baby',
      'sleep',
    ]);
  });

  it('requires a unit for populated bottle amounts', () => {
    expect(() =>
      buildBabyBuddyImportRecords(
        [
          {
            name: 'Feeding.csv',
            content: [
              'id,child_id,start,end,type,method,amount,notes,tags',
              '1,7,2026-01-02 10:00:00,2026-01-02 10:10:00,breast milk,bottle,100,,',
            ].join('\n'),
          },
        ],
        {},
      ),
    ).toThrow(
      'Missing Baby Buddy import configuration: feedingUnit',
    );
  });
});

}


{
// Consolidated from tests/babyBuddyFeedingDiaperMapping.test.ts
describe('Baby Buddy feeding mapping', () => {
  it.each([
    ['left breast', 'LEFT'],
    ['right breast', 'RIGHT'],
  ] as const)(
    'maps %s with its side and duration',
    (method, side) => {
      const result = mapBabyBuddyFeeding({
        id: '1',
        child_id: '7',
        start: '2026-01-01 10:00:00',
        end: '2026-01-01 10:30:00',
        type: 'breast milk',
        method,
        amount: '',
        notes: 'Test',
      });

      expect(result).toEqual(
        expect.objectContaining({
          targetType: 'feed',
          type: 'BREAST',
          side,
          startTime: '2026-01-01T10:00:00',
          endTime: '2026-01-01T10:30:00',
          time: '2026-01-01T10:30:00',
          feedDuration: 1800,
          notes: 'Test',
        }),
      );
    },
  );

  it('maps both breasts without inventing a side', () => {
    const result = mapBabyBuddyFeeding({
      id: '2',
      child_id: '7',
      start: '2026-01-01 10:00:00',
      end: '2026-01-01 10:20:00',
      type: 'breast milk',
      method: 'both breasts',
      amount: '',
    });

    expect(result.type).toBe('BREAST');
    expect(result.feedDuration).toBe(1200);
    expect(result.side).toBeUndefined();
  });

  it('maps a breast-milk bottle with its chosen unit', () => {
    const result = mapBabyBuddyFeeding(
      {
        id: '3',
        child_id: '7',
        start: '2026-01-01 11:00:00',
        end: '2026-01-01 11:10:00',
        type: 'breast milk',
        method: 'bottle',
        amount: '100',
      },
      'ML',
    );

    expect(result).toEqual(
      expect.objectContaining({
        type: 'BOTTLE',
        bottleType: 'Breast Milk',
        amount: 100,
        unitAbbr: 'ML',
      }),
    );
  });

  it('omits a bottle amount when SKIP is selected', () => {
    const result = mapBabyBuddyFeeding(
      {
        id: '4',
        child_id: '7',
        start: '2026-01-01 11:00:00',
        end: '2026-01-01 11:10:00',
        type: 'breast milk',
        method: 'bottle',
        amount: '100',
      },
      'SKIP',
    );

    expect(result.amount).toBeUndefined();
    expect(result.unitAbbr).toBeUndefined();
  });

  it('maps solid food without inventing a description', () => {
    const result = mapBabyBuddyFeeding({
      id: '5',
      child_id: '7',
      start: '2026-01-01 12:00:00',
      end: '2026-01-01 12:10:00',
      type: 'solid food',
      method: 'parent fed',
      amount: '',
      notes: '',
    });

    expect(result.type).toBe('SOLIDS');
    expect(result.food).toBeUndefined();
  });
});

describe('Baby Buddy diaper mapping', () => {
  it.each([
    ['1', '0', 'WET'],
    ['0', '1', 'DIRTY'],
    ['1', '1', 'BOTH'],
  ] as const)(
    'maps wet=%s solid=%s to %s',
    (wet, solid, expectedType) => {
      const result = mapBabyBuddyDiaperChange({
        id: '1',
        child_id: '7',
        time: '2026-01-01 10:00:00',
        wet,
        solid,
        color: '',
      });

      expect(result.type).toBe(expectedType);
    },
  );

  it('imports a supported colour when solid is present', () => {
    const result = mapBabyBuddyDiaperChange({
      id: '2',
      child_id: '7',
      time: '2026-01-01 10:00:00',
      wet: '1',
      solid: '1',
      color: 'green',
    });

    expect(result.color).toBe('GREEN');
  });

  it('omits colour from a WET-only record', () => {
    const result = mapBabyBuddyDiaperChange({
      id: '3',
      child_id: '7',
      time: '2026-01-01 10:00:00',
      wet: '1',
      solid: '0',
      color: 'yellow',
    });

    expect(result.color).toBeUndefined();
  });

  it('rejects a record that is neither wet nor solid', () => {
    expect(() =>
      mapBabyBuddyDiaperChange({
        id: '4',
        child_id: '7',
        time: '2026-01-01 10:00:00',
        wet: '0',
        solid: '0',
        color: '',
      }),
    ).toThrow(
      'Baby Buddy diaper change must be wet, solid, or both',
    );
  });
});

}


{
// Consolidated from tests/babyBuddyRemainingMapping.test.ts
describe('remaining Baby Buddy mappings', () => {
  it('maps a height measurement with its selected unit', () => {
    expect(mapBabyBuddyMeasurement('height', {
      id: '1', child_id: '7', height: '50.5', date: '2026-01-01', notes: 'Test',
    }, 'cm')).toEqual(expect.objectContaining({
      targetType: 'measurement', type: 'HEIGHT', value: 50.5,
      unit: 'cm', date: '2026-01-01T00:00:00', notes: 'Test',
    }));
  });

  it('maps temperature with its timestamp', () => {
    expect(mapBabyBuddyMeasurement('temperature', {
      id: '2', child_id: '7', temperature: '37.2', time: '2026-01-01 10:00:00',
    }, '°C')).toEqual(expect.objectContaining({
      type: 'TEMPERATURE', value: 37.2, unit: '°C', date: '2026-01-01T10:00:00',
    }));
  });

  it('maps pumping as total stored milk', () => {
    expect(mapBabyBuddyPumping({
      id: '3', child_id: '7', start: '2026-01-01 10:00:00',
      end: '2026-01-01 10:20:00', amount: '100', notes: '',
    }, 'ML')).toEqual(expect.objectContaining({
      targetType: 'pump', duration: 20, totalAmount: 100,
      unitAbbr: 'ML', pumpAction: 'STORED',
    }));
  });

  it('maps tummy time milestone to notes', () => {
    expect(mapBabyBuddyTummyTime({
      id: '4', child_id: '7', start: '2026-01-01 10:00:00',
      end: '2026-01-01 10:15:00', milestone: 'Rolled over',
    })).toEqual(expect.objectContaining({
      targetType: 'play', type: 'TUMMY_TIME', duration: 15, notes: 'Rolled over',
    }));
  });

  it('rejects an invalid measurement unit', () => {
    expect(() =>
      mapBabyBuddyMeasurement(
        'height',
        {
          id: '5',
          child_id: '7',
          height: '50.5',
          date: '2026-01-01',
        },
        'kg',
      ),
    ).toThrow('Unsupported unit for height: kg');
  });

  it('rejects pumping with an end before its start', () => {
    expect(() =>
      mapBabyBuddyPumping(
        {
          id: '6',
          child_id: '7',
          start: '2026-01-01 10:20:00',
          end: '2026-01-01 10:00:00',
          amount: '100',
        },
        'ML',
      ),
    ).toThrow(
      'Pumping end time must not be before start time',
    );
  });

  it('rejects tummy time with an end before its start', () => {
    expect(() =>
      mapBabyBuddyTummyTime({
        id: '7',
        child_id: '7',
        start: '2026-01-01 10:20:00',
        end: '2026-01-01 10:00:00',
        milestone: '',
      }),
    ).toThrow(
      'Tummy time end time must not be before start time',
    );
  });

});

}
