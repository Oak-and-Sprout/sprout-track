import { describe, expect, it } from 'vitest';
import {
  mapBabyBuddyMeasurement,
  mapBabyBuddyPumping,
  mapBabyBuddyTummyTime,
} from '../src/lib/importers/baby-buddy';

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
