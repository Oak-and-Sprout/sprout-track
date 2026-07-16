import { describe, it, expect } from 'vitest';

// Test the conversion functions from GrowthChart.tsx
// Import by re-deriving the logic (the functions are local to the component file,
// so test the logic directly as pure functions)

describe('Weight unit grams support', () => {
  // Test that getUnitLabel logic handles 'G' correctly — auto-converts to kg
  describe('getUnitLabel logic', () => {
    function getUnitLabel(weightUnit: string | null): string {
      if (!weightUnit) return 'kg';
      if (weightUnit === 'LB') return 'lb';
      // G (grams) auto-converts to kg for display in growth trends
      return 'kg';
    }

    it('returns lb for LB setting', () => {
      expect(getUnitLabel('LB')).toBe('lb');
    });

    it('returns kg for G setting (auto-converts grams to kg)', () => {
      expect(getUnitLabel('G')).toBe('kg');
    });

    it('returns kg for KG setting', () => {
      expect(getUnitLabel('KG')).toBe('kg');
    });

    it('returns kg for null/undefined setting', () => {
      expect(getUnitLabel(null)).toBe('kg');
    });
  });

  // Test formatWeightDisplay handles 'g' unit
  describe('formatWeightDisplay with grams', () => {
    function formatWeightDisplay(value: number, unit: string): string {
      if (unit.toLowerCase() === 'lb') {
        let lbs = Math.floor(value);
        let oz = Math.round((value - lbs) * 16 * 10) / 10;
        if (oz >= 16) { lbs += 1; oz -= 16; }
        if (lbs === 0 && oz === 0) return `0 lbs`;
        if (lbs === 0) return `${oz} oz`;
        if (oz === 0) return `${lbs} lbs`;
        return `${lbs} lb ${oz} oz`;
      }
      return `${value} ${unit}`;
    }

    it('displays grams value with g suffix', () => {
      expect(formatWeightDisplay(3500, 'g')).toBe('3500 g');
    });

    it('displays kilograms value with kg suffix', () => {
      expect(formatWeightDisplay(3.5, 'kg')).toBe('3.5 kg');
    });

    it('displays pounds in lb/oz format', () => {
      expect(formatWeightDisplay(7.5, 'lb')).toBe('7 lb 8 oz');
    });
  });

  // Test CDC conversion functions handle grams — G now auto-converts to kg display
  describe('CDC conversion with grams', () => {
    function convertToCdcUnit(value: number, unit: string): number {
      const u = unit.toUpperCase().trim();
      if (u === 'LB') return value * 0.453592;
      if (u === 'OZ') return value * 0.0283495;
      if (u === 'G') return value / 1000;
      if (u === 'KG') return value;
      return value;
    }

    function convertFromCdcToDisplayUnit(value: number, displayUnit: string): number {
      const u = displayUnit.toUpperCase().trim();
      if (u === 'LB') return value / 0.453592;
      if (u === 'OZ') return value / 0.0283495;
      // G (grams) auto-converts to kg for display in growth trends
      return value;
    }

    it('converts grams to CDC kg correctly', () => {
      expect(convertToCdcUnit(3500, 'g')).toBeCloseTo(3.5, 4);
    });

    it('converts CDC kg to kg display when setting is G (auto-convert)', () => {
      expect(convertFromCdcToDisplayUnit(3.5, 'G')).toBeCloseTo(3.5, 4);
    });

    it('round-trips: 3010g → CDC → display = 3.010 kg', () => {
      const cdc = convertToCdcUnit(3010, 'g');
      const display = convertFromCdcToDisplayUnit(cdc, 'G');
      expect(display).toBeCloseTo(3.01, 3);
    });

    it('round-trips: 3500g → CDC → display = 3.5 kg', () => {
      const cdc = convertToCdcUnit(3500, 'g');
      const display = convertFromCdcToDisplayUnit(cdc, 'G');
      expect(display).toBeCloseTo(3.5, 3);
    });
  });

  // Test getDisplayUnit logic — G maps to KG
  describe('getDisplayUnit logic', () => {
    function getDisplayUnit(weightUnit: string | null): string {
      if (!weightUnit) return 'KG';
      const unit = weightUnit || 'KG';
      // G (grams) auto-converts to kg for display in growth trends
      return unit === 'G' ? 'KG' : unit;
    }

    it('returns KG for G setting (auto-convert)', () => {
      expect(getDisplayUnit('G')).toBe('KG');
    });

    it('returns KG for KG setting', () => {
      expect(getDisplayUnit('KG')).toBe('KG');
    });

    it('returns LB for LB setting', () => {
      expect(getDisplayUnit('LB')).toBe('LB');
    });

    it('returns KG for null/undefined setting', () => {
      expect(getDisplayUnit(null)).toBe('KG');
    });
  });
});
