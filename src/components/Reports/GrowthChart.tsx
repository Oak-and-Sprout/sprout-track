'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Scale, Ruler, CircleDot, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useBaby } from '@/app/context/baby';
import { growthChartStyles } from './growth-chart.styles';
import { useLocalization } from '@/src/context/localization';

// Types
export type GrowthMeasurementType = 'weight' | 'length' | 'head_circumference';

interface CdcGrowthDataRecord {
  sex: number;
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

interface MeasurementData {
  id: string;
  babyId: string;
  date: string;
  type: 'HEIGHT' | 'WEIGHT' | 'HEAD_CIRCUMFERENCE' | 'TEMPERATURE';
  value: number;
  unit: string;
  notes: string | null;
}

interface Settings {
  defaultWeightUnit: string;
  defaultHeightUnit: string;
}

interface ChartDataPoint {
  ageMonths: number;
  p3: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p97: number;
  measurement?: number;
  measurementDate?: string;
  percentile?: number;
}

interface MeasurementWithPercentile {
  ageMonths: number;
  value: number;
  displayValue: number;
  date: string;
  percentile: number;
  unit: string;
}

interface GrowthChartProps {
  className?: string;
}

// Helper to convert Gender enum to CDC sex number
const genderToCdcSex = (gender: string | null | undefined): number => {
  if (gender === 'MALE') return 1;
  if (gender === 'FEMALE') return 2;
  return 1; // Default to male if unknown
};

// Helper to calculate age in months from birth date
const calculateAgeInMonths = (birthDate: string, measurementDate: string): number => {
  const birth = new Date(birthDate);
  const measurement = new Date(measurementDate);

  const years = measurement.getFullYear() - birth.getFullYear();
  const months = measurement.getMonth() - birth.getMonth();
  const days = measurement.getDate() - birth.getDate();

  let totalMonths = years * 12 + months;
  if (days < 0) {
    totalMonths -= 1;
  }

  // Add fractional month based on day of month
  const daysInMonth = new Date(measurement.getFullYear(), measurement.getMonth() + 1, 0).getDate();
  const dayFraction = (days >= 0 ? days : daysInMonth + days) / daysInMonth;

  return Math.max(0, totalMonths + dayFraction);
};

// Helper to convert measurement values to CDC standard units (kg for weight, cm for length)
const convertToCdcUnit = (value: number, unit: string, type: GrowthMeasurementType): number => {
  // Normalize unit to uppercase for comparison
  const normalizedUnit = (unit || '').toUpperCase().trim();

  switch (type) {
    case 'weight':
      // CDC uses kg
      if (normalizedUnit === 'LB') return value * 0.453592;
      if (normalizedUnit === 'OZ') return value * 0.0283495;
      if (normalizedUnit === 'G') return value / 1000;
      if (normalizedUnit === 'KG') return value;
      // Default: assume kg if no recognized unit
      return value;
    case 'length':
    case 'head_circumference':
      // CDC uses cm
      if (normalizedUnit === 'IN') return value * 2.54;
      if (normalizedUnit === 'CM') return value;
      // Default: assume cm if no recognized unit
      return value;
    default:
      return value;
  }
};

// Helper to convert CDC units (kg, cm) to display units based on settings
const convertFromCdcToDisplayUnit = (value: number, type: GrowthMeasurementType, displayUnit: string): number => {
  // Normalize displayUnit to uppercase for comparison
  const normalizedDisplayUnit = (displayUnit || '').toUpperCase().trim();

  switch (type) {
    case 'weight':
      // CDC uses kg, convert to display unit
      if (normalizedDisplayUnit === 'LB') return value / 0.453592;
      if (normalizedDisplayUnit === 'OZ') return value / 0.0283495;
      if (normalizedDisplayUnit === 'G') return value * 1000;
      return value; // Keep kg
    case 'length':
    case 'head_circumference':
      // CDC uses cm, convert to display unit
      if (normalizedDisplayUnit === 'IN') return value / 2.54;
      return value; // Keep cm
    default:
      return value;
  }
};

// Calculate percentile using CDC LMS method
// Formula: Z = ((value/M)^L - 1) / (L * S) for L != 0
// Then convert Z-score to percentile using normal distribution
const calculatePercentile = (value: number, l: number, m: number, s: number): number => {
  if (m === 0 || s === 0) return 50; // Default to 50th if invalid

  let zScore: number;
  if (l === 0) {
    // Special case when L = 0, use logarithm
    zScore = Math.log(value / m) / s;
  } else {
    zScore = (Math.pow(value / m, l) - 1) / (l * s);
  }

  // Convert Z-score to percentile using error function approximation
  // P(Z < z) = 0.5 * (1 + erf(z / sqrt(2)))
  const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2))) * 100;

  // Clamp to 0-100 and round to 1 decimal
  return Math.round(Math.max(0.1, Math.min(99.9, percentile)) * 10) / 10;
};

