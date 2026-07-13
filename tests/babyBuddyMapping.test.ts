import { describe, expect, it } from 'vitest';
import {
  mapBabyBuddyChild,
  mapBabyBuddyNote,
  mapBabyBuddySleep,
} from '../src/lib/importers/baby-buddy';

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
