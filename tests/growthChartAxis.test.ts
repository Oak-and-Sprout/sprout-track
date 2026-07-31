import { describe, expect, it } from 'vitest';
import {
  buildGrowthChartYAxis,
  formatGrowthChartAxisTick,
} from '@/src/utils/growthChartAxis';

describe('buildGrowthChartYAxis', () => {
  it('uses 500 g ticks for a focused infant weight range', () => {
    expect(buildGrowthChartYAxis([3180, 4355, 4870], 'g')).toEqual({
      domain: [3000, 5000],
      ticks: [3000, 3500, 4000, 4500, 5000],
      step: 500,
    });
  });

  it('uses wider gram intervals when the full visible range needs them', () => {
    expect(buildGrowthChartYAxis([2507, 4355, 7917], 'g')).toEqual({
      domain: [2000, 8000],
      ticks: [2000, 3000, 4000, 5000, 6000, 7000, 8000],
      step: 1000,
    });
  });

  it('keeps a larger kilogram history readable without clipping values', () => {
    const scale = buildGrowthChartYAxis([2.5, 12, 15], 'kg');

    expect(scale).toEqual({
      domain: [2, 16],
      ticks: [2, 4, 6, 8, 10, 12, 14, 16],
      step: 2,
    });
    expect(scale.domain[0]).toBeLessThanOrEqual(2.5);
    expect(scale.domain[1]).toBeGreaterThanOrEqual(15);
  });

  it('uses proportional steps for centimetres and inches', () => {
    expect(buildGrowthChartYAxis([48.2, 56.9], 'cm')).toEqual({
      domain: [48, 58],
      ticks: [48, 50, 52, 54, 56, 58],
      step: 2,
    });
    expect(buildGrowthChartYAxis([19.1, 22.4], 'in')).toEqual({
      domain: [19, 22.5],
      ticks: [19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5],
      step: 0.5,
    });
  });

  it('returns a stable fallback for empty data', () => {
    expect(buildGrowthChartYAxis([], 'g')).toEqual({
      domain: [0, 250],
      ticks: [0, 50, 100, 150, 200, 250],
      step: 50,
    });
  });

  it('expands a single value into a non-zero domain', () => {
    const scale = buildGrowthChartYAxis([4.355], 'kg');

    expect(scale.domain[0]).toBeLessThan(4.355);
    expect(scale.domain[1]).toBeGreaterThan(4.355);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });
});

describe('formatGrowthChartAxisTick', () => {
  it('formats grams as whole numbers', () => {
    expect(formatGrowthChartAxisTick(4355, 500, 'g')).toBe('4355');
  });

  it('preserves decimals required by the selected step', () => {
    expect(formatGrowthChartAxisTick(4.5, 0.5, 'kg')).toBe('4.5');
    expect(formatGrowthChartAxisTick(4.25, 0.25, 'kg')).toBe('4.25');
    expect(formatGrowthChartAxisTick(12, 2, 'kg')).toBe('12');
  });
});
