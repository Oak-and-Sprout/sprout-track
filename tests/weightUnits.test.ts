import { describe, it, expect } from 'vitest';
import {
  lbToLbOz,
  toCdcWeightKg,
  fromCdcWeightKg,
  weightUnitLabel,
  defaultWeightInputUnit,
  formatWeightDisplay,
  legacyOzToLb,
} from '@/src/utils/weightUnits';

describe('lbToLbOz', () => {
  it('splits decimal pounds into lb and oz', () => {
    expect(lbToLbOz(7.5)).toEqual({ lbs: 7, oz: 8 });
  });

  it('rolls over when ounces round up to 16', () => {
    expect(lbToLbOz(6.999)).toEqual({ lbs: 7, oz: 0 });
  });

  it('handles whole pounds', () => {
    expect(lbToLbOz(7)).toEqual({ lbs: 7, oz: 0 });
  });

  it('handles zero', () => {
    expect(lbToLbOz(0)).toEqual({ lbs: 0, oz: 0 });
  });
});

describe('toCdcWeightKg', () => {
  it('converts pounds to kg', () => {
    expect(toCdcWeightKg(7.5, 'lb')).toBeCloseTo(3.40194, 4);
  });

  it('converts legacy ounces to kg', () => {
    expect(toCdcWeightKg(120, 'oz')).toBeCloseTo(3.40194, 4);
  });

  it('converts grams to kg', () => {
    expect(toCdcWeightKg(3500, 'g')).toBeCloseTo(3.5, 6);
  });

  it('passes kg through', () => {
    expect(toCdcWeightKg(3.5, 'kg')).toBe(3.5);
  });

  it('assumes kg for unknown, empty, null, and undefined units', () => {
    expect(toCdcWeightKg(3.5, 'stone')).toBe(3.5);
    expect(toCdcWeightKg(3.5, '')).toBe(3.5);
    expect(toCdcWeightKg(3.5, null)).toBe(3.5);
    expect(toCdcWeightKg(3.5, undefined)).toBe(3.5);
  });

  it('normalizes case and whitespace', () => {
    expect(toCdcWeightKg(3500, ' G ')).toBeCloseTo(3.5, 6);
    expect(toCdcWeightKg(7.5, 'LB')).toBeCloseTo(3.40194, 4);
  });
});

describe('fromCdcWeightKg', () => {
  it('converts kg to pounds', () => {
    expect(fromCdcWeightKg(3.40194, 'LB')).toBeCloseTo(7.5, 4);
  });

  it('converts kg to ounces', () => {
    expect(fromCdcWeightKg(3.40194, 'OZ')).toBeCloseTo(120, 2);
  });

  it('converts kg to whole grams (rounded)', () => {
    expect(fromCdcWeightKg(3.5, 'G')).toBe(3500);
    expect(fromCdcWeightKg(3.0125, 'G')).toBe(3013);
    expect(fromCdcWeightKg(3.0124, 'G')).toBe(3012);
  });

  it('passes kg through for KG, unknown, null, and undefined', () => {
    expect(fromCdcWeightKg(3.5, 'KG')).toBe(3.5);
    expect(fromCdcWeightKg(3.5, null)).toBe(3.5);
    expect(fromCdcWeightKg(3.5, undefined)).toBe(3.5);
  });

  it('round-trips grams through CDC kg', () => {
    expect(fromCdcWeightKg(toCdcWeightKg(3500, 'g'), 'G')).toBe(3500);
  });

  it('round-trips pounds through CDC kg', () => {
    expect(fromCdcWeightKg(toCdcWeightKg(7.5, 'lb'), 'LB')).toBeCloseTo(7.5, 6);
  });
});

describe('weightUnitLabel', () => {
  it('maps LB to lb', () => {
    expect(weightUnitLabel('LB')).toBe('lb');
  });

  it('maps G to g', () => {
    expect(weightUnitLabel('G')).toBe('g');
  });

  it('maps KG to kg', () => {
    expect(weightUnitLabel('KG')).toBe('kg');
  });

  it('defaults to kg for null, undefined, empty, and unknown', () => {
    expect(weightUnitLabel(null)).toBe('kg');
    expect(weightUnitLabel(undefined)).toBe('kg');
    expect(weightUnitLabel('')).toBe('kg');
    expect(weightUnitLabel('STONE')).toBe('kg');
  });

  it('normalizes case and whitespace', () => {
    expect(weightUnitLabel(' g ')).toBe('g');
    expect(weightUnitLabel('lb')).toBe('lb');
  });
});

describe('defaultWeightInputUnit', () => {
  it('maps KG to kg input', () => {
    expect(defaultWeightInputUnit('KG')).toBe('kg');
  });

  it('maps G to g input', () => {
    expect(defaultWeightInputUnit('G')).toBe('g');
  });

  it('maps LB to lb input', () => {
    expect(defaultWeightInputUnit('LB')).toBe('lb');
  });

  it('defaults to lb for null, undefined, and unknown (settings default is LB)', () => {
    expect(defaultWeightInputUnit(null)).toBe('lb');
    expect(defaultWeightInputUnit(undefined)).toBe('lb');
    expect(defaultWeightInputUnit('STONE')).toBe('lb');
  });
});

describe('formatWeightDisplay', () => {
  it('formats decimal pounds as lb/oz', () => {
    expect(formatWeightDisplay(7.5, 'lb')).toBe('7 lb 8 oz');
  });

  it('formats legacy ounces as lb/oz', () => {
    expect(formatWeightDisplay(120, 'oz')).toBe('7 lb 8 oz');
  });

  it('formats ounce-only weights', () => {
    expect(formatWeightDisplay(0.5, 'lb')).toBe('8 oz');
    expect(formatWeightDisplay(8, 'oz')).toBe('8 oz');
  });

  it('formats whole pounds', () => {
    expect(formatWeightDisplay(7, 'lb')).toBe('7 lbs');
  });

  it('formats zero pounds', () => {
    expect(formatWeightDisplay(0, 'lb')).toBe('0 lbs');
  });

  it('formats grams verbatim with g label', () => {
    expect(formatWeightDisplay(3500, 'g')).toBe('3500 g');
  });

  it('formats kilograms verbatim with kg label', () => {
    expect(formatWeightDisplay(3.5, 'kg')).toBe('3.5 kg');
  });

  it('normalizes unit case', () => {
    expect(formatWeightDisplay(7.5, 'LB')).toBe('7 lb 8 oz');
  });
});

describe('legacyOzToLb', () => {
  it('converts whole-pound ounce values', () => {
    expect(legacyOzToLb(128)).toBe(8);
  });

  it('converts mixed lb/oz values', () => {
    expect(legacyOzToLb(120)).toBe(7.5);
  });

  it('rounds to 4 decimal places', () => {
    expect(legacyOzToLb(1)).toBe(0.0625);
    expect(legacyOzToLb(100.007)).toBe(6.2504);
  });

  it('handles zero', () => {
    expect(legacyOzToLb(0)).toBe(0);
  });
});
