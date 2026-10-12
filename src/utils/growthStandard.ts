/**
 * Pure policy for choosing a growth-chart reference standard.
 *
 * WHO reference data covers 0–24 months. When a family selects WHO but the
 * relevant baby age exceeds 24 months, the whole chart/report falls back to CDC
 * (matching CDC clinical guidance: WHO for 0–24mo, CDC for 2+ years). The chart
 * still uses one standard at a time; CDC may internally select age-appropriate
 * infant or 2–20 year reference segments without mixing standards.
 */

export const WHO_MAX_AGE_MONTHS = 24;

export type GrowthStandard = 'CDC' | 'WHO';

export function calculateGrowthAgeMonths(
  birthDateInput: Date | string,
  targetDateInput: Date | string,
): number {
  const birth = birthDateInput instanceof Date ? birthDateInput : new Date(birthDateInput);
  const target = targetDateInput instanceof Date ? targetDateInput : new Date(targetDateInput);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(target.getTime())) return 0;

  // Month-anniversary n of the birth date, clamped to the month's last day
  // (a 31st birthday's February anniversary is the 28th/29th).
  const anniversary = (n: number) => {
    const month = birth.getUTCMonth() + n;
    const lastDay = new Date(Date.UTC(birth.getUTCFullYear(), month + 1, 0)).getUTCDate();
    return Date.UTC(birth.getUTCFullYear(), month, Math.min(birth.getUTCDate(), lastDay));
  };
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());

  let totalMonths =
    (target.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
    target.getUTCMonth() - birth.getUTCMonth();
  if (targetDay < anniversary(totalMonths)) totalMonths -= 1;

  const start = anniversary(totalMonths);
  const dayFraction = (targetDay - start) / (anniversary(totalMonths + 1) - start);

  return Math.max(0, totalMonths + dayFraction);
}

// Strict membership check for API validation. Storage/query values are uppercase.
export function isValidGrowthStandard(value: unknown): value is GrowthStandard {
  return value === 'CDC' || value === 'WHO';
}

// Resolve the standard actually used, given the family's selection and a baby age.
export function effectiveGrowthStandard(
  selected: string | null | undefined,
  babyAgeMonths: number,
): GrowthStandard {
  const normalized = (selected || '').toUpperCase().trim();
  if (normalized === 'WHO' && babyAgeMonths <= WHO_MAX_AGE_MONTHS) return 'WHO';
  return 'CDC';
}
