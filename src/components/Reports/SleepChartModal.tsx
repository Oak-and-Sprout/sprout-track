'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { Modal, ModalContent } from '@/src/components/ui/modal';
import { growthChartStyles } from './growth-chart.styles';
import { styles } from './reports.styles';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';

export type SleepChartMetric = 'avgNapDuration' | 'dailyNapTotal' | 'nightSleep' | 'nightWakings';

export interface SleepChartDataPoint {
  date: string;
  label: string;
  value: number;
}

interface SleepChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: SleepChartMetric | null;
  data: SleepChartDataPoint[];
  dateRange: DateRange;
}

// Helper function to format minutes into hours and minutes
const formatMinutes = (minutes: number): string => {
  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

const getChartTitle = (metric: SleepChartMetric | null, t: (key: string) => string): string => {
  switch (metric) {
    case 'avgNapDuration':
      return t('Nap Duration Over Time');
    case 'dailyNapTotal':
      return t('Daily Total Nap Time');
    case 'nightSleep':
      return t('Night Sleep Over Time');
    case 'nightWakings':
      return t('Night Wakings Over Time');
    default:
      return t('Sleep Trends');
  }
};

/**
 * SleepChartModal Component
 *
 * Displays a line chart modal showing sleep trends over time.
 * Supports different metrics: nap duration, daily nap total, night sleep, and night wakings.
 */
const SleepChartModal: React.FC<SleepChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  data,
  dateRange,
}) => {
  const { t } = useLocalization();
  const title = getChartTitle(metric, t);
  const description =
    dateRange.from && dateRange.to
      ? `${t('From')} ${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}`
      : undefined;

  return (
    <Modal
      open={open && !!metric}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <ModalContent>
        {data.length === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('No sleep data available for the selected date range.')}
            </p>
          </div>
        ) : (
          <div className={cn(growthChartStyles.chartWrapper, "growth-chart-wrapper")}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={data}
                margin={{ top: 20, right: 24, left: 8, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                <XAxis
                  dataKey="label"
                  label={{ value: t('Date'), position: 'insideBottom', offset: -5 }}
                  className="growth-chart-axis"
                />
                <YAxis
                  type="number"
                  domain={['auto', 'auto']}
                  tickFormatter={(value) =>
                    metric === 'nightWakings' ? value.toFixed(0) : formatMinutes(value)
                  }
                  className="growth-chart-axis"
                />
                <RechartsTooltip
                  formatter={(value: any) =>
                    metric === 'nightWakings'
                      ? [`${value}`, t('Wakings')]
                      : [formatMinutes(value as number), t('Sleep')]
                  }
                  labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#14b8a6" }}
                  activeDot={{ r: 5, fill: "#0f766e" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default SleepChartModal;

