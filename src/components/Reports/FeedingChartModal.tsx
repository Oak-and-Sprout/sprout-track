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

export type FeedingChartMetric = 'bottle' | 'breast' | 'solids';

interface FeedingChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: FeedingChartMetric | null;
  activities: ActivityType[];
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
    const leftMinutesByDay: Record<string, number> = {};
    const rightMinutesByDay: Record<string, number> = {};

    activities.forEach((activity) => {
      if ('type' in activity && 'time' in activity) {
        const activityType = (activity as any).type;
        if (activityType !== 'BREAST') return;

        const feedActivity = activity as any;
        const feedTime = new Date(feedActivity.time);
        const dayKey = feedTime.toISOString().split('T')[0];

        if (feedTime >= startDate && feedTime <= endDate) {
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;

          const duration = feedActivity.feedDuration || 0;
          if (feedActivity.side === 'LEFT') {
            leftMinutesByDay[dayKey] = (leftMinutesByDay[dayKey] || 0) + duration;
          } else if (feedActivity.side === 'RIGHT') {
            rightMinutesByDay[dayKey] = (rightMinutesByDay[dayKey] || 0) + duration;
          }
        }
      }
    });

    const sortedDays = Object.keys(countsByDay).sort();
    return sortedDays.map((dayKey) => ({
      date: dayKey,
      label: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count: countsByDay[dayKey] || 0,
      leftMinutes: leftMinutesByDay[dayKey] || 0,
      rightMinutes: rightMinutesByDay[dayKey] || 0,
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
                  No bottle feed data available for the selected date range.
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
                      formatter={(value: any, name: string) => {
                        if (name === 'count') {
                          return [`${value}`, 'Feeds'];
                        }
                        return [`${value.toFixed(1)}`, name];
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
                  No breast feed data available for the selected date range.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Line chart for daily counts */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Daily Breast Feed Count</h4>
                  <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={breastData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                        <XAxis
                          dataKey="label"
                          label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
                          className="growth-chart-axis"
                        />
                        <YAxis
                          type="number"
                          domain={[0, 'auto']}
                          tickFormatter={(value) => value.toFixed(0)}
                          label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                          className="growth-chart-axis"
                        />
                        <RechartsTooltip
                          formatter={(value: any) => [`${value}`, 'Feeds']}
                          labelFormatter={(label: any) => `Date: ${label}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#14b8a6"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#14b8a6' }}
                          activeDot={{ r: 6, fill: '#0f766e' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Line chart for duration by side */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Daily Duration by Side</h4>
                  <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={breastData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                        <XAxis
                          dataKey="label"
                          label={{ value: 'Date', position: 'insideBottom', offset: -5 }}
                          className="growth-chart-axis"
                        />
                        <YAxis
                          type="number"
                          domain={[0, 'auto']}
                          tickFormatter={(value) => formatMinutes(value as number)}
                          label={{ value: 'Duration', angle: -90, position: 'insideLeft' }}
                          className="growth-chart-axis"
                        />
                        <RechartsTooltip
                          formatter={(value: any, name: string) => [
                            formatMinutes(value as number),
                            name === 'leftMinutes' ? 'Left' : 'Right',
                          ]}
                          labelFormatter={(label: any) => `Date: ${label}`}
                        />
                        <Legend
                          formatter={(value) => (value === 'leftMinutes' ? 'Left' : value === 'rightMinutes' ? 'Right' : value)}
                        />
                        <Line
                          type="monotone"
                          dataKey="leftMinutes"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#6366f1' }}
                          activeDot={{ r: 6, fill: '#4f46e5' }}
                          name="leftMinutes"
                        />
                        <Line
                          type="monotone"
                          dataKey="rightMinutes"
                          stroke="#ec4899"
                          strokeWidth={2}
                          dot={{ r: 4, fill: '#ec4899' }}
                          activeDot={{ r: 6, fill: '#db2777' }}
                          name="rightMinutes"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {metric === 'solids' && (
          <>
            {solidsData.data.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  No solids feed data available for the selected date range.
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
                      formatter={(value: any, name: string) => {
                        if (name === 'count') {
                          return [`${value}`, 'Feeds'];
                        }
                        return [`${value.toFixed(1)}`, name];
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

