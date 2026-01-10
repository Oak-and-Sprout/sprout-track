'use client';

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { Settings } from '@prisma/client';
import { cn } from '@/src/lib/utils';
import { styles, activityChartStyles } from './reports.styles';
import { ActivityTabProps, ActivityType } from './reports.types';
import { getActivityDetails } from '@/src/components/Timeline/utils';
import { ActivityType as TimelineActivityType } from '@/src/components/Timeline/types';
import { useLocalization } from '@/src/context/localization';

// Local helper to get activity time that works with reports ActivityType
const getActivityTimeLocal = (activity: ActivityType): string => {
  if ('time' in activity && activity.time) {
    return activity.time;
  }
  if ('startTime' in activity && activity.startTime) {
    if ('duration' in activity && 'endTime' in activity && activity.endTime) {
      return String(activity.endTime);
    }
    return String(activity.startTime);
  }
  if ('date' in activity && activity.date) {
    return String(activity.date);
  }
  return new Date().toISOString();
};

// Activity type order for consistent lane stacking:
// Sleep, Feeds, Pumps, Diapers, Bath, Medicine, Measurement, Milestone, Notes
const getActivityTypeOrder = (activity: ActivityType): number => {
  // Sleep
  if ('duration' in activity && 'startTime' in activity && !('leftAmount' in activity)) {
    return 0;
  }
  // Feed
  if ('amount' in activity && 'type' in activity) {
    return 1;
  }
  // Pump
  if ('leftAmount' in activity || 'rightAmount' in activity) {
    return 2;
  }
  // Diaper
  if ('condition' in activity) {
    return 3;
  }
  // Bath
  if ('soapUsed' in activity) {
    return 4;
  }
  // Medicine
  if ('doseAmount' in activity && 'medicineId' in activity) {
    return 5;
  }
  // Measurement
  if ('value' in activity && 'unit' in activity) {
    return 6;
  }
  // Milestone
  if ('title' in activity && 'category' in activity) {
    return 7;
  }
  // Note
  if ('content' in activity) {
    return 8;
  }
  return 9; // default
};

// Color mapping for activity types - matches TimelineV2 colors
const getActivityColor = (activity: ActivityType): string => {
  // Medicine
  if ('doseAmount' in activity && 'medicineId' in activity) {
    return '#43B755'; // green
  }
  // Pump
  if ('leftAmount' in activity || 'rightAmount' in activity) {
    return '#c084fc'; // purple-400
  }
  if ('type' in activity) {
    // Sleep
    if ('duration' in activity) {
      return '#6b7280'; // gray-500
    }
    // Feed
    if ('amount' in activity) {
      return '#7dd3fc'; // sky-300
    }
    // Diaper
    if ('condition' in activity) {
      return '#0d9488'; // teal-600
    }
  }
  // Note
  if ('content' in activity) {
    return '#fef08a'; // yellow-200
  }
  // Bath
  if ('soapUsed' in activity) {
    return '#fb923c'; // orange-400
  }
  // Milestone
  if ('title' in activity && 'category' in activity) {
    return '#4875EC'; // blue
  }
  // Measurement
  if ('value' in activity && 'unit' in activity) {
    return '#EA6A5E'; // red
  }
  return '#9ca3af'; // gray-400 default
};

interface NormalizedActivity {
  id: string;
  activity: ActivityType;
  startHour: number; // 0-24
  endHour: number; // 0-24
  color: string;
  lane: number; // horizontal lane for stacking overlapping activities
  typeOrder: number; // for consistent stacking order
  isOvernightContinuation?: boolean;
}

interface DayData {
  date: Date;
  label: string;
  shortLabel: string;
  activities: NormalizedActivity[];
  maxLanes: number;
}

const CHART_HEIGHT = 1500; // 3x taller, scrollable
const BAR_WIDTH = 6; // pixels (50% wider)
const BAR_GAP = 3; // pixels between bars
const MIN_COLUMN_WIDTH = 75; // minimum column width (50% wider)
const MIN_BAR_HEIGHT_PERCENT = 0.8; // Minimum height for visibility

