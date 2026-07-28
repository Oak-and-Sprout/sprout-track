import { describe, it, expect } from 'vitest';
import {
  formatLocalDateTimeInput,
  freshLocalDateTimeInput,
} from '@/src/utils/dateTimeInput';

describe('formatLocalDateTimeInput', () => {
  it('formats a Date as YYYY-MM-DDTHH:mm in local time', () => {
    const date = new Date(2026, 6, 28, 14, 5); // July 28, 2026 14:05 local
    expect(formatLocalDateTimeInput(date)).toBe('2026-07-28T14:05');
  });

  it('zero-pads month, day, hours, and minutes', () => {
    const date = new Date(2026, 0, 3, 9, 7); // Jan 3, 2026 09:07 local
    expect(formatLocalDateTimeInput(date)).toBe('2026-01-03T09:07');
  });

  it('ignores seconds and milliseconds', () => {
    const date = new Date(2026, 6, 28, 16, 0, 45, 500);
    expect(formatLocalDateTimeInput(date)).toBe('2026-07-28T16:00');
  });
});

describe('freshLocalDateTimeInput (issue #248 visibility restore)', () => {
  it('uses the provided clock rather than a cached value', () => {
    const stale = new Date(2026, 6, 28, 14, 0);
    const current = new Date(2026, 6, 28, 16, 30);

    const staleFormatted = formatLocalDateTimeInput(stale);
    const refreshed = freshLocalDateTimeInput(current);

    expect(staleFormatted).toBe('2026-07-28T14:00');
    expect(refreshed).toBe('2026-07-28T16:30');
    expect(refreshed).not.toBe(staleFormatted);
  });
});
