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

// Number of time slots per day (48 = 30-minute slots)
const TIME_SLOTS = 48;
const SLOT_MINUTES = 24 * 60 / TIME_SLOTS; // 30 minutes per slot
const CHART_HEIGHT = 1500;

// Heatmap color scales - using activity colors as base
const HEATMAP_COLORS = {
  wakeTime: { base: '#fbbf24', light: '#fef3c7' },      // amber - sunrise
  bedtime: { base: '#6366f1', light: '#e0e7ff' },       // indigo - night
  naps: { base: '#6b7280', light: '#f3f4f6' },          // gray - sleep
  allSleep: { base: '#6b7280', light: '#f3f4f6' },      // gray - sleep
  feeds: { base: '#7dd3fc', light: '#e0f2fe' },         // sky - feed
  diapers: { base: '#0d9488', light: '#ccfbf1' },       // teal - diaper
  pumps: { base: '#c084fc', light: '#f3e8ff' },         // purple - pump
};

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
  { id: 'naps', title: 'Nap Windows', icon: <BedDouble className="h-4 w-4" />, description: 'Full nap duration patterns' },
  { id: 'allSleep', title: 'All Sleep', icon: <Moon className="h-4 w-4" />, description: 'All sleep patterns (naps + night)' },
  { id: 'feeds', title: 'Feeding Times', icon: <Icon iconNode={bottleBaby} className="h-4 w-4" />, description: 'When baby is fed' },
  { id: 'diapers', title: 'Diaper Changes', icon: <Icon iconNode={diaper} className="h-4 w-4" />, description: 'When diapers are changed' },
  { id: 'pumps', title: 'Pump Sessions', icon: <LampWallDown className="h-4 w-4" />, description: 'Breast pump timing patterns' },
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

