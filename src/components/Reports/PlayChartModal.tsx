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
import { ActivityType, DateRange } from './reports.types';
import { useLocalization } from '@/src/context/localization';

export type PlayChartMetric = 'totalByDay' | 'avgDurationByType' | 'dailyDuration';

interface PlayChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: PlayChartMetric | null;
  activities: ActivityType[];
  dateRange: DateRange;
}

const PLAY_TYPES = ['TUMMY_TIME', 'INDOOR_PLAY', 'OUTDOOR_PLAY', 'WALK', 'CUSTOM'];
const PLAY_TYPE_COLORS: Record<string, string> = {
  TUMMY_TIME: '#F3C4A2',
  INDOOR_PLAY: '#6366f1',
  OUTDOOR_PLAY: '#14b8a6',
  WALK: '#f59e0b',
  CUSTOM: '#8b5cf6',
};

function isPlayActivity(activity: any): boolean {
  return 'activities' in activity && 'type' in activity &&
    PLAY_TYPES.includes(activity.type);
}

/**
 * PlayChartModal Component
 *
 * Displays charts for play/activity statistics.
 */
const PlayChartModal: React.FC<PlayChartModalProps> = ({
  open,
  onOpenChange,
  metric,
  activities,
  dateRange,
}) => {
  const { t } = useLocalization();

  const playTypeDisplayNames: Record<string, string> = {
    TUMMY_TIME: t('Tummy Time'),
    INDOOR_PLAY: t('Indoor Play'),
    OUTDOOR_PLAY: t('Outdoor Play'),
    WALK: t('Walk'),
    CUSTOM: t('Custom'),
  };

  // Daily session counts by type (stacked bar)
  const dailySessionData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'totalByDay') {
      return { chartData: [], typeNames: [] };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const activeTypes = new Set<string>();
    const byDay: Record<string, Record<string, number>> = {};

    activities.forEach((activity) => {
      if (!isPlayActivity(activity)) return;
      const a = activity as any;
      const time = new Date(a.startTime);
      if (time < startDate || time > endDate) return;
      const dayKey = time.toLocaleDateString('en-CA');
      const type = a.type;
      activeTypes.add(type);
      if (!byDay[dayKey]) byDay[dayKey] = {};
      byDay[dayKey][type] = (byDay[dayKey][type] || 0) + 1;
    });

    const typeNames = Array.from(activeTypes);
    const data: Record<string, any>[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayKey = current.toLocaleDateString('en-CA');
      const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const row: Record<string, any> = { date: dayKey, label };
      for (const type of typeNames) {
        row[type] = byDay[dayKey]?.[type] || 0;
      }
      data.push(row);
      current.setDate(current.getDate() + 1);
    }

    return { chartData: data, typeNames };
  }, [activities, dateRange, metric]);

  // Average duration by type (single bar per type)
  const avgDurationData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'avgDurationByType') {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const byType: Record<string, { count: number; totalMinutes: number }> = {};

    activities.forEach((activity) => {
      if (!isPlayActivity(activity)) return;
      const a = activity as any;
      const time = new Date(a.startTime);
      if (time < startDate || time > endDate) return;
      const type = a.type;
      if (!byType[type]) byType[type] = { count: 0, totalMinutes: 0 };
      byType[type].count++;
      byType[type].totalMinutes += a.duration || 0;
    });

    return Object.entries(byType)
      .map(([type, data]) => ({
        type,
        name: playTypeDisplayNames[type] || type,
        avgMinutes: data.count > 0 ? Math.round((data.totalMinutes / data.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avgMinutes - a.avgMinutes);
  }, [activities, dateRange, metric]);

  // Daily duration by type (stacked bar)
  const dailyDurationData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || metric !== 'dailyDuration') {
      return { chartData: [], typeNames: [] };
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    const activeTypes = new Set<string>();
    const byDay: Record<string, Record<string, number>> = {};

    activities.forEach((activity) => {
      if (!isPlayActivity(activity)) return;
      const a = activity as any;
      const time = new Date(a.startTime);
      if (time < startDate || time > endDate) return;
      const dayKey = time.toLocaleDateString('en-CA');
      const type = a.type;
      activeTypes.add(type);
      if (!byDay[dayKey]) byDay[dayKey] = {};
      byDay[dayKey][type] = (byDay[dayKey][type] || 0) + (a.duration || 0);
    });

    const typeNames = Array.from(activeTypes);
    const data: Record<string, any>[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayKey = current.toLocaleDateString('en-CA');
      const label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const row: Record<string, any> = { date: dayKey, label };
      for (const type of typeNames) {
        row[type] = byDay[dayKey]?.[type] || 0;
      }
      data.push(row);
      current.setDate(current.getDate() + 1);
    }

    return { chartData: data, typeNames };
  }, [activities, dateRange, metric]);

  const getTitle = (): string => {
    switch (metric) {
      case 'totalByDay':
        return t('Daily Sessions by Type');
      case 'avgDurationByType':
        return t('Average Duration by Type');
      case 'dailyDuration':
        return t('Daily Duration by Type');
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
        {metric === 'totalByDay' && (
          <>
            {dailySessionData.chartData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No activities recorded in this date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailySessionData.chartData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      allowDecimals={false}
                      label={{ value: t('Sessions'), angle: -90, position: 'insideLeft', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                    />
                    <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: 4 }} />
                    {dailySessionData.typeNames.map((type) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        stackId="sessions"
                        fill={PLAY_TYPE_COLORS[type] || '#8b5cf6'}
                        name={playTypeDisplayNames[type] || type}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'avgDurationByType' && (
          <>
            {avgDurationData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No activities recorded in this date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={avgDurationData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="name"
                      tickMargin={6}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      label={{ value: t('Avg Duration (min)'), angle: -90, position: 'insideLeft', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any) => [`${value} ${t('min')}`, t('Avg Duration')]}
                    />
                    <Bar dataKey="avgMinutes" fill="#F3C4A2" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {metric === 'dailyDuration' && (
          <>
            {dailyDurationData.chartData.length === 0 ? (
              <div className={cn(styles.emptyContainer, 'reports-empty-container')}>
                <p className={cn(styles.emptyText, 'reports-empty-text')}>
                  {t('No activities recorded in this date range.')}
                </p>
              </div>
            ) : (
              <div className={cn(growthChartStyles.chartWrapper, 'growth-chart-wrapper')}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyDurationData.chartData} margin={{ top: 20, right: 24, left: 8, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="growth-chart-grid" />
                    <XAxis
                      dataKey="label"
                      tickMargin={6}
                      className="growth-chart-axis"
                    />
                    <YAxis
                      type="number"
                      domain={[0, 'auto']}
                      tickMargin={6}
                      label={{ value: t('Duration (min)'), angle: -90, position: 'insideLeft', offset: -10 }}
                      className="growth-chart-axis"
                    />
                    <RechartsTooltip
                      formatter={(value: any, name?: string) => {
                        const displayName = name ? (playTypeDisplayNames[name] || name) : '';
                        return [`${value} ${t('min')}`, displayName];
                      }}
                      labelFormatter={(label: any) => `${t('Date:')} ${label}`}
                    />
                    <Legend
                      verticalAlign="top"
                      wrapperStyle={{ paddingBottom: 4 }}
                      formatter={(value: string) => playTypeDisplayNames[value] || value}
                    />
                    {dailyDurationData.typeNames.map((type) => (
                      <Bar
                        key={type}
                        dataKey={type}
                        stackId="duration"
                        fill={PLAY_TYPE_COLORS[type] || '#8b5cf6'}
                        name={type}
                      />
                    ))}
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

export default PlayChartModal;
