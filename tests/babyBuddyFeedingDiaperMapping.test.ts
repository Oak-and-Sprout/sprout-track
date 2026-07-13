import { describe, expect, it } from 'vitest';
import {
  mapBabyBuddyDiaperChange,
  mapBabyBuddyFeeding,
} from '../src/lib/importers/baby-buddy';

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
