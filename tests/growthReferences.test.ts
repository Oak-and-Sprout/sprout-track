import { describe, expect, it } from 'vitest';
import {
  buildGrowthReferenceChartPoints,
  createGrowthReferenceSegments,
  interpolateGrowthReferenceRow,
  resolveGrowthReference,
  selectGrowthReferenceSegment,
  type GrowthReferenceRow,
  type GrowthReferenceSegment,
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

const cdcWeightSegments: GrowthReferenceSegment[] = [
  {
    id: 'cdc-infant-weight',
    standard: 'CDC',
    measurement: 'weight',
    effectiveFromMonths: 0,
    effectiveToMonths: 24,
    breakAfter: false,
    rows: [row(23.5, 100), row(24.5, 100)],
  },
  {
    id: 'cdc-child-weight',
    standard: 'CDC',
    measurement: 'weight',
    effectiveFromMonths: 24,
    effectiveToMonths: null,
    breakAfter: false,
    rows: [row(24, 200), row(24.5, 200), row(60, 200), row(240, 200)],
  },
];

describe('createGrowthReferenceSegments', () => {
  it('centralizes the CDC infant-to-child weight transition at 24 months without a visual break', () => {
    const segments = createGrowthReferenceSegments(
      'CDC',
      'weight',
      [row(23.5)],
      [row(24)],
    );
    expect(segments.map(segment => [
      segment.id,
      segment.effectiveFromMonths,
      segment.effectiveToMonths,
      segment.breakAfter,
    ])).toEqual([
      ['cdc-infant-weight', 0, 24, false],
      ['cdc-child-weight', 24, null, false],
    ]);
  });

  it('uses stature as the child successor and breaks the length curve at 24 months', () => {
    const segments = createGrowthReferenceSegments('CDC', 'length', [], [row(24)]);
    expect(segments[0].id).toBe('cdc-infant-length');
    expect(segments[0].breakAfter).toBe(true);
    expect(segments[1].id).toBe('cdc-child-stature');
    expect(segments[1].breakAfter).toBe(false);
  });

  it('keeps head circumference as a single no-successor CDC segment', () => {
    const segments = createGrowthReferenceSegments('CDC', 'head_circumference', [row(36)]);
    expect(segments).toHaveLength(1);
    expect(segments[0].effectiveToMonths).toBeNull();
    expect(segments[0].breakAfter).toBe(false);
  });
});

describe('selectGrowthReferenceSegment', () => {
  it('uses the infant segment immediately before the transition', () => {
    expect(selectGrowthReferenceSegment(cdcWeightSegments, 'CDC', 'weight', 23.9)?.id)
      .toBe('cdc-infant-weight');
  });

  it('switches to the child segment exactly at 24 months', () => {
    expect(selectGrowthReferenceSegment(cdcWeightSegments, 'CDC', 'weight', 24)?.id)
      .toBe('cdc-child-weight');
    expect(selectGrowthReferenceSegment(cdcWeightSegments, 'CDC', 'weight', 24.1)?.id)
      .toBe('cdc-child-weight');
  });

  it('returns null for an unsupported standard or measurement', () => {
    expect(selectGrowthReferenceSegment(cdcWeightSegments, 'WHO', 'weight', 12)).toBeNull();
    expect(selectGrowthReferenceSegment(cdcWeightSegments, 'CDC', 'length', 12)).toBeNull();
  });

  it('fails closed when overlapping effective ranges are ambiguous', () => {
    const overlapping = [
      ...cdcWeightSegments,
      { ...cdcWeightSegments[0], id: 'duplicate-infant-weight' },
    ];
    expect(selectGrowthReferenceSegment(overlapping, 'CDC', 'weight', 12)).toBeNull();
  });
});

describe('interpolateGrowthReferenceRow', () => {
  it('returns exact rows at supported boundaries', () => {
    const rows = [row(10), row(20)];
    expect(interpolateGrowthReferenceRow(rows, 10)).toEqual(row(10));
    expect(interpolateGrowthReferenceRow(rows, 20)).toEqual(row(20));
  });

  it('interpolates all LMS and percentile fields inside a dataset', () => {
    expect(interpolateGrowthReferenceRow([row(10), row(20)], 15)).toEqual(row(15));
  });

  it('never reuses the first or last row outside the raw data range', () => {
    const rows = [row(10), row(20)];
    expect(interpolateGrowthReferenceRow(rows, 9.99)).toBeNull();
    expect(interpolateGrowthReferenceRow(rows, 20.01)).toBeNull();
  });

  it('does not mutate the input row order', () => {
    const rows = [row(20), row(10)];
    interpolateGrowthReferenceRow(rows, 15);
    expect(rows.map(item => item.ageMonths)).toEqual([20, 10]);
  });
});

describe('resolveGrowthReference', () => {
  it('selects a segment before interpolation, so datasets are never blended', () => {
    const beforeTransition = resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 23.9);
    const atTransition = resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 24);
    expect(beforeTransition?.segment.id).toBe('cdc-infant-weight');
    expect(beforeTransition?.row.m).toBeCloseTo(123.9, 10);
    expect(atTransition?.segment.id).toBe('cdc-child-weight');
    expect(atTransition?.row.m).toBe(224);
  });

  it('can use raw infant rows beyond the effective transition to interpolate just before it', () => {
    const result = resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 23.99);
    expect(result?.segment.id).toBe('cdc-infant-weight');
    expect(result?.row.m).toBeCloseTo(123.99, 10);
  });

  it('returns null beyond the raw maximum even when policy has no upper switch', () => {
    expect(resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 240)?.row.m).toBe(440);
    expect(resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 240.01)).toBeNull();
  });

  it('supports a no-successor reference while respecting its raw maximum', () => {
    const segments = createGrowthReferenceSegments(
      'CDC',
      'head_circumference',
      [row(0), row(36)],
    );
    expect(resolveGrowthReference(segments, 'CDC', 'head_circumference', 36)).not.toBeNull();
    expect(resolveGrowthReference(segments, 'CDC', 'head_circumference', 36.01)).toBeNull();
  });
});

