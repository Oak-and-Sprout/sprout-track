'use client';

import React, { useMemo } from 'react';
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
import { ActivityType, DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';

export type DiaperChartMetric = 'wet' | 'poopy';

interface DiaperChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: DiaperChartMetric | null;
  activities: ActivityType[];
  dateRange: DateRange;
}

/**
 * DiaperChartModal Component
 *
 * Displays a line chart modal showing daily diaper counts.
 * Supports wet and poopy diaper metrics.
 */
const DiaperChartModal: React.FC<DiaperChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  activities,
  dateRange,
}) => {
  const { t } = useLocalization();
  
  // Calculate daily diaper counts
  const chartData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || !metric) {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};

    activities.forEach((activity) => {
      if ('type' in activity && 'time' in activity && 'condition' in activity) {
        const activityType = (activity as any).type;
        const diaperActivity = activity as any;

        // Check if this matches the metric we're looking for
        if (metric === 'wet') {
          if (activityType !== 'WET' && activityType !== 'BOTH') return;
        } else if (metric === 'poopy') {
          if (activityType !== 'DIRTY' && activityType !== 'BOTH') return;
        }

        const diaperTime = new Date(diaperActivity.time);
        const dayKey = diaperTime.toISOString().split('T')[0];

        if (diaperTime >= startDate && diaperTime <= endDate) {
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;
        }
      }
    });

    // Convert to array and sort by date
    return Object.entries(countsByDay)
      .map(([date, count]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities, dateRange, metric]);

  const title = metric === 'wet' ? t('Wet Diapers Over Time') : t('Poopy Diapers Over Time');
  const description =
    dateRange.from && dateRange.to
      ? `${t('From')} ${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}`
      : undefined;

  return (
    <Modal open={open && !!metric} onOpenChange={onOpenChange} title={title} description={description}>
      <ModalContent>
        {chartData.length === 0 ? (
          <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
            <p className={cn(styles.emptyText, 'reports-empty-text')}>
              {t('No')} {metric === 'wet' ? 'wet' : 'poopy'} {t('diaper data available for the selected date range.')}
            </p>
          </div>
        ) : (
          <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                <XAxis
                  dataKey="label"
                  label={{ value: t('Date'), position: 'insideBottom', offset: -5 }}
                  className="growth-chart-axis"
                />
                <YAxis
                  type="number"
                  domain={[0, 'auto']}
                  tickFormatter={(value) => value.toFixed(0)}
                  label={{ value: t('Count'), angle: -90, position: 'insideLeft' }}
                  className="growth-chart-axis"
                />
                <RechartsTooltip
                  formatter={(value: any) => [`${value}`, t('Diapers')]}
                  labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#14b8a6' }}
                  activeDot={{ r: 6, fill: '#0f766e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default DiaperChartModal;

