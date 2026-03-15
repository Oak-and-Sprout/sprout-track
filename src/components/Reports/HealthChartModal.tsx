'use client';

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { Modal, ModalContent } from '@/src/components/ui/modal';
import { growthChartStyles } from './growth-chart.styles';
import { styles } from './reports.styles';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { MedicineLogActivity, DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';

interface HealthChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineActivities: MedicineLogActivity[];
  dateRange: DateRange;
}

// Color palette for multiple medicines/supplements
const CHART_COLORS = ['#14b8a6', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

/**
 * HealthChartModal Component
 *
 * Displays a bar chart showing daily dose counts for each medicine/supplement.
 * All days in the date range are shown, with 0 for days without doses.
 */
const HealthChartModal: React.FC<HealthChartModalProps> = ({
  open,
  onOpenChange,
  medicineActivities,
  dateRange,
}) => {
  const { t } = useLocalization();

  // Build chart data: one entry per day in range, stacked bars per medicine
  const { chartData, medicineNames } = useMemo(() => {
    if (!medicineActivities.length || !dateRange.from || !dateRange.to) {
      return { chartData: [], medicineNames: [] };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    // Get unique medicine names
    const names = new Set<string>();
    medicineActivities.forEach((a) => {
      names.add(a.medicine?.name || 'Unknown');
    });
    const nameList = Array.from(names);

    // Group doses by day and medicine name
    const byDay: Record<string, Record<string, number>> = {};
    medicineActivities.forEach((a) => {
      const time = new Date(a.time);
      if (time < startDate || time > endDate) return;
      const dayKey = time.toLocaleDateString('en-CA');
      const name = a.medicine?.name || 'Unknown';
      if (!byDay[dayKey]) byDay[dayKey] = {};
      byDay[dayKey][name] = (byDay[dayKey][name] || 0) + 1;
    });

    // Build a row for every day in the range, including days with 0 doses
    const data: Record<string, any>[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayKey = current.toLocaleDateString('en-CA');
      const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const row: Record<string, any> = { date: dayKey, label };
      for (const name of nameList) {
        row[name] = byDay[dayKey]?.[name] || 0;
      }
      data.push(row);
      current.setDate(current.getDate() + 1);
    }

    return { chartData: data, medicineNames: nameList };
  }, [medicineActivities, dateRange]);

  const getDescription = (): string => {
    if (!dateRange.from || !dateRange.to) return '';
    return `${t('From')} ${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}`;
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('Daily Doses')} description={getDescription()}>
      <ModalContent>
        {chartData.length === 0 ? (
          <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
            <p className={cn(styles.emptyText, 'reports-empty-text')}>
              {t('No health chart data available for the selected date range.')}
            </p>
          </div>
        ) : (
          <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                <XAxis
                  dataKey="label"
                  angle={-30}
                  textAnchor="end"
                  height={60}
                  className="growth-chart-axis"
                />
                <YAxis
                  type="number"
                  domain={[0, 'auto']}
                  allowDecimals={false}
                  className="growth-chart-axis"
                />
                <RechartsTooltip
                  labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                />
                <Legend />
                {medicineNames.map((name, i) => (
                  <Bar
                    key={name}
                    dataKey={name}
                    stackId="doses"
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                    name={name}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default HealthChartModal;
