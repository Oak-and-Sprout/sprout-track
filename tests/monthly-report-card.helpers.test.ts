import { describe, it, expect } from 'vitest';
import {
  getEffectiveDays,
  getDaysInMonth,
} from '@/src/components/Reports/MonthlyReportCard/monthly-report-card.helpers';

// Issue #199: report card averages must divide by days the baby was alive in the
// reporting window, not by elapsed calendar days in the month.
describe('getEffectiveDays', () => {
  // "now" is local-time based in the helper (matches previous getElapsedDays behavior)
  const july8 = new Date(2026, 6, 8, 12, 0, 0); // July 8, 2026 local

  it('clamps to birth date in the birth month (issue #199 example: born Jul 7, today Jul 8 → 2)', () => {
    const birthDate = new Date(Date.UTC(2026, 6, 7));
    expect(getEffectiveDays(2026, 7, birthDate, july8)).toBe(2);
  });

  it('uses elapsed days for the current month when born before the month', () => {
    const birthDate = new Date(Date.UTC(2026, 4, 15));
    expect(getEffectiveDays(2026, 7, birthDate, july8)).toBe(8);
  });

  it('uses full month length for past months when born before the month', () => {
    const birthDate = new Date(Date.UTC(2026, 4, 15));
    expect(getEffectiveDays(2026, 6, birthDate, july8)).toBe(30);
  });

  it('clamps the birth month when viewed as a past month (born Jun 20 → 11 days)', () => {
    const birthDate = new Date(Date.UTC(2026, 5, 20));
    expect(getEffectiveDays(2026, 6, birthDate, july8)).toBe(30 - 20 + 1);
  });

  it('returns 0 for months before birth (guards prev-month deltas)', () => {
    const birthDate = new Date(Date.UTC(2026, 6, 7));
    expect(getEffectiveDays(2026, 6, birthDate, july8)).toBe(0);
    expect(getEffectiveDays(2025, 12, birthDate, july8)).toBe(0);
  });

  it('returns 0 when born later in the current month than today', () => {
    const birthDate = new Date(Date.UTC(2026, 6, 20));
    expect(getEffectiveDays(2026, 7, birthDate, july8)).toBe(0);
  });

  it('counts the birth day itself (born today → 1)', () => {
    const birthDate = new Date(Date.UTC(2026, 6, 8));
    expect(getEffectiveDays(2026, 7, birthDate, july8)).toBe(1);
  });

  it('preserves old behavior when no birth date is provided', () => {
    expect(getEffectiveDays(2026, 7, null, july8)).toBe(8);
    expect(getEffectiveDays(2026, 6, null, july8)).toBe(30);
    expect(getEffectiveDays(2026, 2, undefined, july8)).toBe(28);
  });

  it('handles birth in a previous year correctly', () => {
    const birthDate = new Date(Date.UTC(2025, 10, 3));
    expect(getEffectiveDays(2026, 7, birthDate, july8)).toBe(8);
    expect(getEffectiveDays(2026, 1, birthDate, july8)).toBe(31);
  });

  it('handles December → January year boundary for prev-month deltas', () => {
    const jan15 = new Date(2026, 0, 15, 12, 0, 0);
    const birthDate = new Date(Date.UTC(2025, 11, 25)); // born Dec 25, 2025
    expect(getEffectiveDays(2025, 12, birthDate, jan15)).toBe(31 - 25 + 1);
    expect(getEffectiveDays(2026, 1, birthDate, jan15)).toBe(15);
  });
});

describe('getDaysInMonth', () => {
  it('returns correct lengths including leap years', () => {
    expect(getDaysInMonth(2026, 7)).toBe(31);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2024, 2)).toBe(29);
  });
});
