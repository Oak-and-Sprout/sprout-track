/**
 * Pure policy for choosing a growth-chart reference standard.
 *
 * WHO reference data covers 0–24 months; CDC covers 0–36 months. When a family
 * selects WHO but the relevant baby age exceeds 24 months, the whole chart/report
 * falls back to CDC (matching CDC clinical guidance: WHO for 0–24mo, CDC for 2+ years).
 * There is no mid-chart mixing — one standard per chart, always labeled truthfully.
 */

export const WHO_MAX_AGE_MONTHS = 24;

export type GrowthStandard = 'CDC' | 'WHO';

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
