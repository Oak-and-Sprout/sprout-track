import { describe, expect, it } from 'vitest';
import {
  buildGrowthReferenceChartPoints,
  createGrowthReferenceSegments,
  type GrowthReferenceRow,
} from '@/src/utils/growthReferences';

function row(ageMonths: number, base = 0): GrowthReferenceRow {
  const value = base + ageMonths;
  return {
    ageMonths,
    l: value,
    m: value,
    s: value,
    p3: value,
    p5: value,
    p10: value,
    p25: value,
    p50: value,
    p75: value,
    p90: value,
    p95: value,
    p97: value,
  };
}

describe('monthly report growth chart regressions', () => {
  it('keeps a head-circumference measurement after the reference ends', () => {
    const segments = createGrowthReferenceSegments(
      'CDC',
      'head_circumference',
      [row(0), row(36)],
    );
    const points = buildGrowthReferenceChartPoints({
      segments,
      standard: 'CDC',
      measurement: 'head_circumference',
      maxReferenceAgeMonths: 40,
      measurements: [{
        ageMonths: 40,
        value: 50,
        date: '2026-01-01T00:00:00.000Z',
      }],
    });
    const measurement = points.find(point => point.measurement === 50);
    expect(measurement).toMatchObject({
      ageMonths: 40,
      measurement: 50,
      measurementDate: '2026-01-01T00:00:00.000Z',
    });
    expect(measurement?.percentile).toBeUndefined();
    expect(measurement?.p50).toBeUndefined();
  });

  it('uses child curves for a report measurement exactly at 24 months', () => {
    const segments = createGrowthReferenceSegments(
      'CDC',
      'weight',
      [row(23.5, 100), row(24.5, 100)],
      [row(24, 200), row(60, 200)],
    );
    const points = buildGrowthReferenceChartPoints({
      segments,
      standard: 'CDC',
      measurement: 'weight',
      maxReferenceAgeMonths: 60,
      measurements: [{ ageMonths: 24, value: 12, percentile: 60 }],
    });
    const measurement = points.find(point => point.measurement === 12);
    expect(measurement?.ageMonths).toBe(24);
    expect(measurement?.p50).toBe(224);
    expect(measurement?.percentile).toBe(60);
  });
});
