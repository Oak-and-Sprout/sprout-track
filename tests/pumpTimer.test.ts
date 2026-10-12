import { describe, expect, it } from 'vitest';
import { findLatestPumpTime } from '@/src/utils/pumpTimer';

describe('findLatestPumpTime', () => {
  it('uses the end of the latest completed pumping session', () => {
    expect(
      findLatestPumpTime([
        {
          startTime: '2026-09-22T08:00:00.000Z',
          endTime: '2026-09-22T08:20:00.000Z',
          totalAmount: 90,
        },
        {
          startTime: '2026-09-22T12:00:00.000Z',
          endTime: '2026-09-22T12:15:00.000Z',
          leftAmount: 45,
          rightAmount: 50,
        },
      ])?.toISOString(),
    ).toBe('2026-09-22T12:15:00.000Z');
  });

  it('falls back to start time for legacy pump records without an end', () => {
    expect(
      findLatestPumpTime([
        {
          startTime: '2026-09-22T09:30:00.000Z',
          endTime: null,
          totalAmount: 80,
        },
      ])?.toISOString(),
    ).toBe('2026-09-22T09:30:00.000Z');
  });

  it('ignores non-pump and invalid records', () => {
    expect(
      findLatestPumpTime([
        { startTime: '2026-09-22T10:00:00.000Z', type: 'NAP' },
        { startTime: 'invalid', totalAmount: 80 },
      ]),
    ).toBeUndefined();
  });
});
