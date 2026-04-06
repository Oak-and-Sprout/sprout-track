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
  ComposedChart,
  Bar,
  Legend,
} from 'recharts';
import { ActivityType, DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';
import { convertVolume } from '@/src/utils/unit-conversion';

export type PumpingChartMetric = 'count' | 'duration' | 'amount' | 'inventory';

interface PumpingChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: PumpingChartMetric | null;
  activities: ActivityType[];
  dateRange: DateRange;
  currentBalance?: { balance: number; unit: string } | null;
  enableBreastMilkTracking?: boolean;
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

/**
 * PumpingChartModal Component
 *
 * Displays charts for pumping statistics including count, duration, and amounts.
 */
const PumpingChartModal: React.FC<PumpingChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  activities,
  dateRange,
  currentBalance,
  enableBreastMilkTracking = true,
}) => {
  const { t } = useLocalization();
  // Calculate pump count per day
  const countData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'count') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const countsByDay: Record<string, number> = {};

    activities.forEach((activity) => {
      if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
        const pumpActivity = activity as any;
        const pumpTime = pumpActivity.startTime ? new Date(pumpActivity.startTime) : null;
        
        if (pumpTime && pumpTime >= startDate && pumpTime <= endDate) {
          const dayKey = pumpTime.toLocaleDateString('en-CA').split('T')[0];
          countsByDay[dayKey] = (countsByDay[dayKey] || 0) + 1;
        }
      }
    });

    return Object.entries(countsByDay)
      .map(([date, count]) => ({
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: count,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities, dateRange, metric]);

  // Calculate average duration per day
  const durationData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'duration') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const durationsByDay: Record<string, { total: number; count: number }> = {};

    activities.forEach((activity) => {
      if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
        const pumpActivity = activity as any;
        const pumpTime = pumpActivity.startTime ? new Date(pumpActivity.startTime) : null;
        
        if (pumpTime && pumpTime >= startDate && pumpTime <= endDate) {
          const dayKey = pumpTime.toLocaleDateString('en-CA').split('T')[0];
          
          let durationMinutes = 0;
          if (pumpActivity.startTime && pumpActivity.endTime) {
            const start = new Date(pumpActivity.startTime);
            const end = new Date(pumpActivity.endTime);
            const diffMs = end.getTime() - start.getTime();
            if (diffMs > 0) {
              durationMinutes = Math.floor(diffMs / (1000 * 60));
            }
          } else if (pumpActivity.duration) {
            durationMinutes = Math.floor(pumpActivity.duration / 60);
          }

          if (durationMinutes > 0) {
            if (!durationsByDay[dayKey]) {
              durationsByDay[dayKey] = { total: 0, count: 0 };
            }
            durationsByDay[dayKey].total += durationMinutes;
            durationsByDay[dayKey].count += 1;
          }
        }
      }
    });

    return Object.entries(durationsByDay)
      .map(([date, data]) => ({
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: data.count > 0 ? data.total / data.count : 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities, dateRange, metric]);

  // Calculate amount data (total and average per side)
  const amountData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'amount') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const amountsByDay: Record<string, {
      leftTotal: number;
      rightTotal: number;
      leftCount: number;
      rightCount: number;
      dayTotal: number;
    }> = {};

    activities.forEach((activity) => {
      if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
        const pumpActivity = activity as any;
        const pumpTime = pumpActivity.startTime ? new Date(pumpActivity.startTime) : null;
        
        if (pumpTime && pumpTime >= startDate && pumpTime <= endDate) {
          const dayKey = pumpTime.toLocaleDateString('en-CA').split('T')[0];
          
          const amounts = amountsByDay[dayKey] ??= { leftTotal: 0, rightTotal: 0, leftCount: 0, rightCount: 0, dayTotal: 0 };
          const leftAmount = typeof pumpActivity.leftAmount === 'number' ? pumpActivity.leftAmount : 0;
          const rightAmount = typeof pumpActivity.rightAmount === 'number' ? pumpActivity.rightAmount : 0;
          const totalAmount = typeof pumpActivity.totalAmount === 'number' ? pumpActivity.totalAmount : 0;

          amounts.dayTotal += totalAmount > 0 ? totalAmount : leftAmount + rightAmount;

          if (leftAmount > 0) {
            amounts.leftTotal += leftAmount;
            amounts.leftCount += 1;
          } else if (totalAmount > 0) {
            if (rightAmount > 0 && rightAmount < totalAmount) {
              amounts.leftTotal += (totalAmount - rightAmount);
              amounts.leftCount += 1;
            } else if (rightAmount === 0) {
              amounts.leftTotal += totalAmount / 2;
              amounts.leftCount += 1;
            }
          }

          if (rightAmount > 0) {
            amounts.rightTotal += rightAmount;
            amounts.rightCount += 1;
          } else if (totalAmount > 0) {
            if (leftAmount > 0 && leftAmount < totalAmount) {
              amounts.rightTotal += (totalAmount - leftAmount);
              amounts.rightCount += 1;
            } else if (leftAmount === 0) {
              amounts.rightTotal += totalAmount / 2;
              amounts.rightCount += 1;
            }
          }
        }
      }
    });

    return Object.entries(amountsByDay)
      .map(([date, data]) => ({
        date,
        label: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayTotal: data.dayTotal,
        leftTotal: data.leftTotal,
        rightTotal: data.rightTotal,
        leftAvg: data.leftCount > 0 ? data.leftTotal / data.leftCount : 0,
        rightAvg: data.rightCount > 0 ? data.rightTotal / data.rightCount : 0,
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [activities, dateRange, metric]);

  // Calculate inventory data: daily consumed (breast milk bottle feeds) and actual stored balance
  const inventoryData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'inventory' || !currentBalance) {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const targetUnit = 'OZ';

    // Collect all inventory events with their dates and effects on balance
    const eventsByDay: Record<string, { consumed: number; stored: number; adjusted: number }> = {};

    activities.forEach((activity) => {
      // Bottle feeds with breast milk = consumed
      if ('type' in activity && 'time' in activity && 'bottleType' in activity) {
        const feedActivity = activity as any;
        if (feedActivity.type === 'BOTTLE') {
          let bmConsumed = 0;
          if (feedActivity.bottleType === 'Breast Milk' && feedActivity.amount) {
            bmConsumed = convertVolume(feedActivity.amount, feedActivity.unitAbbr || 'OZ', targetUnit);
          } else if (feedActivity.bottleType === 'Formula\\Breast' && feedActivity.breastMilkAmount) {
            bmConsumed = convertVolume(feedActivity.breastMilkAmount, feedActivity.unitAbbr || 'OZ', targetUnit);
          }
          if (bmConsumed > 0) {
            const feedTime = new Date(feedActivity.time);
            if (feedTime >= startDate && feedTime <= endDate) {
              const dayKey = feedTime.toISOString().split('T')[0];
              if (!eventsByDay[dayKey]) eventsByDay[dayKey] = { consumed: 0, stored: 0, adjusted: 0 };
              eventsByDay[dayKey].consumed += bmConsumed;
            }
          }
        }
      }

      // Pump logs with pumpAction "STORED" = stored
      if ('leftAmount' in activity || 'rightAmount' in activity || 'totalAmount' in activity) {
        const pumpActivity = activity as any;
        if (pumpActivity.pumpAction === 'STORED' && pumpActivity.totalAmount) {
          const pumpTime = pumpActivity.startTime ? new Date(pumpActivity.startTime) : null;
          if (pumpTime && pumpTime >= startDate && pumpTime <= endDate) {
            const dayKey = pumpTime.toISOString().split('T')[0];
            if (!eventsByDay[dayKey]) eventsByDay[dayKey] = { consumed: 0, stored: 0, adjusted: 0 };
            eventsByDay[dayKey].stored += convertVolume(pumpActivity.totalAmount, pumpActivity.unitAbbr || 'OZ', targetUnit);
          }
        }
      }

      // Breast milk adjustments
      if ('reason' in activity && 'amount' in activity && !('doseAmount' in activity) && !('type' in activity)) {
        const adjActivity = activity as any;
        const adjTime = adjActivity.time ? new Date(adjActivity.time) : null;
        if (adjTime && adjTime >= startDate && adjTime <= endDate) {
          const dayKey = adjTime.toISOString().split('T')[0];
          if (!eventsByDay[dayKey]) eventsByDay[dayKey] = { consumed: 0, stored: 0, adjusted: 0 };
          eventsByDay[dayKey].adjusted += convertVolume(adjActivity.amount, adjActivity.unitAbbr || 'OZ', targetUnit);
        }
      }
    });

    // Calculate total net change across all days in the range
    const sortedDays = Object.keys(eventsByDay).sort();
    let totalNetInRange = 0;
    for (const day of sortedDays) {
      const d = eventsByDay[day];
      totalNetInRange += d.stored + d.adjusted - d.consumed;
    }

    // Work backwards from current balance to find balance at start of range
    let runningBalance = currentBalance.balance - totalNetInRange;

    // Walk forward, only emitting data points for days with consumption
    const result: { date: string; label: string; consumed: number; storedBalance: number }[] = [];
    for (const date of sortedDays) {
      const day = eventsByDay[date];
      runningBalance += day.stored + day.adjusted - day.consumed;
      if (day.consumed > 0) {
        result.push({
          date,
          label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          consumed: Math.round(day.consumed * 100) / 100,
          storedBalance: Math.round(runningBalance * 100) / 100,
        });
      }
    }

    return result;
  }, [activities, dateRange, metric, currentBalance]);

  const getTitle = (): string => {
    switch (metric) {
      case 'count':
        return t('Pump Count Over Time');
      case 'duration':
        return t('Average Pump Duration Over Time');
      case 'amount':
        return t('Pump Amounts Over Time');
      case 'inventory':
        return t('Inventory');
      default:
        return '';
    }
  };

  const getDescription = (): string => {
    if (!dateRange.from || !dateRange.to) return '';
    return `${t('From')} ${dateRange.from.toLocaleDateString()} to ${dateRange.to.toLocaleDateString()}`;
  };

  if (!metric) return null;

  return (
    <Modal open={open && !!metric} onOpenChange={onOpenChange} title={getTitle()} description={getDescription()}>
      <ModalContent>
        {metric === 'count' && (
          <>
            {countData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No pump data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={countData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      label={{ value: t('Date'), position: 'insideBottom', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      tickFormatter={(value) => value.toFixed(0)}
                      label={{ value: t('Count'), angle: -90, position: 'insideLeft', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [`${value}`, t('Pumps')]}
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
          </>
        )}

        {metric === 'duration' && (
          <>
            {durationData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No pump duration data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={durationData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      label={{ value: t('Date'), position: 'insideBottom', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      tickFormatter={(value) => formatMinutes(value as number)}
                      label={{ value: t('Duration'), angle: -90, position: 'insideLeft', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [formatMinutes(value as number), t('Avg Duration')]}
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
          </>
        )}

        {metric === 'amount' && (
          <>
            {amountData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No pump amount data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={amountData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="total"
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      label={{ value: t('Total Amount'), angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="avg"
                      orientation="right"
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      label={{ value: t('Avg Amount'), angle: -90, position: 'insideRight' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        if (name === 'dayTotal') {
                          return [`${value.toFixed(1)}`, 'Total'];
                        }
                        if (name === 'leftTotal') {
                          return [`${value.toFixed(1)}`, t('Left Total')];
                        }
                        if (name === 'rightTotal') {
                          return [`${value.toFixed(1)}`, t('Right Total')];
                        }
                        if (name === 'leftAvg') {
                          return [`${value.toFixed(1)}`, t('Left Avg')];
                        }
                        if (name === 'rightAvg') {
                          return [`${value.toFixed(1)}`, t('Right Avg')];
                        }
                        return [`${value.toFixed(1)}`, name || ''];
                      }}
                      labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />
                    <Line
                      yAxisId="total"
                      type="monotone"
                      dataKey="dayTotal"
                      stroke="#14b8a6"
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6, fill: '#0f766e' }}
                      name="Total"
                    />
                    <Line
                      yAxisId="total"
                      type="monotone"
                      dataKey="leftTotal"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#6366f1' }}
                      activeDot={{ r: 6, fill: '#4f46e5' }}
                      name={t('Left Total')}
                    />
                    <Line
                      yAxisId="total"
                      type="monotone"
                      dataKey="rightTotal"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#ec4899' }}
                      activeDot={{ r: 6, fill: '#db2777' }}
                      name={t('Right Total')}
                    />
                    <Bar
                      yAxisId="avg"
                      dataKey="leftAvg"
                      stackId="avg"
                      fill="#14b8a6"
                      name={t('Left Avg')}
                    />
                    <Bar
                      yAxisId="avg"
                      dataKey="rightAvg"
                      stackId="avg"
                      fill="#f59e0b"
                      name={t('Right Avg')}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'inventory' && enableBreastMilkTracking && (
          <>
            {inventoryData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No pump data available for the selected date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={inventoryData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="consumed"
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      label={{ value: t('Consumed'), angle: -90, position: 'insideLeft' }}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      yAxisId="balance"
                      orientation="right"
                      type="number"
                      domain={['auto', 'auto']}
                      tickMargin={6}
                      label={{ value: t('Stored Balance'), angle: -90, position: 'insideRight' }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        if (name === 'consumed') {
                          return [`${value.toFixed(1)} oz`, t('Consumed')];
                        }
                        if (name === 'storedBalance') {
                          return [`${value.toFixed(1)} oz`, t('Stored Balance')];
                        }
                        return [`${value.toFixed(1)}`, name || ''];
                      }}
                      labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />
                    <Bar
                      yAxisId="consumed"
                      dataKey="consumed"
                      fill="#f59e0b"
                      name={t('Consumed')}
                    />
                    <Line
                      yAxisId="balance"
                      type="monotone"
                      dataKey="storedBalance"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={{ r: 4, fill: '#14b8a6' }}
                      activeDot={{ r: 6, fill: '#0f766e' }}
                      name={t('Stored Balance')}
                    />
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

export default PumpingChartModal;

