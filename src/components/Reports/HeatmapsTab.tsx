'use client';

import React, { useMemo } from 'react';
import { Grid3X3, Loader2, Moon, Sun, BedDouble, Baby } from 'lucide-react';
import { Icon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { LampWallDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './reports.styles';
import { HeatmapsTabProps, ActivityType, SleepActivity, FeedActivity, DiaperActivity, PumpActivity } from './reports.types';
import { getActivityTime } from '@/src/components/Timeline/utils';
import {
  TIME_SLOTS,
  SLOT_MINUTES,
  HEATMAP_COLORS,
  getSlotOpacity,
  interpolateColor,
  buildHeatmapDataForActivities,
} from '@/src/components/Timeline/TimelineV2/timeline-heatmap.utils';
const CHART_HEIGHT = 1500;

type HeatmapType = 'wakeTime' | 'bedtime' | 'naps' | 'allSleep' | 'feeds' | 'diapers' | 'pumps';

interface HeatmapConfig {
  id: HeatmapType;
  title: string;
  icon: React.ReactNode;
  description: string;
}

const HEATMAP_CONFIGS: HeatmapConfig[] = [
  { id: 'wakeTime', title: 'Wake Time', icon: <Sun className="h-4 w-4" />, description: 'When baby wakes from night sleep' },
  { id: 'bedtime', title: 'Bedtime', icon: <Moon className="h-4 w-4" />, description: 'When baby goes to sleep at night' },
  { id: 'naps', title: 'Naps', icon: <BedDouble className="h-4 w-4" />, description: 'Full nap duration patterns' },
  { id: 'allSleep', title: 'Night Sleep', icon: <Moon className="h-4 w-4" />, description: 'All sleep patterns (naps + night)' },
  { id: 'feeds', title: 'Feeds', icon: <Icon iconNode={bottleBaby} className="h-4 w-4" />, description: 'When baby is fed' },
  { id: 'diapers', title: 'Diapers', icon: <Icon iconNode={diaper} className="h-4 w-4" />, description: 'When diapers are changed' },
  { id: 'pumps', title: 'Pumps', icon: <LampWallDown className="h-4 w-4" />, description: 'Breast pump timing patterns' },
];

// Format hour for chart labels (6a, 7a, 12p, 1p, etc.)
const formatHourLabel = (hour: number): string => {
  if (hour === 0 || hour === 24) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
};

// Convert time to slot index
const timeToSlot = (hours: number): number => {
  const slot = Math.floor((hours * 60) / SLOT_MINUTES);
  return Math.max(0, Math.min(TIME_SLOTS - 1, slot));
};

const HeatmapsTab: React.FC<HeatmapsTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  // Calculate heatmap data for each type
  const heatmapData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to) {
      return null;
    }

    return buildHeatmapDataForActivities(activities as any);
  }, [activities, dateRange]);

  // Generate hour lines for the chart
  const hourLines = useMemo(() => {
    const lines: number[] = [];
    for (let h = 0; h <= 24; h++) {
      lines.push(h);
    }
    return lines;
  }, []);

  if (!dateRange.from || !dateRange.to) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <Grid3X3 className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          Select a date range to view heatmaps.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>
          Loading heatmap data...
        </p>
      </div>
    );
  }

  if (!heatmapData || !activities.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <Grid3X3 className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          No activities recorded for this date range.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col activity-chart-container" style={{ height: '100%' }}>
      <div 
        className="relative w-full overflow-auto pb-4 px-2 activity-chart-scroll"
        style={{ 
          height: 'calc(100vh - 240px)',
          minHeight: 500,
        }}
      >
        <div className="inline-flex flex-row gap-6 items-start">
          {HEATMAP_CONFIGS.map((config) => {
            const data = heatmapData[config.id];
            const hasData = data.maxCount > 0;
            const colors = HEATMAP_COLORS[config.id];

            return (
              <div
                key={config.id}
                className="flex-shrink-0 flex flex-col items-stretch"
                style={{ width: 90, minWidth: 90 }}
              >
                {/* Header */}
                <div className="mb-2 text-center sticky top-0 bg-white z-10 py-1 activity-chart-day-header">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-gray-600">{config.icon}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600 activity-chart-day-label">
                    {config.title}
                  </span>
                  {hasData && (
                    <div className="text-[9px] text-gray-400 mt-0.5">
                      max: {data.maxCount}
                    </div>
                  )}
                </div>

                {/* Chart area */}
                <div 
                  className="relative border-2 border-gray-300 rounded bg-gray-50 activity-chart-day-wrapper"
                  style={{ height: CHART_HEIGHT }}
                >
                  {/* Hour grid lines with labels */}
                  <div className="absolute inset-0 pointer-events-none">
                    {hourLines.map((hour) => {
                      const topPercent = ((24 - hour) / 24) * 100;
                      const showLabel = hour % 3 === 0 || hour === 0 || hour === 24;
                      
                      return (
                        <div key={hour}>
                          <div
                            className="absolute left-0 right-0 activity-chart-grid-hour"
                            style={{
                              top: `${topPercent}%`,
                              height: 1,
                              backgroundColor: '#d1d5db',
                            }}
                          />
                          {showLabel && (
                            <span
                              className="absolute text-[9px] text-gray-400 activity-chart-hour-label"
                              style={{
                                top: `${topPercent}%`,
                                left: 2,
                                transform: 'translateY(-50%)',
                              }}
                            >
                              {formatHourLabel(hour)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Heatmap gradient */}
                  {hasData && (
                    <div className="absolute inset-0" style={{ left: 22, right: 4 }}>
                      {data.slots.map((intensity, slotIndex) => {
                        // Position: slot 0 = bottom (0:00), slot 47 = top (23:30)
                        const slotHour = (slotIndex * SLOT_MINUTES) / 60;
                        const topPercent = ((24 - slotHour - SLOT_MINUTES/60) / 24) * 100;
                        const heightPercent = (SLOT_MINUTES / 60 / 24) * 100;
                        
                        const backgroundColor = intensity > 0 
                          ? interpolateColor(intensity, colors.base, colors.light)
                          : 'transparent';

                        return (
                          <div
                            key={slotIndex}
                            className="absolute left-0 right-0 heatmap-slot"
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                              backgroundColor,
                              opacity: getSlotOpacity(intensity),
                            }}
                            title={intensity > 0 ? `${Math.round(intensity * data.maxCount)} occurrences` : undefined}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* No data overlay */}
                  {!hasData && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-gray-400 text-center px-2">
                        No data
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HeatmapsTab;