// Error function approximation for normal distribution
const erf = (x: number): number => {
  // Horner form coefficients
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
};

// Find CDC data point for a given age (interpolating if needed)
const findCdcDataForAge = (cdcData: CdcGrowthDataRecord[], ageMonths: number): CdcGrowthDataRecord | null => {
  if (!cdcData.length) return null;

  // Find surrounding points
  let lower: CdcGrowthDataRecord | null = null;
  let upper: CdcGrowthDataRecord | null = null;

  for (let i = 0; i < cdcData.length; i++) {
    if (cdcData[i].ageMonths <= ageMonths) {
      lower = cdcData[i];
    }
    if (cdcData[i].ageMonths >= ageMonths && !upper) {
      upper = cdcData[i];
      break;
    }
  }

  if (!lower && !upper) return null;
  if (!lower) return upper;
  if (!upper) return lower;
  if (lower.ageMonths === upper.ageMonths) return lower;

  // Interpolate
  const ratio = (ageMonths - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);
  return {
    sex: lower.sex,
    ageMonths: ageMonths,
    l: lower.l + ratio * (upper.l - lower.l),
    m: lower.m + ratio * (upper.m - lower.m),
    s: lower.s + ratio * (upper.s - lower.s),
    p3: lower.p3 + ratio * (upper.p3 - lower.p3),
    p5: lower.p5 + ratio * (upper.p5 - lower.p5),
    p10: lower.p10 + ratio * (upper.p10 - lower.p10),
    p25: lower.p25 + ratio * (upper.p25 - lower.p25),
    p50: lower.p50 + ratio * (upper.p50 - lower.p50),
    p75: lower.p75 + ratio * (upper.p75 - lower.p75),
    p90: lower.p90 + ratio * (upper.p90 - lower.p90),
    p95: lower.p95 + ratio * (upper.p95 - lower.p95),
    p97: lower.p97 + ratio * (upper.p97 - lower.p97),
  };
};

// Map measurement API type to chart type
const mapMeasurementType = (apiType: string): GrowthMeasurementType | null => {
  switch (apiType) {
    case 'WEIGHT':
      return 'weight';
    case 'HEIGHT':
      return 'length';
    case 'HEAD_CIRCUMFERENCE':
      return 'head_circumference';
    default:
      return null;
  }
};

// Get unit display label based on settings
const getUnitLabel = (type: GrowthMeasurementType, settings: Settings | null): string => {
  if (!settings) {
    // Default to metric
    switch (type) {
      case 'weight': return 'kg';
      case 'length':
      case 'head_circumference': return 'cm';
      default: return '';
    }
  }

  switch (type) {
    case 'weight':
      return settings.defaultWeightUnit === 'LB' ? 'lb' : 'kg';
    case 'length':
    case 'head_circumference':
      return settings.defaultHeightUnit === 'IN' ? 'in' : 'cm';
    default:
      return '';
  }
};