// Assign lanes to activities based on type order first, then overlap
const assignLanes = (activities: Omit<NormalizedActivity, 'lane'>[]): { activities: NormalizedActivity[]; maxLanes: number } => {
  if (activities.length === 0) return { activities: [], maxLanes: 0 };

  // Sort by type order first (for consistent left-to-right ordering), then by start time
  const sorted = [...activities].sort((a, b) => {
    if (a.typeOrder !== b.typeOrder) {
      return a.typeOrder - b.typeOrder;
    }
    return a.startHour - b.startHour;
  });

  // Track which activities are in each lane (by their end times and type)
  const lanes: { endTimes: number[]; typeOrder: number }[] = [];

  const result: NormalizedActivity[] = sorted.map(act => {
    // Find the first lane where this activity doesn't overlap
    let assignedLane = -1;
    
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx];
      // Check if this activity overlaps with any activity in this lane
      let hasOverlap = false;
      
      for (const endTime of lane.endTimes) {
        if (act.startHour < endTime) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        assignedLane = laneIdx;
        break;
      }
    }

    // If no free lane found, create a new one
    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push({ endTimes: [], typeOrder: act.typeOrder });
    }

    // Add this activity's end time to the lane
    lanes[assignedLane].endTimes.push(act.endHour);

    return { ...act, lane: assignedLane };
  });

  return { activities: result, maxLanes: lanes.length };
};

// Format hour for chart labels (6a, 7a, 12p, 1p, etc.)
const formatHourLabel = (hour: number): string => {
  if (hour === 0 || hour === 24) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
};