// Interpolate between two colors based on intensity (0-1)
const interpolateColor = (intensity: number, baseColor: string, lightColor: string): string => {
  // Parse hex colors
  const parseHex = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : { r: 0, g: 0, b: 0 };
  };

  const light = parseHex(lightColor);
  const base = parseHex(baseColor);

  const r = Math.round(light.r + (base.r - light.r) * intensity);
  const g = Math.round(light.g + (base.g - light.g) * intensity);
  const b = Math.round(light.b + (base.b - light.b) * intensity);

  return `rgb(${r}, ${g}, ${b})`;
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

    // Initialize slot counts for each heatmap type
    const slotCounts: Record<HeatmapType, number[]> = {
      wakeTime: new Array(TIME_SLOTS).fill(0),
      bedtime: new Array(TIME_SLOTS).fill(0),
      naps: new Array(TIME_SLOTS).fill(0),
      allSleep: new Array(TIME_SLOTS).fill(0),
      feeds: new Array(TIME_SLOTS).fill(0),
      diapers: new Array(TIME_SLOTS).fill(0),
      pumps: new Array(TIME_SLOTS).fill(0),
    };

    const getHours = (d: Date) => d.getHours() + d.getMinutes() / 60;

    // Process each activity
    activities.forEach((activity) => {
      const timeString = getActivityTime(activity);
      const base = new Date(timeString);
      if (Number.isNaN(base.getTime())) return;

      // Sleep activities
      if ('duration' in activity && 'startTime' in activity && 'type' in activity && 
          (activity.type === 'NAP' || activity.type === 'NIGHT_SLEEP')) {
        const sleepActivity = activity as SleepActivity;
        const start = sleepActivity.startTime ? new Date(sleepActivity.startTime) : base;
        const end = sleepActivity.endTime ? new Date(sleepActivity.endTime) : null;

        const startHours = getHours(start);
        const endHours = end ? getHours(end) : startHours;

        if (sleepActivity.type === 'NIGHT_SLEEP') {
          // Bedtime - just the start time (±5 min window)
          const bedtimeStart = Math.max(0, startHours - 5/60);
          const bedtimeEnd = Math.min(24, startHours + 5/60);
          for (let slot = timeToSlot(bedtimeStart); slot <= timeToSlot(bedtimeEnd); slot++) {
            slotCounts.bedtime[slot]++;
          }

          // Wake time - just the end time (±5 min window) if available
          if (end) {
            const wakeStart = Math.max(0, endHours - 5/60);
            const wakeEnd = Math.min(24, endHours + 5/60);
            for (let slot = timeToSlot(wakeStart); slot <= timeToSlot(wakeEnd); slot++) {
              slotCounts.wakeTime[slot]++;
            }
          }

          // All sleep - full duration
          if (end) {
            // Handle overnight sleep by checking if it spans midnight
            if (endHours < startHours) {
              // From start to midnight
              for (let slot = timeToSlot(startHours); slot < TIME_SLOTS; slot++) {
                slotCounts.allSleep[slot]++;
              }
              // From midnight to end
              for (let slot = 0; slot <= timeToSlot(endHours); slot++) {
                slotCounts.allSleep[slot]++;
              }
            } else {
              for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
                slotCounts.allSleep[slot]++;
              }
            }
          }
        } else if (sleepActivity.type === 'NAP') {
          // Nap windows - full duration
          if (end) {
            for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
              slotCounts.naps[slot]++;
              slotCounts.allSleep[slot]++;
            }
          } else {
            // No end time, use ±5 min window
            const napStart = Math.max(0, startHours - 5/60);
            const napEnd = Math.min(24, startHours + 5/60);
            for (let slot = timeToSlot(napStart); slot <= timeToSlot(napEnd); slot++) {
              slotCounts.naps[slot]++;
              slotCounts.allSleep[slot]++;
            }
          }
        }
      }

      // Feed activities
      if ('amount' in activity && 'type' in activity) {
        const feedActivity = activity as FeedActivity;
        const feedTime = new Date(feedActivity.time);
        const feedHours = getHours(feedTime);
        
        // ±5 min window
        const feedStart = Math.max(0, feedHours - 5/60);
        const feedEnd = Math.min(24, feedHours + 5/60);
        for (let slot = timeToSlot(feedStart); slot <= timeToSlot(feedEnd); slot++) {
          slotCounts.feeds[slot]++;
        }
      }

      // Diaper activities
      if ('condition' in activity && 'type' in activity) {
        const diaperActivity = activity as DiaperActivity;
        const diaperTime = new Date(diaperActivity.time);
        const diaperHours = getHours(diaperTime);
        
        // ±5 min window
        const diaperStart = Math.max(0, diaperHours - 5/60);
        const diaperEnd = Math.min(24, diaperHours + 5/60);
        for (let slot = timeToSlot(diaperStart); slot <= timeToSlot(diaperEnd); slot++) {
          slotCounts.diapers[slot]++;
        }
      }

      // Pump activities
      if ('leftAmount' in activity || 'rightAmount' in activity) {
        const pumpActivity = activity as PumpActivity;
        const start = pumpActivity.startTime ? new Date(pumpActivity.startTime) : base;
        const end = pumpActivity.endTime ? new Date(pumpActivity.endTime) : null;
        
        const startHours = getHours(start);
        
        if (end) {
          const endHours = getHours(end);
          for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
            slotCounts.pumps[slot]++;
          }
        } else {
          // ±5 min window
          const pumpStart = Math.max(0, startHours - 5/60);
          const pumpEnd = Math.min(24, startHours + 5/60);
          for (let slot = timeToSlot(pumpStart); slot <= timeToSlot(pumpEnd); slot++) {
            slotCounts.pumps[slot]++;
          }
        }
      }
    });

    // Normalize counts to intensities (0-1)
    const normalizedData: Record<HeatmapType, { slots: number[]; maxCount: number }> = {} as any;
    
    (Object.keys(slotCounts) as HeatmapType[]).forEach((type) => {
      const counts = slotCounts[type];
      const maxCount = Math.max(...counts, 1); // Avoid division by zero
      normalizedData[type] = {
        slots: counts.map(count => count / maxCount),
        maxCount,
      };
    });

    return normalizedData;
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
                              opacity: intensity > 0 ? 0.9 : 0,
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

                {/* Description */}
                <div className="mt-2 text-center">
                  <p className="text-[9px] text-gray-400 leading-tight">
                    {config.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 px-4 py-2 border-t border-gray-200 heatmap-legend">
        <div className="flex items-center justify-center gap-6 text-xs text-gray-500">
          <span>Frequency:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#f3f4f6' }} />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#9ca3af' }} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 rounded" style={{ backgroundColor: '#4b5563' }} />
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapsTab;
