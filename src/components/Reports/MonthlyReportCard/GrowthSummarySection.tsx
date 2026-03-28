'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Scale, Ruler, CircleDot } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { GrowthSummarySectionProps } from './monthly-report-card.types';
import type { GrowthMetric, GrowthChartData } from '@/app/api/types';

type ChartType = 'weight' | 'length' | 'headCircumference';

const chartTypeConfig: { type: ChartType; label: string; icon: React.ReactNode; cdcLabel: string }[] = [
  { type: 'weight', label: 'Weight', icon: <Scale className="h-4 w-4" />, cdcLabel: 'Weight-for-age (CDC)' },
  { type: 'length', label: 'Length', icon: <Ruler className="h-4 w-4" />, cdcLabel: 'Length-for-age (CDC)' },
  { type: 'headCircumference', label: 'Head', icon: <CircleDot className="h-4 w-4" />, cdcLabel: 'Head circ.-for-age (CDC)' },
];

// Percentile line colors matching GrowthChart.tsx
const percentileLines = [
  { dataKey: 'p3', name: '3rd', stroke: '#94a3b8', width: 1, dash: '2 2' },
  { dataKey: 'p10', name: '10th', stroke: '#64748b', width: 1, dash: '4 2' },
  { dataKey: 'p25', name: '25th', stroke: '#475569', width: 1.5, dash: '' },
  { dataKey: 'p50', name: '50th', stroke: '#14b8a6', width: 2, dash: '' },
  { dataKey: 'p75', name: '75th', stroke: '#475569', width: 1.5, dash: '' },
  { dataKey: 'p90', name: '90th', stroke: '#64748b', width: 1, dash: '4 2' },
  { dataKey: 'p97', name: '97th', stroke: '#94a3b8', width: 1, dash: '2 2' },
];

function formatTrend(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function MetricCard({ label, metric }: { label: string; metric: GrowthMetric | null }) {
  const { t } = useLocalization();
  if (!metric) {
    return (
      <div className={cn(s.metricCard, 'report-card-metric')}>
        <p className={cn(s.metricLabel, 'report-card-metric-label')}>{label}</p>
        <p className={cn(s.metricValue, 'report-card-metric-value')}>—</p>
      </div>
    );
  }
  const ordinal = metric.percentile === 1 ? 'st' : metric.percentile === 2 ? 'nd' : metric.percentile === 3 ? 'rd' : 'th';
  const pctText = `${metric.percentile}${ordinal} ${t('percentile')} ${formatTrend(metric.trend)}`;
  return (
    <div className={cn(s.metricCard, 'report-card-metric')}>
      <p className={cn(s.metricLabel, 'report-card-metric-label')}>{label}</p>
      <p className={cn(s.metricValue, 'report-card-metric-value')}>{metric.value} {metric.unit}</p>
      <p className={cn(s.metricSub, s.metricSubPositive, 'report-card-metric-sub-positive')}>{pctText}</p>
    </div>
  );
}

/** Custom tooltip mirroring the GrowthChart.tsx tooltip:
 *  Shows the baby's percentile + value sandwiched between the two closest percentile curves */
function GrowthChartTooltip({ active, payload, label, babyName, t }: any) {
  if (!active || !payload?.length) return null;

  const measurementPoint = payload.find((p: any) => p.dataKey === 'measurement');
  const dataPoint = payload[0]?.payload as any;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 report-card-chart-tooltip" style={{ fontSize: 12 }}>
      <p className="font-medium text-gray-800 mb-1">
        {t('Age:')} {typeof label === 'number' ? Number(label).toFixed(1) : label} {t('months')}
      </p>
      {measurementPoint && measurementPoint.value != null && (() => {
        // Collect percentile entries, sorted by value ascending
        const pctEntries = payload
          .filter((p: any) => p.dataKey !== 'measurement' && p.dataKey !== 'percentile' && p.value != null)
          .sort((a: any, b: any) => (a.value ?? 0) - (b.value ?? 0));

        if (!pctEntries.length) return null;

        const measValue = measurementPoint.value as number;
        const measPercentile = dataPoint?.percentile;
        let lower: any = null;
        let upper: any = null;

        for (let i = 0; i < pctEntries.length; i++) {
          if (pctEntries[i].value >= measValue) {
            upper = pctEntries[i];
            lower = i > 0 ? pctEntries[i - 1] : null;
            break;
          }
        }
        // If measurement is above all curves
        if (!upper) lower = pctEntries[pctEntries.length - 1];

        const lines: React.ReactNode[] = [];

        if (upper) {
          lines.push(
            <p key="upper" style={{ color: upper.color }}>
              {upper.name}: {Number(upper.value).toFixed(2)}
            </p>
          );
        }

        if (measPercentile !== undefined) {
          lines.push(
            <p key="meas" className="font-semibold text-orange-600">
              {Number(measPercentile).toFixed(1)}%: {Number(measValue).toFixed(2)}
            </p>
          );
        }

        if (lower) {
          lines.push(
            <p key="lower" style={{ color: lower.color }}>
              {lower.name}: {Number(lower.value).toFixed(2)}
            </p>
          );
        }

        return <div className="text-xs space-y-0.5">{lines}</div>;
      })()}
    </div>
  );
}

