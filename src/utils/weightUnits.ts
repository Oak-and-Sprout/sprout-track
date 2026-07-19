/**
 * Pure weight-unit helpers shared by the growth chart, monthly report API,
 * measurement form, and weight display sites.
 *
 * Stored measurement units: 'lb', 'oz' (legacy total ounces), 'kg', 'g'.
 * Family setting `defaultWeightUnit`: 'LB' | 'KG' | 'G'.
 * CDC growth data uses kg.
 */

const KG_PER_LB = 0.453592;
const KG_PER_OZ = 0.0283495;

const normalize = (unit: string | null | undefined): string =>
  (unit || '').toUpperCase().trim();

// Split decimal pounds into whole pounds and ounces (to 1 decimal place).
// Rolls over when ounces round up to 16.
export function lbToLbOz(value: number): { lbs: number; oz: number } {
  let lbs = Math.floor(value);
  let oz = Math.round((value - lbs) * 16 * 10) / 10;
  if (oz >= 16) {
    lbs += 1;
    oz -= 16;
  }
  return { lbs, oz };
}

// Convert a stored measurement value to CDC standard kg.
export function toCdcWeightKg(value: number, unit: string | null | undefined): number {
  const u = normalize(unit);
  if (u === 'LB') return value * KG_PER_LB;
  if (u === 'OZ') return value * KG_PER_OZ;
  if (u === 'G') return value / 1000;
  return value; // KG or unknown — assume kg
}

// Convert a CDC kg value to the display unit. Grams round to whole grams.
export function fromCdcWeightKg(kg: number, displayUnit: string | null | undefined): number {
  const u = normalize(displayUnit);
  if (u === 'LB') return kg / KG_PER_LB;
  if (u === 'OZ') return kg / KG_PER_OZ;
  if (u === 'G') return Math.round(kg * 1000);
  return kg; // KG or unknown — keep kg
}

// Axis/card label for the family's default weight unit setting.
export function weightUnitLabel(defaultWeightUnit: string | null | undefined): string {
  const u = normalize(defaultWeightUnit);
  if (u === 'LB') return 'lb';
  if (u === 'G') return 'g';
  return 'kg';
}

// Which input mode the measurement form starts in for a given setting.
export function defaultWeightInputUnit(defaultWeightUnit: string | null | undefined): 'lb' | 'kg' | 'g' {
  const u = normalize(defaultWeightUnit);
  if (u === 'KG') return 'kg';
  if (u === 'G') return 'g';
  return 'lb'; // LB or unknown — settings default is LB
}

// Human-readable weight for timelines/stat views. Decimal pounds and legacy
// total-ounce values render as "X lb Y oz"; other units render verbatim.
export function formatWeightDisplay(value: number, unit: string): string {
  const u = (unit || '').toLowerCase().trim();
  if (u === 'lb' || u === 'oz') {
    const decimalLbs = u === 'oz' ? value / 16 : value;
    const { lbs, oz } = lbToLbOz(decimalLbs);
    if (lbs === 0 && oz === 0) return `0 lbs`;
    if (lbs === 0) return `${oz} oz`;
    if (oz === 0) return `${lbs} lbs`;
    return `${lbs} lb ${oz} oz`;
  }
  return `${value} ${unit}`;
}

// Convert a legacy total-ounce weight value to decimal pounds (4-decimal rounded),
// for machine-readable exports that keep numeric value + unit columns.
export function legacyOzToLb(value: number): number {
  return Math.round((value / 16) * 10000) / 10000;
}

// Format a chart/tooltip value for display: whole numbers for grams, 2 decimals otherwise.
export function formatChartValue(value: number, unitLabel: string): string {
  return unitLabel === 'g' ? String(Math.round(value)) : value.toFixed(2);
}
