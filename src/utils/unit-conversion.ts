/**
 * Unit conversion utilities for volume measurements (oz/ml)
 */

export const OZ_TO_ML = 29.5735;
export const ML_TO_OZ = 1 / OZ_TO_ML;

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