function GrowthChartCard({
  chartData,
  title,
  babyName,
  disableAnimation,
}: {
  chartData: GrowthChartData;
  title: string;
  babyName: string;
  disableAnimation?: boolean;
}) {
  const { t } = useLocalization();

  if (!chartData.points.length) {
    return (
      <div className={cn(s.card, 'report-card-card')}>
        <p className={cn(s.cardTitle, 'report-card-card-title')}>{t(title)}</p>
        <p className={cn(s.noData, 'report-card-no-data', 'mb-0')}>{t('No measurements recorded')}</p>
      </div>
    );
  }

  // Compute Y domain with padding
  const allValues = chartData.points.flatMap(p => [
    p.p3, p.p97, ...(p.measurement !== undefined ? [p.measurement] : []),
  ]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min;
  const padding = range > 0 ? range * 0.1 : (max || 1) * 0.1;
  const yMin = Math.max(0, min - padding);
  const yMax = max + padding;

  return (
    <div className={cn(s.card, 'report-card-card report-card-chart')}>
      <p className={cn(s.cardTitle, 'report-card-card-title')}>{t(title)}</p>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData.points} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
            <XAxis
              dataKey="ageMonths"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => v === 0 ? '0' : `${v}`}
              label={{ value: t('Age (months)'), position: 'insideBottom', offset: -5, fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              domain={[yMin, yMax]}
              tickFormatter={(v: number) => Number(v).toFixed(0)}
            />
            <Tooltip content={<GrowthChartTooltip babyName={babyName} t={t} />} />

            {/* Percentile curves */}
            {percentileLines.map(line => (
              <Line
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.name}
                stroke={line.stroke}
                strokeWidth={line.width}
                strokeDasharray={line.dash || undefined}
                dot={false}
                isAnimationActive={!disableAnimation}
              />
            ))}

            {/* Baby's measurements */}
            <Line
              type="monotone"
              dataKey="measurement"
              name={babyName}
              stroke="#f97316"
              strokeWidth={2}
              dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#ea580c' }}
              connectNulls
              isAnimationActive={!disableAnimation}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const GrowthSummarySection: React.FC<GrowthSummarySectionProps & { isPdfExport?: boolean }> = ({
  growth, babyName, isPdfExport,
}) => {
  const { t } = useLocalization();
  const [activeChart, setActiveChart] = useState<ChartType>('weight');

  const hasAnyMeasurement = growth.weight || growth.length || growth.headCircumference;
  const hasAnyChartData = growth.chartData.weight.points.length > 0
    || growth.chartData.length.points.length > 0
    || growth.chartData.headCircumference.points.length > 0;

  if (!hasAnyMeasurement && !hasAnyChartData) {
    return <p className={cn(s.noData, 'report-card-no-data')}>{t('No measurements recorded')}</p>;
  }

  const activeChartData = growth.chartData[activeChart];
  const activeConfig = chartTypeConfig.find(c => c.type === activeChart)!;

  return (
    <>
      {/* Metric grid */}
      <div className={cn(s.metricGrid4)}>
        <MetricCard label={t('Weight')} metric={growth.weight} />
        <MetricCard label={t('Length')} metric={growth.length} />
        <MetricCard label={t('Head circ.')} metric={growth.headCircumference} />
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Growth velocity')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>
            {growth.velocity ? `${growth.velocity.value > 0 ? '+' : ''}${growth.velocity.value} ${growth.velocity.unit}` : '—'}
          </p>
          <p className={cn(s.metricSub, s.metricSubNeutral, 'report-card-metric-sub-neutral')}>{t('since last month')}</p>
        </div>
      </div>

      {/* PDF mode: render all 3 charts separately with animations disabled */}
      {isPdfExport ? (
        <>
          {growth.chartData.weight.points.length > 0 && (
            <GrowthChartCard chartData={growth.chartData.weight} title="Weight-for-age (CDC)" babyName={babyName} disableAnimation />
          )}
          {growth.chartData.length.points.length > 0 && (
            <GrowthChartCard chartData={growth.chartData.length} title="Length-for-age (CDC)" babyName={babyName} disableAnimation />
          )}
          {growth.chartData.headCircumference.points.length > 0 && (
            <GrowthChartCard chartData={growth.chartData.headCircumference} title="Head circ.-for-age (CDC)" babyName={babyName} disableAnimation />
          )}
        </>
      ) : (
        <>
          {/* Type toggle buttons — matching GrowthChart.tsx pattern */}
          {hasAnyChartData && (
            <div className="flex flex-wrap gap-2 mb-3">
              {chartTypeConfig.map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => setActiveChart(type)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors',
                    'report-card-chart-toggle',
                    activeChart === type
                      ? 'bg-teal-50 border-teal-500 text-teal-700 hover:bg-teal-100 report-card-chart-toggle-active'
                      : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  )}
                  type="button"
                >
                  {icon}
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Active chart */}
          {activeChartData.points.length > 0 && (
            <GrowthChartCard chartData={activeChartData} title={activeConfig.cdcLabel} babyName={babyName} />
          )}
        </>
      )}
    </>
  );
};

export default GrowthSummarySection;