describe('buildGrowthReferenceChartPoints', () => {
  it('keeps the CDC weight percentile curve continuous at 24 months', () => {
    const points = buildGrowthReferenceChartPoints({
      segments: cdcWeightSegments,
      standard: 'CDC',
      measurement: 'weight',
      maxReferenceAgeMonths: 60,
      measurements: [],
    });
    expect(points.some(point => point.referenceBreak)).toBe(false);
    expect(points.find(point => point.ageMonths === 24)?.p50).toBe(224);
  });

  it('draws a real break at the CDC length-to-stature transition', () => {
    const lengthSegments = createGrowthReferenceSegments(
      'CDC',
      'length',
      [row(23.5, 100), row(24.5, 100)],
      [row(24, 200), row(24.5, 200), row(60, 200)],
    );
    const points = buildGrowthReferenceChartPoints({
      segments: lengthSegments,
      standard: 'CDC',
      measurement: 'length',
      maxReferenceAgeMonths: 60,
      measurements: [],
    });
    const breakIndex = points.findIndex(point => point.referenceBreak);
    expect(breakIndex).toBeGreaterThan(0);
    expect(points[breakIndex].ageMonths).toBe(24);
    expect(points[breakIndex].p50).toBeUndefined();
    expect(points[breakIndex - 1].ageMonths).toBeLessThan(24);
    expect(points[breakIndex - 1].ageMonths).toBeCloseTo(24, 5);
    expect(points[breakIndex + 1].ageMonths).toBe(24);
    expect(points[breakIndex + 1].p50).toBe(224);
  });

  it('keeps a 23.99-month measurement at its exact age and on the infant reference', () => {
    const points = buildGrowthReferenceChartPoints({
      segments: cdcWeightSegments,
      standard: 'CDC',
      measurement: 'weight',
      maxReferenceAgeMonths: 60,
      measurements: [{ ageMonths: 23.99, value: 12, percentile: 42 }],
    });
    const measurement = points.find(point => point.measurement === 12);
    expect(measurement?.ageMonths).toBe(23.99);
    expect(measurement?.p50).toBeCloseTo(123.99, 10);
    expect(measurement?.percentile).toBe(42);
  });

  it('keeps unsupported head measurements visible without extending percentile curves', () => {
    const headSegments = createGrowthReferenceSegments(
      'CDC',
      'head_circumference',
      [row(0), row(36)],
    );
    const points = buildGrowthReferenceChartPoints({
      segments: headSegments,
      standard: 'CDC',
      measurement: 'head_circumference',
      maxReferenceAgeMonths: 50,
      measurements: [{ ageMonths: 40, value: 51 }],
    });
    const measurement = points.find(point => point.measurement === 51);
    expect(measurement?.ageMonths).toBe(40);
    expect(measurement?.p50).toBeUndefined();
    expect(measurement?.percentile).toBeUndefined();
    expect(points.filter(point => point.p50 !== undefined).at(-1)?.ageMonths).toBe(36);
  });

  it('supports child references beyond 36 months and stops strictly after 240', () => {
    expect(resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 60)?.segment.id)
      .toBe('cdc-child-weight');
    expect(resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 240)).not.toBeNull();
    expect(resolveGrowthReference(cdcWeightSegments, 'CDC', 'weight', 240.001)).toBeNull();
  });
});
