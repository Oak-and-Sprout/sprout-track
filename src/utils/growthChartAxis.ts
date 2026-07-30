export interface GrowthChartYAxis {
  domain: [number, number];
  ticks: number[];
  step: number;
}

const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10] as const;
const DEFAULT_MAX_INTERVALS = 7;

function normalizeUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

function minimumStepForUnit(unit: string): number {
  switch (normalizeUnit(unit)) {
    case 'g':
      return 50;
    case 'kg':
      return 0.25;
    case 'lb':
    case 'in':
      return 0.5;
    case 'cm':
      return 1;
    default:
      return 0.1;
  }
}

function niceStepAtLeast(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const multiplier = NICE_MULTIPLIERS.find(candidate => candidate >= normalized) ?? 10;

  return multiplier * magnitude;
}

function nextNiceStep(step: number): number {
  return niceStepAtLeast(step * (1 + Number.EPSILON * 16));
}

function roundFloatingPoint(value: number): number {
  return Number(value.toPrecision(12));
}

function roundedDomain(min: number, max: number, step: number): [number, number] {
  const lower = Math.max(0, Math.floor(min / step) * step);
  const upper = Math.ceil(max / step) * step;
  return [roundFloatingPoint(lower), roundFloatingPoint(upper)];
}

function buildTicks(domain: [number, number], step: number): number[] {
  const intervalCount = Math.round((domain[1] - domain[0]) / step);
  return Array.from(
    { length: intervalCount + 1 },
    (_, index) => roundFloatingPoint(domain[0] + index * step),
  );
}

/**
 * Builds a deterministic Y-axis that contains every supplied growth value.
 * The domain is rounded outwards and ticks use evenly spaced, human-friendly
 * intervals such as 500 g, 1 kg, 2 cm, or 0.5 in.
 */
export function buildGrowthChartYAxis(
  values: readonly (number | null | undefined)[],
  unit: string,
  maxIntervals = DEFAULT_MAX_INTERVALS,
): GrowthChartYAxis {
  const finiteValues = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  const minimumStep = minimumStepForUnit(unit);

  if (!finiteValues.length) {
    const domain: [number, number] = [0, minimumStep * 5];
    return {
      domain,
      ticks: buildTicks(domain, minimumStep),
      step: minimumStep,
    };
  }

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);

  if (min === max) {
    const halfSpan = Math.max(Math.abs(min) * 0.1, minimumStep);
    min = Math.max(0, min - halfSpan);
    max += halfSpan;
  }

  const safeMaxIntervals = Math.max(2, Math.floor(maxIntervals));
  let step = Math.max(minimumStep, niceStepAtLeast((max - min) / safeMaxIntervals));
  let domain = roundedDomain(min, max, step);

  while ((domain[1] - domain[0]) / step > safeMaxIntervals) {
    step = nextNiceStep(step);
    domain = roundedDomain(min, max, step);
  }

  return {
    domain,
    ticks: buildTicks(domain, step),
    step: roundFloatingPoint(step),
  };
}

export function formatGrowthChartAxisTick(value: number, step: number, unit: string): string {
  if (normalizeUnit(unit) === 'g') return String(Math.round(value));

  let decimalPlaces = 0;
  while (
    decimalPlaces < 4
    && Math.abs(step * 10 ** decimalPlaces - Math.round(step * 10 ** decimalPlaces)) > 1e-9
  ) {
    decimalPlaces += 1;
  }

  return value.toFixed(decimalPlaces);
}
