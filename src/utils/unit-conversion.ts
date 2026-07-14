/**
 * Unit conversion utilities for volume measurements (oz/ml)
 */

export const OZ_TO_ML = 29.5735;
export const ML_TO_OZ = 1 / OZ_TO_ML;

/** Volume units supported for breast milk / bottle amounts. */
export const SUPPORTED_VOLUME_UNITS = ['OZ', 'ML'] as const;
export type VolumeUnit = (typeof SUPPORTED_VOLUME_UNITS)[number];

/**
 * Normalize a volume unit abbreviation to its canonical uppercase form.
 * Missing/blank input falls back to the 'OZ' default (matching existing callers);
 * an explicitly unsupported unit returns null so callers can reject it instead of
 * silently miscalculating balances (convertVolume no-ops on unknown units).
 */
export function normalizeVolumeUnit(unit?: string | null): VolumeUnit | null {
  const normalized = (unit ?? '').trim().toUpperCase();
  if (normalized === '') return 'OZ';
  return (SUPPORTED_VOLUME_UNITS as readonly string[]).includes(normalized)
    ? (normalized as VolumeUnit)
    : null;
}

/**
 * Convert a volume amount between units (OZ and ML).
 * Returns the original amount if units match or conversion is not supported.
 */
export function convertVolume(amount: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toUpperCase();
  const to = toUnit.toUpperCase();
  if (from === to) return amount;
  if (from === 'OZ' && to === 'ML') return amount * OZ_TO_ML;
  if (from === 'ML' && to === 'OZ') return amount * ML_TO_OZ;
  return amount;
}