// Get display unit code from settings
const getDisplayUnit = (type: GrowthMeasurementType, settings: Settings | null): string => {
  if (!settings) {
    switch (type) {
      case 'weight': return 'KG';
      case 'length':
      case 'head_circumference': return 'CM';
      default: return '';
    }
  }

  switch (type) {
    case 'weight':
      return settings.defaultWeightUnit || 'KG';
    case 'length':
    case 'head_circumference':
      return settings.defaultHeightUnit || 'CM';
    default:
      return '';
  }
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label, settings, measurementType }: any) => {
  if (active && payload && payload.length) {
    const measurementPoint = payload.find((p: any) => p.dataKey === 'measurement');
    const dataPoint = payload[0]?.payload as ChartDataPoint;
    const unitLabel = getUnitLabel(measurementType, settings);

    return (
      <div className={cn(growthChartStyles.tooltip, "growth-chart-tooltip")}>
        <p className={cn(growthChartStyles.tooltipLabel, "growth-chart-tooltip-label")}>
          {t('Age:')} {typeof label === 'number' ? label.toFixed(1) : label} months
        </p>
        {measurementPoint && measurementPoint.value !== null && measurementPoint.value !== undefined && (
          <div className={cn(growthChartStyles.tooltipPercentiles, "growth-chart-tooltip-percentiles")}>
            {(() => {
              // Find percentile curves immediately above and below the measurement value
              const percentileEntries = payload
                .filter(
                  (p: any) =>
                    p.dataKey !== 'measurement' &&
                    p.dataKey !== 'percentile' &&
                    p.value !== null &&
                    p.value !== undefined
                )
                .sort((a: any, b: any) => (a.value ?? 0) - (b.value ?? 0));

              if (!percentileEntries.length) return null;

              const measurementValue = measurementPoint.value as number;
              const measurementPercentile = dataPoint?.percentile;
              let lower: any = null;
              let upper: any = null;

              for (let i = 0; i < percentileEntries.length; i++) {
                const entry = percentileEntries[i];
                if (entry.value >= measurementValue) {
                  upper = entry;
                  lower = i > 0 ? percentileEntries[i - 1] : null;
                  break;
                }
              }

              // If measurement is above all percentile curves, only show the highest one as "below"
              if (!upper) {
                lower = percentileEntries[percentileEntries.length - 1];
              }

              const lines: React.ReactNode[] = [];

              // Percentile above measurement
              if (upper) {
                lines.push(
                  <p key="upper" style={{ color: upper.color }}>
                    {upper.name}: {upper.value?.toFixed(2)} {unitLabel}
                  </p>
                );
              }

              // Measurement line (percentile + value), bold and orange but same size as others
              if (measurementPercentile !== undefined) {
                lines.push(
                  <p
                    key="measurement"
                    className={cn(growthChartStyles.tooltipMeasurement, "growth-chart-tooltip-measurement")}
                  >
                    {measurementPercentile.toFixed(1)}%: {measurementValue.toFixed(2)} {unitLabel}
                  </p>
                );
              }

              // Percentile below measurement
              if (lower) {
                lines.push(
                  <p key="lower" style={{ color: lower.color }}>
                    {lower.name}: {lower.value?.toFixed(2)} {unitLabel}
                  </p>
                );
              }

              return lines;
            })()}
          </div>
        )}
      </div>
    );
  }
  return null;
};

