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

  const years = target.getUTCFullYear() - birth.getUTCFullYear();
  const months = target.getUTCMonth() - birth.getUTCMonth();
  const days = target.getUTCDate() - birth.getUTCDate();

  let totalMonths = years * 12 + months;
  if (days < 0) totalMonths -= 1;

  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dayFraction = (days >= 0 ? days : daysInTargetMonth + days) / daysInTargetMonth;

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
