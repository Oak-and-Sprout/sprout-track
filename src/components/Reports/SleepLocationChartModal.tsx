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
import { ActivityType, DateRange, LocationStat } from './reports.types';

interface SleepLocationChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'nap' | 'night';
  locations: LocationStat[];
  activities: ActivityType[];
  dateRange: DateRange;
}

// Generate colors for locations
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
 * SleepLocationChartModal Component
 *
 * Displays a stacked bar chart modal showing daily count of sleep sessions
 * by location for the selected sleep type (nap or night).
 */
const SleepLocationChartModal: React.FC<SleepLocationChartModalProps> = ({
  open,
  onOpenChange,
  type,
  locations,
  activities,
  dateRange,
}) => {
  // Calculate daily counts by location
  const chartData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to || !locations.length) {
      return [];
    }

    const startDate = new Date(dateRange.from);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateRange.to);
    endDate.setHours(23, 59, 59, 999);

    // Get all unique location names
    const locationNames = locations.map((loc) => loc.location);
    
    // Track counts by day and location
    const countsByDayAndLocation: Record<string, Record<string, number>> = {};

    activities.forEach((activity) => {
      if ('duration' in activity && 'startTime' in activity && 'type' in activity) {
        const activityType = (activity as any).type;
        const sleepActivity = activity as any;
        const activityLocation = sleepActivity.location || 'Unknown';

        // Only process locations we're tracking
        if (!locationNames.includes(activityLocation)) return;

        const expectedType = type === 'nap' ? 'NAP' : 'NIGHT_SLEEP';
        if (activityType !== expectedType) return;

        const startTime = new Date(sleepActivity.startTime);
        const endTime = sleepActivity.endTime ? new Date(sleepActivity.endTime) : null;

        if (!endTime) return;

        // Calculate overlap with date range
        const overlapStart = Math.max(startTime.getTime(), startDate.getTime());
        const overlapEnd = Math.min(endTime.getTime(), endDate.getTime());

        if (overlapEnd > overlapStart) {
          // For night sleep, use the night grouping logic (12PM day 1 to 11:59AM day 2)
          let dayKey: string;
          if (type === 'night') {
            const startHour = startTime.getHours();
            let nightDate = new Date(startTime);
            if (startHour < 12) {
              // Sleep starting before noon belongs to previous day's night
              nightDate.setDate(nightDate.getDate() - 1);
            }
            dayKey = nightDate.toISOString().split('T')[0];
          } else {
            // For naps, use the start date
            dayKey = startTime.toISOString().split('T')[0];
          }

          // Only count if the day key is within our date range
          const dayDate = new Date(dayKey);
          if (dayDate >= startDate && dayDate <= endDate) {
            if (!countsByDayAndLocation[dayKey]) {
              countsByDayAndLocation[dayKey] = {};
            }
            countsByDayAndLocation[dayKey][activityLocation] = 
              (countsByDayAndLocation[dayKey][activityLocation] || 0) + 1;
          }
        }
      }
    });

    // Convert to array format for recharts
    const sortedDays = Object.keys(countsByDayAndLocation).sort();
    
    return sortedDays.map((dayKey) => {
      const dayData: any = {
        date: dayKey,
        label: new Date(dayKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };

      // Add count for each location
      locationNames.forEach((location) => {
        dayData[location] = countsByDayAndLocation[dayKey][location] || 0;
      });

      return dayData;
    });
  }, [activities, locations, type, dateRange]);

  const title = type === 'nap' ? 'Nap Locations by Day' : 'Night Sleep Locations by Day';
  const description = `Daily count of ${type === 'nap' ? 'nap' : 'night sleep'} sessions by location for the selected date range.`;

  const colors = generateColors(locations.length);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
    >
      <ModalContent>
        {chartData.length === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              No sleep location data available for the selected date range.
            </p>
          </div>
        ) : (
          <div className={cn(growthChartStyles.chartWrapper, "growth-chart-wrapper")}>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 24, left: 8, bottom: 40 }}
              >
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
                  formatter={(value: any, name?: string) => [`${value}`, name || '']}
                  labelFormatter={(label: any) => `Date: ${label}`}
                />
                <Legend />
                {locations.map((location, index) => (
                  <Bar
                    key={location.location}
                    dataKey={location.location}
                    stackId="locations"
                    fill={colors[index]}
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

export default SleepLocationChartModal;

