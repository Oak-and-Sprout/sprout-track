import type { GrowthStandard } from './growthStandard';

export const CDC_CHILD_REFERENCE_START_MONTHS = 24;
const REFERENCE_BOUNDARY_EPSILON_MONTHS = 1e-6;
const AGE_MATCH_EPSILON_MONTHS = 1e-9;

export type GrowthReferenceMeasurement = 'weight' | 'length' | 'head_circumference';

export interface GrowthReferenceRow {
  ageMonths: number;
  l: number;
  m: number;
  s: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
}

/**
 * A reference segment separates the age interval where a dataset is the
 * selected policy from the raw age range physically present in that dataset.
 *
 * `effectiveToMonths` is exclusive. A null upper bound means that policy does
 * not switch to another segment; raw row bounds still limit interpolation.
 */
export interface GrowthReferenceSegment {
  id: string;
  standard: GrowthStandard;
  measurement: GrowthReferenceMeasurement;
  effectiveFromMonths: number;
  effectiveToMonths: number | null;
  /**
   * Whether chart percentile lines must break before a successor segment.
   * Leave false/undefined when adjacent datasets represent a continuous curve.
   */
  breakAfter?: boolean;
  rows: readonly GrowthReferenceRow[];
}

export interface ResolvedGrowthReference {
  segment: GrowthReferenceSegment;
  row: GrowthReferenceRow;
}

export interface GrowthReferenceChartMeasurement {
  ageMonths: number;
  value: number;
  date?: string;
  percentile?: number;
}

export interface GrowthReferenceChartPoint {
  ageMonths: number;
  p3?: number;
  p5?: number;
  p10?: number;
  p25?: number;
  p50?: number;
  p75?: number;
  p90?: number;
  p95?: number;
  p97?: number;
  measurement?: number;
  measurementDate?: string;
  percentile?: number;
  /** Internal rendering marker: percentile lines must break at dataset transitions. */
  referenceBreak?: true;
}

const INTERPOLATED_FIELDS = [
  'l',
  'm',
  's',
  'p3',
  'p5',
  'p10',
  'p25',
  'p50',
  'p75',
  'p90',
  'p95',
  'p97',
] as const satisfies readonly (keyof GrowthReferenceRow)[];

function hasFiniteValues(row: GrowthReferenceRow): boolean {
  return (
    Number.isFinite(row.ageMonths) &&
    INTERPOLATED_FIELDS.every(field => Number.isFinite(row[field]))
  );
}

/**
 * Build the policy segments for one standard/measurement pair. Keeping this
 * policy here prevents the API and Monthly Report from drifting apart.
 */
export function createGrowthReferenceSegments(
  standard: GrowthStandard,
  measurement: GrowthReferenceMeasurement,
  primaryRows: readonly GrowthReferenceRow[],
  childRows: readonly GrowthReferenceRow[] = [],
): GrowthReferenceSegment[] {
  if (standard === 'WHO') {
    const id = measurement === 'head_circumference'
      ? 'who-head-circumference'
      : `who-${measurement}`;
    return [{
      id,
      standard,
      measurement,
      effectiveFromMonths: 0,
      effectiveToMonths: null,
      breakAfter: false,
      rows: primaryRows,
    }];
  }

  if (measurement === 'weight') {
    return [
      {
        id: 'cdc-infant-weight',
        standard: 'CDC',
        measurement,
        effectiveFromMonths: 0,
        effectiveToMonths: CDC_CHILD_REFERENCE_START_MONTHS,
        breakAfter: false,
        rows: primaryRows,
      },
      {
        id: 'cdc-child-weight',
        standard: 'CDC',
        measurement,
        effectiveFromMonths: CDC_CHILD_REFERENCE_START_MONTHS,
        effectiveToMonths: null,
        breakAfter: false,
        rows: childRows,
      },
    ];
  }

  if (measurement === 'length') {
    return [
      {
        id: 'cdc-infant-length',
        standard: 'CDC',
        measurement,
        effectiveFromMonths: 0,
        effectiveToMonths: CDC_CHILD_REFERENCE_START_MONTHS,
        breakAfter: true,
        rows: primaryRows,
      },
      {
        id: 'cdc-child-stature',
        standard: 'CDC',
        measurement,
        effectiveFromMonths: CDC_CHILD_REFERENCE_START_MONTHS,
        effectiveToMonths: null,
        breakAfter: false,
        rows: childRows,
      },
    ];
  }

  return [{
    id: 'cdc-infant-head-circumference',
    standard: 'CDC',
    measurement,
    effectiveFromMonths: 0,
    effectiveToMonths: null,
    breakAfter: false,
    rows: primaryRows,
  }];
}