const GrowthChart: React.FC<GrowthChartProps> = ({ className }) => {
  const { t } = useLocalization();
  const { selectedBaby } = useBaby();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // State
  const [measurementType, setMeasurementType] = useState<GrowthMeasurementType>('weight');
  const [cdcData, setCdcData] = useState<CdcGrowthDataRecord[]>([]);
  const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zoom state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [initialPinchDistance, setInitialPinchDistance] = useState<number | null>(null);
  const [initialZoom, setInitialZoom] = useState(1);

  // Fetch settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setSettings({
              defaultWeightUnit: data.data.defaultWeightUnit || 'LB',
              defaultHeightUnit: data.data.defaultHeightUnit || 'IN',
            });
          }
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchSettings();
  }, []);

  // Fetch CDC data when measurement type or baby gender changes
  useEffect(() => {
    const fetchCdcData = async () => {
      if (!selectedBaby) return;

      setIsLoading(true);
      setError(null);

      try {
        const authToken = localStorage.getItem('authToken');
        const sex = genderToCdcSex(selectedBaby.gender);

        const response = await fetch(
          `/api/cdc-growth-data?sex=${sex}&type=${measurementType}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCdcData(data.data || []);
          } else {
            setError(data.error || 'Failed to fetch CDC data');
          }
        } else {
          setError('Failed to fetch CDC data');
        }
      } catch (err) {
        console.error('Error fetching CDC data:', err);
        setError('Error fetching CDC data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCdcData();
  }, [selectedBaby, measurementType]);

  // Fetch baby measurements
  useEffect(() => {
    const fetchMeasurements = async () => {
      if (!selectedBaby) return;

      try {
        const authToken = localStorage.getItem('authToken');

        // Map chart type to API type
        const apiType = measurementType === 'weight' ? 'WEIGHT'
          : measurementType === 'length' ? 'HEIGHT'
          : 'HEAD_CIRCUMFERENCE';

        const response = await fetch(
          `/api/measurement-log?babyId=${selectedBaby.id}&type=${apiType}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authToken ? `Bearer ${authToken}` : '',
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setMeasurements(data.data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching measurements:', err);
      }
    };

    fetchMeasurements();
  }, [selectedBaby, measurementType]);

  // Process measurements with percentiles
  const measurementsWithPercentiles = useMemo((): MeasurementWithPercentile[] => {
    if (!cdcData.length || !selectedBaby?.birthDate) return [];

    const displayUnit = getDisplayUnit(measurementType, settings);

    return measurements
      .filter(m => mapMeasurementType(m.type) === measurementType)
      .map(m => {
        const ageMonths = calculateAgeInMonths(selectedBaby.birthDate!.toString(), m.date);

        // Convert to CDC units for percentile calculation
        const cdcValue = convertToCdcUnit(m.value, m.unit, measurementType);

        // Find CDC data for this age
        const cdcPoint = findCdcDataForAge(cdcData, ageMonths);

        // Calculate percentile
        const percentile = cdcPoint
          ? calculatePercentile(cdcValue, cdcPoint.l, cdcPoint.m, cdcPoint.s)
          : 50;

        // Convert to display unit
        const displayValue = convertFromCdcToDisplayUnit(cdcValue, measurementType, displayUnit);

        return {
          ageMonths,
          value: cdcValue,
          displayValue,
          date: m.date,
          percentile,
          unit: displayUnit,
        };
      })
      .filter(m => m.ageMonths >= 0 && m.ageMonths <= 36.5) // Filter to CDC range
      .sort((a, b) => a.ageMonths - b.ageMonths);
  }, [cdcData, measurements, measurementType, selectedBaby, settings]);

  // Calculate baby's current age in months
  const babyCurrentAgeMonths = useMemo((): number => {
    if (!selectedBaby?.birthDate) return 12; // Default to 12 months if no birthdate

    const now = new Date();
    const birth = new Date(selectedBaby.birthDate);

    const years = now.getFullYear() - birth.getFullYear();
    const months = now.getMonth() - birth.getMonth();
    const days = now.getDate() - birth.getDate();

    let totalMonths = years * 12 + months;
    if (days < 0) {
      totalMonths -= 1;
    }

    // Add 1 month buffer and round up to nearest month
    const ageWithBuffer = Math.ceil(totalMonths + 1);

    // Minimum of 3 months, maximum of 36 months
    return Math.max(3, Math.min(36, ageWithBuffer));
  }, [selectedBaby]);

  // Combine CDC data with baby measurements for chart
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!cdcData.length || !selectedBaby?.birthDate) return [];

    const displayUnit = getDisplayUnit(measurementType, settings);

    // Create base data from CDC percentiles, converted to display units
    // Filter to only include data up to baby's current age + 1 month
    const baseData: ChartDataPoint[] = cdcData
      .filter(record => record.ageMonths <= babyCurrentAgeMonths)
      .map(record => ({
        ageMonths: record.ageMonths,
        p3: convertFromCdcToDisplayUnit(record.p3, measurementType, displayUnit),
        p5: convertFromCdcToDisplayUnit(record.p5, measurementType, displayUnit),
        p10: convertFromCdcToDisplayUnit(record.p10, measurementType, displayUnit),
        p25: convertFromCdcToDisplayUnit(record.p25, measurementType, displayUnit),
        p50: convertFromCdcToDisplayUnit(record.p50, measurementType, displayUnit),
        p75: convertFromCdcToDisplayUnit(record.p75, measurementType, displayUnit),
        p90: convertFromCdcToDisplayUnit(record.p90, measurementType, displayUnit),
        p95: convertFromCdcToDisplayUnit(record.p95, measurementType, displayUnit),
        p97: convertFromCdcToDisplayUnit(record.p97, measurementType, displayUnit),
      }));

    // Create a map for measurement points
    const measurementPointsMap: Map<number, { value: number; date: string; percentile: number }> = new Map();

    measurementsWithPercentiles.forEach(m => {
      // Round to nearest 0.5 month for matching with CDC data
      const roundedAge = Math.round(m.ageMonths * 2) / 2;
      measurementPointsMap.set(roundedAge, {
        value: m.displayValue,
        date: m.date,
        percentile: m.percentile,
      });
    });

    // Merge measurement points into chart data
    const mergedData = baseData.map(point => {
      const measurement = measurementPointsMap.get(point.ageMonths);
      if (measurement) {
        measurementPointsMap.delete(point.ageMonths); // Mark as used
        return {
          ...point,
          measurement: measurement.value,
          measurementDate: measurement.date,
          percentile: measurement.percentile,
        };
      }
      return point;
    });

    // Add any remaining measurement points that don't align with CDC data points
    measurementPointsMap.forEach((measurement, age) => {
      // Find surrounding CDC points and interpolate
      const lowerIdx = baseData.findIndex(d => d.ageMonths > age) - 1;
      if (lowerIdx >= 0 && lowerIdx < baseData.length - 1) {
        const lower = baseData[lowerIdx];
        const upper = baseData[lowerIdx + 1];
        const ratio = (age - lower.ageMonths) / (upper.ageMonths - lower.ageMonths);

        mergedData.push({
          ageMonths: age,
          p3: lower.p3 + ratio * (upper.p3 - lower.p3),
          p5: lower.p5 + ratio * (upper.p5 - lower.p5),
          p10: lower.p10 + ratio * (upper.p10 - lower.p10),
          p25: lower.p25 + ratio * (upper.p25 - lower.p25),
          p50: lower.p50 + ratio * (upper.p50 - lower.p50),
          p75: lower.p75 + ratio * (upper.p75 - lower.p75),
          p90: lower.p90 + ratio * (upper.p90 - lower.p90),
          p95: lower.p95 + ratio * (upper.p95 - lower.p95),
          p97: lower.p97 + ratio * (upper.p97 - lower.p97),
          measurement: measurement.value,
          measurementDate: measurement.date,
          percentile: measurement.percentile,
        });
      }
    });

    // Sort by age
    return mergedData.sort((a, b) => a.ageMonths - b.ageMonths);
  }, [cdcData, measurementsWithPercentiles, measurementType, selectedBaby, settings, babyCurrentAgeMonths]);

  // Dynamic Y-axis domain based on visible data (min - 10%, max + 10%)
  const yAxisDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'] as const;

    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    chartData.forEach((point) => {
      const values = [
        point.p3,
        point.p5,
        point.p10,
        point.p25,
        point.p50,
        point.p75,
        point.p90,
        point.p95,
        point.p97,
        point.measurement,
      ].filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));

      values.forEach((v) => {
        if (v < min) min = v;
        if (v > max) max = v;
      });
    });

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return ['auto', 'auto'] as const;
    }

    const range = max - min;
    const padding = range > 0 ? range * 0.1 : (max || 1) * 0.1;
    let lower = min - padding;
    const upper = max + padding;

    // Don't go below zero for growth metrics
    if (lower < 0) lower = 0;

    return [lower, upper] as const;
  }, [chartData]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev / 1.5, 1));
  }, []);

  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Mouse/touch handlers for pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [zoomLevel, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      const maxPan = (zoomLevel - 1) * 200;
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, e.clientX - dragStart.x)),
        y: Math.max(-maxPan, Math.min(maxPan, e.clientY - dragStart.y)),
      });
    }
  }, [isDragging, zoomLevel, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch handlers for pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setInitialPinchDistance(distance);
      setInitialZoom(zoomLevel);
    } else if (e.touches.length === 1 && zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - panOffset.x,
        y: e.touches[0].clientY - panOffset.y
      });
    }
  }, [zoomLevel, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = distance / initialPinchDistance;
      setZoomLevel(Math.max(1, Math.min(5, initialZoom * scale)));
    } else if (e.touches.length === 1 && isDragging && zoomLevel > 1) {
      const maxPan = (zoomLevel - 1) * 200;
      setPanOffset({
        x: Math.max(-maxPan, Math.min(maxPan, e.touches[0].clientX - dragStart.x)),
        y: Math.max(-maxPan, Math.min(maxPan, e.touches[0].clientY - dragStart.y)),
      });
    }
  }, [initialPinchDistance, initialZoom, isDragging, zoomLevel, dragStart]);

  const handleTouchEnd = useCallback(() => {
    setInitialPinchDistance(null);
    setIsDragging(false);
  }, []);

  // Wheel zoom handler
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoomLevel(prev => Math.max(1, Math.min(5, prev * delta)));
  }, []);

  // Get measurement type button config
  const measurementTypes: { type: GrowthMeasurementType; label: string; icon: React.ReactNode }[] = [
    { type: 'weight', label: 'Weight', icon: <Scale className="h-4 w-4" /> },
    { type: 'length', label: 'Length', icon: <Ruler className="h-4 w-4" /> },
    { type: 'head_circumference', label: 'Head', icon: <CircleDot className="h-4 w-4" /> },
  ];

  // No baby selected
  if (!selectedBaby) {
    return (
      <div className={cn(growthChartStyles.emptyContainer, "growth-chart-empty", className)}>
        <Scale className="h-12 w-12 text-gray-300 mb-4" />
        <p className={cn(growthChartStyles.emptyText, "growth-chart-empty-text")}>
          {t('Select a baby to view growth charts.')}
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(growthChartStyles.loadingContainer, "growth-chart-loading", className)}>
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        <p className={cn(growthChartStyles.loadingText, "growth-chart-loading-text")}>
          {t('Loading growth chart data...')}
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(growthChartStyles.errorContainer, "growth-chart-error", className)}>
        <p className={cn(growthChartStyles.errorText, "growth-chart-error-text")}>{error}</p>
      </div>
    );
  }

  const unitLabel = getUnitLabel(measurementType, settings);

  return (
    <div className={cn(growthChartStyles.container, "growth-chart-container", className)}>
      {/* Top controls row: measurement type buttons (left) and zoom controls (right) */}
      <div className={cn(growthChartStyles.controlsRow)}>
        {/* Measurement type toggle buttons */}
        <div className={cn(growthChartStyles.buttonGroup, "growth-chart-button-group")}>
          {measurementTypes.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => setMeasurementType(type)}
              className={cn(
                growthChartStyles.button,
                "growth-chart-button",
                measurementType === type && growthChartStyles.buttonActive,
                measurementType === type && "growth-chart-button-active"
              )}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Zoom controls */}
        <div className={cn(growthChartStyles.zoomControls, "growth-chart-zoom-controls")}>
          <button
            onClick={handleZoomIn}
            className={cn(growthChartStyles.zoomButton, "growth-chart-zoom-button")}
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className={cn(growthChartStyles.zoomButton, "growth-chart-zoom-button")}
            title="Zoom out"
            disabled={zoomLevel <= 1}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleReset}
            className={cn(growthChartStyles.zoomButton, "growth-chart-zoom-button")}
            title="Reset zoom"
            disabled={zoomLevel === 1 && panOffset.x === 0 && panOffset.y === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <span className={cn(growthChartStyles.zoomLabel, "growth-chart-zoom-label")}>
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      </div>

      {/* Chart container with zoom/pan */}
      <div
        ref={chartContainerRef}
        className={cn(growthChartStyles.chartWrapper, "growth-chart-wrapper")}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{
          cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 2, bottom: 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
              <XAxis
                dataKey="ageMonths"
                label={{ value: 'Age (months)', position: 'insideBottom', offset: -10 }}
                tickFormatter={(value) => value.toString()}
                className="growth-chart-axis"
              />
              <YAxis
                type="number"
                domain={yAxisDomain as any}
                tickFormatter={(value) => Number(value).toFixed(0)}
                label={{ value: unitLabel, angle: -90, position: 'insideLeft', offset: 18 }}
                className="growth-chart-axis"
              />
              <Tooltip content={<CustomTooltip settings={settings} measurementType={measurementType} />} />

              {/* Percentile lines - using gradient from light to dark */}
              <Line
                type="monotone"
                dataKey="p3"
                name="3rd"
                stroke="#94a3b8"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
              />
              <Line
                type="monotone"
                dataKey="p10"
                name="10th"
                stroke="#64748b"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="p25"
                name="25th"
                stroke="#475569"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="p50"
                name="50th"
                stroke="#14b8a6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="p75"
                name="75th"
                stroke="#475569"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="p90"
                name="90th"
                stroke="#64748b"
                strokeWidth={1}
                dot={false}
                strokeDasharray="4 2"
              />
              <Line
                type="monotone"
                dataKey="p97"
                name="97th"
                stroke="#94a3b8"
                strokeWidth={1}
                dot={false}
                strokeDasharray="2 2"
              />

              {/* Baby's measurements */}
              <Line
                type="monotone"
                dataKey="measurement"
                name={`${selectedBaby.firstName}'s ${measurementType === 'head_circumference' ? 'head' : measurementType}`}
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: '#f97316', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 8, fill: '#ea580c' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Measurements list with percentiles */}
      {measurementsWithPercentiles.length > 0 && (
        <div className={cn(growthChartStyles.measurementsList, "growth-chart-measurements-list")}>
          <h4 className={cn(growthChartStyles.measurementsTitle, "growth-chart-measurements-title")}>
            {t('Recorded Measurements')}
          </h4>
          <div className={cn(growthChartStyles.measurementsGrid, "growth-chart-measurements-grid")}>
            {measurementsWithPercentiles.map((m, idx) => (
              <div key={idx} className={cn(growthChartStyles.measurementItem, "growth-chart-measurement-item")}>
                <div className={cn(growthChartStyles.measurementValue, "growth-chart-measurement-value")}>
                  {m.displayValue.toFixed(2)} {unitLabel}
                </div>
                <div className={cn(growthChartStyles.measurementPercentile, "growth-chart-measurement-percentile")}>
                  {m.percentile.toFixed(1)}{t('th percentile')}
                </div>
                <div className={cn(growthChartStyles.measurementAge, "growth-chart-measurement-age")}>
                  {m.ageMonths.toFixed(1)} months
                </div>
                <div className={cn(growthChartStyles.measurementDate, "growth-chart-measurement-date")}>
                  {new Date(m.date).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend info */}
      <div className={cn(growthChartStyles.legendInfo, "growth-chart-legend-info")}>
        <p className={cn(growthChartStyles.legendText, "growth-chart-legend-text")}>
          {t('CDC Growth Chart for')} {selectedBaby.gender === 'MALE' ? 'Boys' : 'Girls'} {t('(Birth to')} {babyCurrentAgeMonths} {t('months)')}
        </p>
        <p className={cn(growthChartStyles.legendSubtext, "growth-chart-legend-subtext")}>
          {t('Percentile lines show how your baby compares to other children of the same age and sex. The 50th percentile represents the median.')}
        </p>
      </div>

      {/* No measurements message */}
      {measurements.length === 0 && (
        <div className={cn(growthChartStyles.noDataMessage, "growth-chart-no-data")}>
          <p>{t('No')} {measurementType === 'head_circumference' ? 'head circumference' : measurementType} {t('measurements recorded yet.')}</p>
          <p className="text-sm mt-1">{t('Add measurements to see how your baby is growing!')}</p>
        </div>
      )}
    </div>
  );
};

export default GrowthChart;
