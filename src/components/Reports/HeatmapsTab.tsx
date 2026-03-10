'use client';

import React, { useMemo } from 'react';
import { Grid3X3, Loader2, Moon, Sun, BedDouble } from 'lucide-react';
import { Icon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';
import { LampWallDown } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { styles } from './reports.styles';
import { HeatmapsTabProps } from './reports.types';
import { useLocalization } from '@/src/context/localization';

import {
  TIME_SLOTS,
  SLOT_MINUTES,
  HEATMAP_COLORS,
  getSlotOpacity,
  interpolateColor,
  buildHeatmapDataForActivities,
  HeatmapType,
} from '@/src/components/Timeline/TimelineV2/timeline-heatmap.utils';

const CHART_HEIGHT = 1500;
const LANE_WIDTH = 20;
const LANE_GAP = 2;

const DISPLAYED_HEATMAP_TYPES: HeatmapType[] = [
  'wakeTime', 'bedtime', 'naps', 'allSleep', 'feeds', 'diapers', 'pumps',
];

const HEATMAP_ICONS: Record<HeatmapType, { icon: any; isLabIcon?: boolean }> = {
  wakeTime: { icon: Sun },
  bedtime: { icon: Moon },
  naps: { icon: BedDouble },
  allSleep: { icon: Moon },
  feeds: { icon: bottleBaby, isLabIcon: true },
  diapers: { icon: diaper, isLabIcon: true },
  pumps: { icon: LampWallDown },
};

const HEATMAP_LABELS: Record<HeatmapType, string> = {
  wakeTime: 'Wake',
  bedtime: 'Bed',
  naps: 'Naps',
  allSleep: 'Sleep',
  feeds: 'Feeds',
  diapers: 'Diapers',
  pumps: 'Pumps',
};

// Format hour for chart labels (6a, 7a, 12p, 1p, etc.)
const formatHourLabel = (hour: number): string => {
  if (hour === 0 || hour === 24) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
};

const HeatmapsTab: React.FC<HeatmapsTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  const { t } = useLocalization();

  const heatmapData = useMemo(() => {
    if (!activities.length || !dateRange.from || !dateRange.to) {
      return null;
    }
    return buildHeatmapDataForActivities(activities as any);
  }, [activities, dateRange]);

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
          {t('Select a date range to view heatmaps.')}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>
          {t('Loading heatmap data...')}
        </p>
      </div>
    );
  }

  if (!heatmapData || !activities.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <Grid3X3 className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          {t('No activities recorded for this date range.')}
        </p>
      </div>
    );
  }

  const totalLanesWidth = DISPLAYED_HEATMAP_TYPES.length * (LANE_WIDTH + LANE_GAP);
  const chartWidth = totalLanesWidth + 28; // 28px for hour labels

  return (
    <div className="w-full flex flex-col activity-chart-container" style={{ height: '100%' }}>
      {/* Legend */}
      <div className="heatmap-legend flex flex-wrap items-center justify-center gap-3 py-2 bg-white sticky top-0 z-10 activity-chart-day-header">
        {DISPLAYED_HEATMAP_TYPES.map((type) => {
          const colors = HEATMAP_COLORS[type];
          const iconConfig = HEATMAP_ICONS[type];
          return (
            <div key={type} className="flex items-center gap-1">
              {iconConfig.isLabIcon ? (
                <Icon iconNode={iconConfig.icon} className="h-3 w-3" style={{ color: colors.base }} />
              ) : (
                <iconConfig.icon className="h-3 w-3" style={{ color: colors.base }} />
              )}
              <span className="text-[10px] text-gray-500">{t(HEATMAP_LABELS[type])}</span>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div
        className="relative w-full overflow-auto pb-4 activity-chart-scroll flex justify-center"
        style={{
          height: 'calc(100vh - 280px)',
          minHeight: 500,
        }}
      >
        <div
          className="flex-shrink-0 flex flex-col items-stretch"
          style={{ width: chartWidth }}
        >
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

            {/* Heatmap lanes */}
            <div className="absolute inset-0" style={{ left: 26, right: 2 }}>
              {DISPLAYED_HEATMAP_TYPES.map((type, laneIndex) => {
                const data = heatmapData[type];
                const colors = HEATMAP_COLORS[type];
                const laneLeft = laneIndex * (LANE_WIDTH + LANE_GAP);

                if (!data || data.maxCount === 0) return null;

                return (
                  <div
                    key={type}
                    className="absolute top-0 bottom-0"
                    style={{ left: laneLeft, width: LANE_WIDTH }}
                  >
                    {data.slots.map((intensity, slotIndex) => {
                      const slotHour = (slotIndex * SLOT_MINUTES) / 60;
                      const topPercent = ((24 - slotHour - SLOT_MINUTES / 60) / 24) * 100;
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
                          title={intensity > 0 ? `${HEATMAP_LABELS[type]}: ${Math.round(intensity * data.maxCount)}` : undefined}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* No data overlay */}
            {DISPLAYED_HEATMAP_TYPES.every((type) => heatmapData[type].maxCount === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-gray-400 text-center px-2">
                  {t('No data')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeatmapsTab;