/**
 * Select the single reference segment whose effective policy range contains
 * the requested age. Ambiguous or unsupported configurations fail closed.
 */
export function selectGrowthReferenceSegment(
  segments: readonly GrowthReferenceSegment[],
  standard: GrowthStandard,
  measurement: GrowthReferenceMeasurement,
  ageMonths: number,
): GrowthReferenceSegment | null {
  if (!Number.isFinite(ageMonths)) return null;

  const matches = segments.filter(segment => {
    if (segment.standard !== standard || segment.measurement !== measurement) return false;
    if (ageMonths < segment.effectiveFromMonths) return false;
    return segment.effectiveToMonths === null || ageMonths < segment.effectiveToMonths;
  });

  return matches.length === 1 ? matches[0] : null;
}

/**
 * Interpolate a reference row only when the requested age is bounded by rows
 * from the same dataset. Ages before the first row or after the last row are
 * unsupported: the first/last LMS row is never reused as extrapolated data.
 */
export function interpolateGrowthReferenceRow(
  rows: readonly GrowthReferenceRow[],
  ageMonths: number,
): GrowthReferenceRow | null {
  if (!Number.isFinite(ageMonths)) return null;

  const sortedRows = rows
    .filter(hasFiniteValues)
    .slice()
    .sort((a, b) => a.ageMonths - b.ageMonths);
  if (sortedRows.length === 0) return null;

  const exact = sortedRows.find(row => row.ageMonths === ageMonths);
  if (exact) return exact;

  const first = sortedRows[0];
  const last = sortedRows[sortedRows.length - 1];
  if (ageMonths < first.ageMonths || ageMonths > last.ageMonths) return null;

  let lower: GrowthReferenceRow | undefined;
  let upper: GrowthReferenceRow | undefined;

  for (const row of sortedRows) {
    if (row.ageMonths < ageMonths) lower = row;
    if (row.ageMonths > ageMonths) {
      upper = row;
      break;
    }
  }

  if (!lower || !upper || upper.ageMonths === lower.ageMonths) return null;

  const ratio = (ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
  const interpolated = { ageMonths } as GrowthReferenceRow;

  for (const field of INTERPOLATED_FIELDS) {
    interpolated[field] = lower[field] + ratio * (upper[field] - lower[field]);
  }

  return interpolated;
}

/**
 * Resolve `standard + measurement + age` by selecting the policy segment
 * first, then performing bounded interpolation only within that segment's raw
 * rows. This prevents interpolation across two distinct reference datasets.
 */
export function resolveGrowthReference(
  segments: readonly GrowthReferenceSegment[],
  standard: GrowthStandard,
  measurement: GrowthReferenceMeasurement,
  ageMonths: number,
): ResolvedGrowthReference | null {
  const segment = selectGrowthReferenceSegment(segments, standard, measurement, ageMonths);
  if (!segment) return null;

  const row = interpolateGrowthReferenceRow(segment.rows, ageMonths);
  return row ? { segment, row } : null;
}

function referenceRowToChartPoint(
  row: GrowthReferenceRow,
  convertReferenceValue: (value: number) => number,
): GrowthReferenceChartPoint {
  return {
    ageMonths: row.ageMonths,
    p3: convertReferenceValue(row.p3),
    p5: convertReferenceValue(row.p5),
    p10: convertReferenceValue(row.p10),
    p25: convertReferenceValue(row.p25),
    p50: convertReferenceValue(row.p50),
    p75: convertReferenceValue(row.p75),
    p90: convertReferenceValue(row.p90),
    p95: convertReferenceValue(row.p95),
    p97: convertReferenceValue(row.p97),
  };
}

/**
 * Assemble chart points while preserving explicit transition semantics.
 * Continuous adjacent datasets may be joined directly. For a segment marked
 * `breakAfter`, a synthetic point immediately before the boundary lets the
 * outgoing curve reach its limit, then an undefined boundary point breaks the
 * percentile lines before the successor segment starts.
 *
 * Measurements always keep their exact age and remain visible even when no
 * reference exists for that age.
 */
export function buildGrowthReferenceChartPoints(options: {
  segments: readonly GrowthReferenceSegment[];
  standard: GrowthStandard;
  measurement: GrowthReferenceMeasurement;
  maxReferenceAgeMonths: number | null;
  measurements: readonly GrowthReferenceChartMeasurement[];
  convertReferenceValue?: (value: number) => number;
}): GrowthReferenceChartPoint[] {
  const {
    segments,
    standard,
    measurement,
    maxReferenceAgeMonths,
    measurements,
    convertReferenceValue = value => value,
  } = options;

  const matchingSegments = segments
    .filter(segment => segment.standard === standard && segment.measurement === measurement)
    .slice()
    .sort((a, b) => a.effectiveFromMonths - b.effectiveFromMonths);

  const points: GrowthReferenceChartPoint[] = [];

  for (let index = 0; index < matchingSegments.length; index += 1) {
    const segment = matchingSegments[index];
    const rows = segment.rows
      .filter(hasFiniteValues)
      .filter(row => row.ageMonths >= segment.effectiveFromMonths)
      .filter(row => segment.effectiveToMonths === null || row.ageMonths < segment.effectiveToMonths)
      .filter(row => maxReferenceAgeMonths === null || row.ageMonths <= maxReferenceAgeMonths)
      .slice()
      .sort((a, b) => a.ageMonths - b.ageMonths);

    points.push(...rows.map(row => referenceRowToChartPoint(row, convertReferenceValue)));

    const nextSegment = matchingSegments[index + 1];
    const boundary = segment.effectiveToMonths;
    const hasSuccessorAtBoundary =
      boundary !== null
      && nextSegment !== undefined
      && Math.abs(nextSegment.effectiveFromMonths - boundary) < AGE_MATCH_EPSILON_MONTHS;
    const boundaryIsVisible =
      boundary !== null
      && (maxReferenceAgeMonths === null || boundary <= maxReferenceAgeMonths);

    if (
      boundary !== null
      && segment.breakAfter === true
      && hasSuccessorAtBoundary
      && boundaryIsVisible
    ) {
      const outgoingAge = boundary - REFERENCE_BOUNDARY_EPSILON_MONTHS;
      const outgoingRow = interpolateGrowthReferenceRow(segment.rows, outgoingAge);
      if (outgoingRow) {
        const alreadyPresent = points.some(
          point =>
            !point.referenceBreak
            && Math.abs(point.ageMonths - outgoingAge) < AGE_MATCH_EPSILON_MONTHS,
        );
        if (!alreadyPresent) {
          points.push(referenceRowToChartPoint(outgoingRow, convertReferenceValue));
        }
      }
      points.push({ ageMonths: boundary, referenceBreak: true });
    }
  }

  for (const chartMeasurement of measurements) {
    if (!Number.isFinite(chartMeasurement.ageMonths) || !Number.isFinite(chartMeasurement.value)) {
      continue;
    }

    const resolvedReference = resolveGrowthReference(
      matchingSegments,
      standard,
      measurement,
      chartMeasurement.ageMonths,
    );
    const measurementPoint = resolvedReference
      ? referenceRowToChartPoint(resolvedReference.row, convertReferenceValue)
      : { ageMonths: chartMeasurement.ageMonths };

    measurementPoint.measurement = chartMeasurement.value;
    measurementPoint.measurementDate = chartMeasurement.date;
    measurementPoint.percentile = chartMeasurement.percentile;

    const existingPointIndex = points.findIndex(
      point =>
        !point.referenceBreak
        && Math.abs(point.ageMonths - chartMeasurement.ageMonths) < AGE_MATCH_EPSILON_MONTHS,
    );
    if (existingPointIndex >= 0) {
      points[existingPointIndex] = {
        ...points[existingPointIndex],
        ...measurementPoint,
      };
    } else {
      points.push(measurementPoint);
    }
  }

  return points.sort((a, b) => {
    if (a.ageMonths !== b.ageMonths) return a.ageMonths - b.ageMonths;
    if (a.referenceBreak && !b.referenceBreak) return -1;
    if (!a.referenceBreak && b.referenceBreak) return 1;
    return 0;
  });
}
