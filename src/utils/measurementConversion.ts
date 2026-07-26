/**
 * Pure magnitude conversions for switching a measurement's unit in the
 * measurement form (weight, height, head circumference, temperature).
 *
 * Weight reuses the shared CDC-kg helpers so every weight unit (lb / kg / g,
 * plus legacy oz) round-trips through kilograms. Length (in/cm) and
 * temperature (°F/°C) use their standard conversion factors.
 */

import { toCdcWeightKg, fromCdcWeightKg } from './weightUnits';

const CM_PER_IN = 2.54;

const normalizeLengthUnit = (unit: string): 'in' | 'cm' =>
  (unit || '').toLowerCase().trim() === 'cm' ? 'cm' : 'in';

const normalizeTempUnit = (unit: string): 'F' | 'C' =>
  (unit || '').toUpperCase().includes('C') ? 'C' : 'F';

// Convert a single weight value between lb / kg / g (and legacy oz) via kg.
// Grams round to whole numbers (matching fromCdcWeightKg).
export function convertWeightValue(value: number, fromUnit: string, toUnit: string): number {
  return fromCdcWeightKg(toCdcWeightKg(value, fromUnit), toUnit);
}

// Convert a length (height or head circumference) between inches and cm.
export function convertLengthValue(value: number, fromUnit: string, toUnit: string): number {
  const from = normalizeLengthUnit(fromUnit);
  const to = normalizeLengthUnit(toUnit);
  if (from === to) return value;
  return from === 'in' ? value * CM_PER_IN : value / CM_PER_IN;
}

// Convert a temperature between Fahrenheit and Celsius. Accepts '°F'/'F' and '°C'/'C'.
export function convertTemperatureValue(value: number, fromUnit: string, toUnit: string): number {
  const from = normalizeTempUnit(fromUnit);
  const to = normalizeTempUnit(toUnit);
  if (from === to) return value;
  return from === 'F' ? ((value - 32) * 5) / 9 : (value * 9) / 5 + 32;
}