const ActivityTab: React.FC<ActivityTabProps> = ({
  activities,
  dateRange,
  isLoading
}) => {
  const { t } = useLocalization();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hoveredActivity, setHoveredActivity] = useState<NormalizedActivity | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch settings for consistent formatting with Timeline / GrowthChart
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const authToken = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
        const response = await fetch('/api/settings', {
          headers: {
            'Authorization': authToken ? `Bearer ${authToken}` : '',
          },
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSettings(data.data);
          }
        }
      } catch {
        // Non-fatal for this view
      }
    };

    fetchSettings();
  }, []);

  // Group activities by day and normalize time ranges
  // Handle overnight sleep by splitting across days
  const groupedByDay = useMemo((): DayData[] => {
    if (!dateRange.from || !dateRange.to || !activities.length) return [];

    const byDay = new Map<string, { date: Date; items: Omit<NormalizedActivity, 'lane'>[] }>();

    const getOrCreateDay = (date: Date) => {
      const key = date.toDateString();
      if (!byDay.has(key)) {
        byDay.set(key, { date: new Date(date), items: [] });
      }
      return byDay.get(key)!;
    };

    const getHours = (d: Date) => d.getHours() + d.getMinutes() / 60;

    activities.forEach((activity) => {
      const timeString = getActivityTimeLocal(activity);
      const base = new Date(timeString);
      if (Number.isNaN(base.getTime())) return;

      const typeOrder = getActivityTypeOrder(activity);

      // Check if this is a sleep/pump activity with duration that might span midnight
      if ('duration' in activity && 'startTime' in activity) {
        const start = activity.startTime ? new Date(activity.startTime) : base;
        const end = activity.endTime ? new Date(activity.endTime) : start;
        
        const startDateStr = start.toDateString();
        const endDateStr = end.toDateString();
        
        const color = getActivityColor(activity);

        // Check if it spans midnight (different days)
        if (startDateStr !== endDateStr) {
          // Part 1: From start time to midnight on start day
          const startDay = getOrCreateDay(start);
          if (start >= dateRange.from! && start <= dateRange.to!) {
            startDay.items.push({
              id: `${activity.id}-start`,
              activity,
              startHour: getHours(start),
              endHour: 24, // midnight
              color,
              typeOrder,
            });
          }

          // Part 2: From midnight to end time on end day
          const endDay = getOrCreateDay(end);
          if (end >= dateRange.from! && end <= dateRange.to!) {
            endDay.items.push({
              id: `${activity.id}-end`,
              activity,
              startHour: 0, // midnight
              endHour: getHours(end),
              color,
              typeOrder,
              isOvernightContinuation: true,
            });
          }
        } else {
          // Same day activity
          if (start >= dateRange.from! && start <= dateRange.to!) {
            const day = getOrCreateDay(start);
            let startHour = getHours(start);
            let endHour = getHours(end);

            if (endHour <= startHour) {
              const dur = typeof activity.duration === 'number' ? activity.duration / 60 : 0.5;
              endHour = Math.min(24, startHour + dur);
            }

            day.items.push({
              id: activity.id,
              activity,
              startHour,
              endHour,
              color,
              typeOrder,
            });
          }
        }
      } else {
        // Non-duration activities: ±5 minute bubble
        if (base < dateRange.from! || base > dateRange.to!) return;

        const day = getOrCreateDay(base);
        const centerHour = getHours(base);
        const startHour = Math.max(0, centerHour - 5 / 60);
        const endHour = Math.min(24, centerHour + 5 / 60);

        day.items.push({
          id: activity.id,
          activity,
          startHour,
          endHour,
          color: getActivityColor(activity),
          typeOrder,
        });
      }
    });

    // Sort days DESC (most recent first/left) and filter out empty days and days outside range
    const days = Array.from(byDay.values())
      .filter(day => {
        // Must have at least one activity
        if (day.items.length === 0) return false;
        
        // Day must be within the selected date range
        const dayStart = new Date(day.date);
        dayStart.setHours(0, 0, 0, 0);
        
        const rangeStart = new Date(dateRange.from!);
        rangeStart.setHours(0, 0, 0, 0);
        const rangeEnd = new Date(dateRange.to!);
        rangeEnd.setHours(23, 59, 59, 999);
        
        return dayStart >= rangeStart && dayStart <= rangeEnd;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return days.map(day => {
      // Assign lanes based on type order and overlapping time ranges
      const { activities: activitiesWithLanes, maxLanes } = assignLanes(day.items);

      return {
        date: day.date,
        label: day.date.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        shortLabel: day.date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        activities: activitiesWithLanes,
        maxLanes,
      };
    });
  }, [activities, dateRange]);

  // Handle hover events - tooltip follows cursor exactly
  const handleMouseEnter = useCallback((e: React.MouseEvent, act: NormalizedActivity) => {
    setHoveredActivity(act);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredActivity) {
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }
  }, [hoveredActivity]);

  const handleMouseLeave = useCallback(() => {
    setHoveredActivity(null);
    setTooltipPos(null);
  }, []);

  // Format time for display
  const formatTime = useCallback((h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${mins.toString().padStart(2, '0')} ${period}`;
  }, []);

  // Generate hour grid lines (every hour from 0-24)
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
        <Activity className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          {t('Select a date range to view activity charts.')}
        </p>
      </div>
    );
  }

  if (isLoading && !groupedByDay.length) {
    return (
      <div className={cn(styles.loadingContainer, "reports-loading-container")}>
        <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        <p className={cn(styles.loadingText, "reports-loading-text")}>
          {t('Loading activity data...')}
        </p>
      </div>
    );
  }

  if (!groupedByDay.length) {
    return (
      <div className={cn(styles.emptyContainer, "reports-empty-container")}>
        <Activity className={cn(styles.placeholderIcon, "reports-placeholder-icon")} />
        <p className={cn(styles.emptyText, "reports-empty-text")}>
          {t('No activities recorded for this date range.')}
        </p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={cn(activityChartStyles.container, "activity-chart-container")}
      style={{ height: '100%' }}
    >
      <div 
        className={cn(activityChartStyles.scrollArea, "activity-chart-scroll")}
        style={{ 
          overflow: 'auto', 
          height: 'calc(100vh - 240px)',
          minHeight: 500,
        }}
      >
        <div className={cn(activityChartStyles.daysRow, "activity-chart-days-row")}>
          {groupedByDay.map((day) => {
            // Calculate column width based on max lanes needed for this day (50% wider)
            const columnWidth = Math.max(MIN_COLUMN_WIDTH, day.maxLanes * (BAR_WIDTH + BAR_GAP) + 24);

            return (
              <div
                key={day.label}
                className={cn(activityChartStyles.dayColumn, "activity-chart-day-column")}
                style={{ width: columnWidth, minWidth: columnWidth }}
              >
                {/* Day header */}
                <div className={cn(activityChartStyles.dayHeader, "activity-chart-day-header")}>
                  <span className={cn(activityChartStyles.dayLabel, "activity-chart-day-label")}>
                    {day.shortLabel}
                  </span>
                </div>

                {/* Chart area */}
                <div 
                  className={cn(activityChartStyles.dayChartWrapper, "activity-chart-day-wrapper")}
                  style={{ height: CHART_HEIGHT }}
                >
                  {/* Hour grid lines with labels */}
                  <div className="absolute inset-0 pointer-events-none">
                    {hourLines.map((hour) => {
                      // Position from top: 0 at hour 24, 100% at hour 0
                      const topPercent = ((24 - hour) / 24) * 100;
                      // Only show labels for certain hours to avoid clutter
                      const showLabel = hour % 3 === 0 || hour === 0 || hour === 24;
                      
                      return (
                        <div key={hour}>
                          {/* Grid line */}
                          <div
                            className="absolute left-0 right-0 activity-chart-grid-hour"
                            style={{
                              top: `${topPercent}%`,
                              height: 1,
                              backgroundColor: '#d1d5db',
                            }}
                          />
                          {/* Hour label */}
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

                  {/* Activity bars - stacked by type order then overlap */}
                  <div className="absolute inset-0 flex justify-center" style={{ paddingLeft: 20 }}>
                    <div 
                      className="relative h-full"
                      style={{ width: day.maxLanes * (BAR_WIDTH + BAR_GAP) }}
                    >
                      {day.activities.map((act) => {
                        // Position: 23:59 at top (0%), 0:00 at bottom (100%)
                        const heightPercent = Math.max(
                          ((act.endHour - act.startHour) / 24) * 100,
                          MIN_BAR_HEIGHT_PERCENT
                        );
                        const topPercent = ((24 - act.endHour) / 24) * 100;

                        // Horizontal position based on assigned lane
                        const leftPx = act.lane * (BAR_WIDTH + BAR_GAP);

                        return (
                          <div
                            key={act.id}
                            className={cn(
                              "absolute rounded-sm cursor-pointer transition-opacity",
                              "activity-chart-event",
                              hoveredActivity?.id === act.id && "ring-1 ring-white"
                            )}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                              left: leftPx,
                              width: BAR_WIDTH,
                              backgroundColor: act.color,
                              opacity: hoveredActivity?.id === act.id ? 1 : 0.9,
                            }}
                            onMouseEnter={(e) => handleMouseEnter(e, act)}
                            onMouseMove={handleMouseMove}
                            onMouseLeave={handleMouseLeave}
                            role="button"
                            tabIndex={0}
                            aria-label={`Activity at ${formatTime(act.startHour)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip - positioned at cursor using fixed positioning */}
      {hoveredActivity && tooltipPos && (
        <div
          className={cn(activityChartStyles.tooltip, "activity-chart-tooltip")}
          style={{
            position: 'fixed',
            top: tooltipPos.y + 10,
            left: tooltipPos.x + 10,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          {(() => {
            const details = getActivityDetails(hoveredActivity.activity as unknown as TimelineActivityType, settings);
            return (
              <>
                <div className={cn(activityChartStyles.tooltipTitle, "activity-chart-tooltip-title")}>
                  {details.title}
                  {hoveredActivity.isOvernightContinuation && (
                    <span className="text-xs font-normal ml-1">{t('(continued)')}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mb-1">
                  {formatTime(hoveredActivity.startHour)} - {formatTime(hoveredActivity.endHour)}
                </div>
                <div className={cn(activityChartStyles.tooltipBody, "activity-chart-tooltip-body")}>
                  {details.details.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="font-medium">{item.label}: </span>
                      <span>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default ActivityTab;
