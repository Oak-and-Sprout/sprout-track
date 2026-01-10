'use client';

import React, { useMemo } from 'react';
import { cn } from '@/src/lib/utils';
import { Modal, ModalContent } from '@/src/components/ui/modal';
import { growthChartStyles } from './growth-chart.styles';
import { styles } from './reports.styles';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from 'recharts';
import { ActivityType, DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';

export type FeedingChartMetric = 'bottle' | 'breast' | 'solids';

interface FeedingChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: FeedingChartMetric | null;
  activities: ActivityType[];
  dateRange: DateRange;
}

// Helper function to format minutes into hours and minutes
const formatMinutes = (minutes: number): string => {  const { t } = useLocalization();

  if (minutes === 0) return '0m';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// Generate colors for different types
const generateColors = (count: number): string[] => {
  const colors = [
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#10b981', // emerald
    '#f97316', // orange
    '#ec4899', // pink
    '#84cc16', // lime
  ];
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]);
};

/**
 * FeedingChartModal Component
 *
 * Displays charts for feeding statistics including bottle, breast, and solids feeds.
 */
const FeedingChartModal: React.FC<FeedingChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  activities,
  dateRange,
}) => {
  // Calculate bottle feed data
  const bottleData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'bottle') {
      return { data: [], bottleTypes: [], colors: [] };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};
    const amountsByDayAndType: Record<string, Record<string, number>> = {};
    const bottleTypesSet = new Set<string>();

    activities.forEach((activity) => {
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;
        if (activityType !== 'BOTTLE') return;

        const feedActivity = activity as any;
        const feedTime = new Date(feedActivity.time);
        const dayKey = feedTime.toISOString().split('T')[0];

        if (feedTime >= startDate && feedTime <= endDate) {
          // Count feeds
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;

          // Track amounts by bottle type
          if (feedActivity.amount) {
            const bottleType = feedActivity.bottleType || 'Uncategorized';
            bottleTypesSet.add(bottleType);

            if (!amountsByDayAndType[dayKey]) {
              amountsByDayAndType[dayKey] = {};
            }
            amountsByDayAndType[dayKey][bottleType] =
              (amountsByDayAndType[dayKey][bottleType] || 0) + feedActivity.amount;
          }
        }
      }
    });

    const sortedDays = Object.keys(countsByDay).sort();
    const bottleTypes = Array.from(bottleTypesSet).sort();
    const colors = generateColors(bottleTypes.length);

    // Combine line and bar data into single dataset
    const combinedData = sortedDays.map((dayKey) => {
      const dayData: any = {
        date: dayKey,
        label: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: countsByDay[dayKey] || 0,
      };
      bottleTypes.forEach((type) => {
        dayData[type] = amountsByDayAndType[dayKey]?.[type] || 0;
      });
      return dayData;
    });

    return { data: combinedData, bottleTypes, colors };
  }, [activities, dateRange, metric]);

  // Calculate breast feed data
  const breastData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'breast') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};
    const leftDurationByDay: Record<string, { total: number; count: number }> = {};
    const rightDurationByDay: Record<string, { total: number; count: number }> = {};

    activities.forEach((activity) => {
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;
        if (activityType !== 'BREAST') return;

        const feedActivity = activity as any;
        const feedTime = new Date(feedActivity.time);
        const dayKey = feedTime.toISOString().split('T')[0];

        if (feedTime >= startDate && feedTime <= endDate) {
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;

          // Duration is in seconds, convert to minutes
          const durationSeconds = feedActivity.feedDuration || 0;
          const durationMinutes = Math.floor(durationSeconds / 60);

          if (feedActivity.side === 'LEFT' && durationMinutes > 0) {
            if (!leftDurationByDay[dayKey]) {
              leftDurationByDay[dayKey] = { total: 0, count: 0 };
            }
            leftDurationByDay[dayKey].total += durationMinutes;
            leftDurationByDay[dayKey].count += 1;
          } else if (feedActivity.side === 'RIGHT' && durationMinutes > 0) {
            if (!rightDurationByDay[dayKey]) {
              rightDurationByDay[dayKey] = { total: 0, count: 0 };
            }
            rightDurationByDay[dayKey].total += durationMinutes;
            rightDurationByDay[dayKey].count += 1;
          }
        }
      }
    });

    const sortedDays = Object.keys(countsByDay).sort();
    return sortedDays.map((dayKey) => ({
      date: dayKey,
      label: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: countsByDay[dayKey] || 0,
      leftAvg: leftDurationByDay[dayKey]?.count > 0 
        ? leftDurationByDay[dayKey].total / leftDurationByDay[dayKey].count 
        : 0,
      rightAvg: rightDurationByDay[dayKey]?.count > 0 
        ? rightDurationByDay[dayKey].total / rightDurationByDay[dayKey].count 
        : 0,
    }));
  }, [activities, dateRange, metric]);

  // Calculate solids feed data
  const solidsData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'solids') {
      return { data: [], foodTypes: [], colors: [] };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};
    const amountsByDayAndFood: Record<string, Record<string, number>> = {};
    const foodTypesSet = new Set<string>();

    activities.forEach((activity) => {
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;
        if (activityType !== 'SOLIDS') return;

        const feedActivity = activity as any;
        const feedTime = new Date(feedActivity.time);
        const dayKey = feedTime.toISOString().split('T')[0];

        if (feedTime >= startDate && feedTime <= endDate) {
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;

          if (feedActivity.amount && feedActivity.food) {
            const food = feedActivity.food;
            foodTypesSet.add(food);

            if (!amountsByDayAndFood[dayKey]) {
              amountsByDayAndFood[dayKey] = {};
            }
            amountsByDayAndFood[dayKey][food] =
              (amountsByDayAndFood[dayKey][food] || 0) + feedActivity.amount;
          }
        }
      }
    });

    const sortedDays = Object.keys(countsByDay).sort();
    const foodTypes = Array.from(foodTypesSet).sort();
    const colors = generateColors(foodTypes.length);

    // Combine line and bar data into single dataset
    const combinedData = sortedDays.map((dayKey) => {
      const dayData: any = {
        date: dayKey,
        label: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: countsByDay[dayKey] || 0,
      };
      foodTypes.forEach((food) => {
        dayData[food] = amountsByDayAndFood[dayKey]?.[food] || 0;
      });
      return dayData;
    });

    return { data: combinedData, foodTypes, colors };
  }, [activities, dateRange, metric]);

  const getTitle = (): string => {
    switch (metric) {
      case 'bottle':
        return 'Bottle Feeds Over Time';
      case 'breast':
        return 'Breast Feeds Over Time';
      case 'solids':
        return 'Solids Feeds Over Time';
      default:
        return '';
    }
  };

  const getDescription = (): string => {
    if (!dateRange.from || !dateRange.to) return '';
    return `From ${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}`;
  };

  if (!metric) return null;

  return (
    <Modal open={open && !!metric} onOpenChange={onOpenChange} title={getTitle()} description={getDescription()}>
      <ModalContent>
        {metric === 'bottle' && (
          <>
            {bottleData.data.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No bottle feed data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={bottleData.data} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="count"
                      type="number"
                      domain={[0, 'auto']}
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="amount"
                      orientation="right"
                      type="number"
                      domain={[0, 'auto']}
                      label={{ value: 'Amount', angle: -90, position: 'insideRight' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        if (name === 'count') {
                          return [`${value}`, 'Feeds'];
                        }
                        return [`${value.toFixed(1)}`, name || ''];
                      }}
                      labelFormatter={(label: any) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="count"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6, fill: '#0f766e' }}
                      name="Feed Count"
                    />
                    {bottleData.bottleTypes.map((type, index) => (
                      <Bar
                        key={type}
                        yAxisId="amount"
                        dataKey={type}
                        stackId="bottles"
                        fill={bottleData.colors[index]}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'breast' && (
          <>
            {breastData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No breast feed data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={breastData} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="count"
                      type="number"
                      domain={[0, 'auto']}
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="duration"
                      orientation="right"
                      type="number"
                      domain={[0, 'auto']}
                      tickFormatter={(value) => formatMinutes(value as number)}
                      label={{ value: 'Avg Duration', angle: -90, position: 'insideRight' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        if (name === 'count' || name === 'Feed Count') {
                          const countValue = typeof value === 'number' ? Math.round(value) : parseInt(value, 10);
                          return [countValue.toString(), 'Feeds'];
                        }
                        if (name === 'leftAvg' || name === 'Left Avg') {
                          return [formatMinutes(value as number), 'Left Avg'];
                        }
                        if (name === 'rightAvg' || name === 'Right Avg') {
                          return [formatMinutes(value as number), 'Right Avg'];
                        }
                        return [formatMinutes(value as number), name || ''];
                      }}
                      labelFormatter={(label: any) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="count"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6, fill: '#0f766e' }}
                      name="Feed Count"
                    />
                    <Bar
                      yAxisId="duration"
                      dataKey="leftAvg"
                      stackId="duration"
                      fill="#6366f1"
                      name="Left Avg"
                    />
                    <Bar
                      yAxisId="duration"
                      dataKey="rightAvg"
                      stackId="duration"
                      fill="#ec4899"
                      name="Right Avg"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'solids' && (
          <>
            {solidsData.data.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No solids feed data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={solidsData.data} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      angle={-30}
                      textAnchor="end"
                      height={60}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="count"
                      type="number"
                      domain={[0, 'auto']}
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="amount"
                      orientation="right"
                      type="number"
                      domain={[0, 'auto']}
                      label={{ value: 'Amount', angle: -90, position: 'insideRight' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        if (name === 'count') {
                          return [`${value}`, 'Feeds'];
                        }
                        return [`${value.toFixed(1)}`, name || ''];
                      }}
                      labelFormatter={(label: any) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="count"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6, fill: '#0f766e' }}
                      name="Feed Count"
                    />
                    {solidsData.foodTypes.map((food, index) => (
                      <Bar
                        key={food}
                        yAxisId="amount"
                        dataKey={food}
                        stackId="foods"
                        fill={solidsData.colors[index]}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default FeedingChartModal;

