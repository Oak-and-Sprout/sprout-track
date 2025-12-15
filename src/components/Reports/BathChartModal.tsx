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
  Legend,
} from 'recharts';
import { ActivityType, DateRange } from './reports.types';

export type BathChartMetric = 'total' | 'avgPerWeek' | 'soapShampoo';

interface BathChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: BathChartMetric | null;
  activities: ActivityType[];
  dateRange: DateRange;
}

// Helper function to get week key from date (ISO week: Monday-Sunday)
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Get Monday of the week
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

// Helper function to format week label
function formatWeekLabel(weekKey: string): string {
  const date = new Date(weekKey);
  const endDate = new Date(date);
  endDate.setDate(endDate.getDate() + 6); // Sunday of the week
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/**
 * BathChartModal Component
 *
 * Displays charts for bath statistics including daily counts, weekly averages, and soap/shampoo usage.
 */
const BathChartModal: React.FC<BathChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  activities,
  dateRange,
}) => {
  // Calculate daily bath counts
  const dailyData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'total') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};

    activities.forEach((activity) => {
      if ('soapUsed' in activity && 'time' in activity) {
        const bathActivity = activity as any;
        const bathTime = new Date(bathActivity.time);
        const dayKey = bathTime.toISOString().split('T')[0];

        if (bathTime >= startDate && bathTime <= endDate) {
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;
        }
      }
    });

    return Object.entries(countsByDay)
      .map(([date, count]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities, dateRange, metric]);

  // Calculate weekly average bath counts
  const weeklyAvgData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'avgPerWeek') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const bathsByWeek: Record<string, number> = {};

    activities.forEach((activity) => {
      if ('soapUsed' in activity && 'time' in activity) {
        const bathActivity = activity as any;
        const bathTime = new Date(bathActivity.time);

        if (bathTime >= startDate && bathTime <= endDate) {
          const weekKey = getWeekKey(bathTime);
          bathsByWeek[weekKey] = (bathsByWeek[weekKey] || 0) + 1;
        }
      }
    });

    // Calculate average per week (total baths / number of weeks)
    const weekKeys = Object.keys(bathsByWeek).sort();
    if (weekKeys.length === 0) return [];

    // Calculate number of weeks in the date range
    const firstWeek = getWeekKey(startDate);
    const lastWeek = getWeekKey(endDate);
    const allWeeks = new Set<string>();
    
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      allWeeks.add(getWeekKey(currentDate));
      currentDate.setDate(currentDate.getDate() + 7);
    }
    const numWeeks = allWeeks.size || 1;

    // Calculate average per week for each week
    return weekKeys.map((weekKey) => {
      const weekBaths = bathsByWeek[weekKey] || 0;
      // For this specific week, calculate how many days are in the range
      const weekStart = new Date(weekKey);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const rangeStart = new Date(Math.max(weekStart.getTime(), startDate.getTime()));
      const rangeEnd = new Date(Math.min(weekEnd.getTime(), endDate.getTime()));
      const daysInRange = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Average baths per day in this week * 7 days
      const avgPerWeek = daysInRange > 0 ? (weekBaths / daysInRange) * 7 : 0;
      
      return {
        weekKey,
        label: formatWeekLabel(weekKey),
        value: avgPerWeek,
      };
    });
  }, [activities, dateRange, metric]);

  // Calculate weekly soap/shampoo breakdown
  const soapShampooData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'soapShampoo') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const bathsByWeek: Record<string, { soap: number; shampoo: number; both: number }> = {};

    activities.forEach((activity) => {
      if ('soapUsed' in activity && 'time' in activity) {
        const bathActivity = activity as any;
        const bathTime = new Date(bathActivity.time);

        if (bathTime >= startDate && bathTime <= endDate) {
          const weekKey = getWeekKey(bathTime);
          
          if (!bathsByWeek[weekKey]) {
            bathsByWeek[weekKey] = { soap: 0, shampoo: 0, both: 0 };
          }

          const soapUsed = bathActivity.soapUsed || false;
          const shampooUsed = bathActivity.shampooUsed || false;

          if (soapUsed && shampooUsed) {
            bathsByWeek[weekKey].both += 1;
          } else if (soapUsed) {
            bathsByWeek[weekKey].soap += 1;
          } else if (shampooUsed) {
            bathsByWeek[weekKey].shampoo += 1;
          }
        }
      }
    });

    const weekKeys = Object.keys(bathsByWeek).sort();
    return weekKeys.map((weekKey) => ({
      weekKey,
      label: formatWeekLabel(weekKey),
      soap: bathsByWeek[weekKey].soap,
      shampoo: bathsByWeek[weekKey].shampoo,
      both: bathsByWeek[weekKey].both,
    }));
  }, [activities, dateRange, metric]);

  const getTitle = (): string => {
    switch (metric) {
      case 'total':
        return 'Baths Over Time';
      case 'avgPerWeek':
        return 'Average Baths per Week';
      case 'soapShampoo':
        return 'Soap/Shampoo Usage by Week';
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
        {metric === 'total' && (
          <>
            {dailyData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  No bath data available for the selected date range.
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
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
                      formatter={(value: any) => [`${value}`, 'Baths']}
                      labelFormatter={(label: any) => `Date: ${label}`}
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
          </>
        )}

        {metric === 'avgPerWeek' && (
          <>
            {weeklyAvgData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  No bath data available for the selected date range.
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={weeklyAvgData} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
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
                      tickFormatter={(value) => value.toFixed(1)}
                      label={{ value: 'Avg Baths per Week', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [`${value.toFixed(1)}`, 'Avg Baths']}
                      labelFormatter={(label: any) => `Week: ${label}`}
                    />
                    <Bar dataKey="value" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'soapShampoo' && (
          <>
            {soapShampooData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  No soap/shampoo bath data available for the selected date range.
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={soapShampooData} margin={{ top: 20, right: 24, left: 8, bottom: 40 }}>
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
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: 'Count', angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name: string) => {
                        if (name === 'soap') return [`${value}`, 'Soap Only'];
                        if (name === 'shampoo') return [`${value}`, 'Shampoo Only'];
                        if (name === 'both') return [`${value}`, 'Both'];
                        return [`${value}`, name];
                      }}
                      labelFormatter={(label: any) => `Week: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="soap" stackId="baths" fill="#6366f1" name="Soap Only" />
                    <Bar dataKey="shampoo" stackId="baths" fill="#14b8a6" name="Shampoo Only" />
                    <Bar dataKey="both" stackId="baths" fill="#f59e0b" name="Both" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default BathChartModal;

