import React, { useMemo, useEffect, useRef, useState } from 'react';
import { ActivityType } from '../types';
import {
  TIME_SLOTS,
  SLOT_MINUTES,
  HEATMAP_TYPES_IN_ORDER,
  HEATMAP_COLORS,
  buildHeatmapDataForActivities,
  getSlotOpacity,
  interpolateColor,
} from './timeline-heatmap.utils';

interface TimelineV2HeatmapProps {
  activities: ActivityType[];
  selectedDate: Date;
  isVisible?: boolean;
}

const CHART_HEIGHT = 1500;
const LANE_WIDTH = 8; // each heatmap type lane
const LANE_GAP = 2;

// Format hour for labels (reuses pattern from Reports)
const formatHourLabel = (hour: number): string => {
  if (hour === 0 || hour === 24) return '12a';
  if (hour === 12) return '12p';
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
};

const TimelineV2Heatmap: React.FC<TimelineV2HeatmapProps> = ({
  activities,
  selectedDate,
  isVisible = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const heatmapData = useMemo(() => {
    if (!activities.length) {
      return null;
    }
    return buildHeatmapDataForActivities(activities as any);
  }, [activities]);

  const hourLines = useMemo(() => {
    const lines: number[] = [];
    for (let h = 0; h <= 24; h++) {
      lines.push(h);
    }
    return lines;
  }, []);

  // Animate from midnight at bottom to current time centered
  useEffect(() => {
    if (!isVisible) return;
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const runAnimation = () => {
      const now = new Date();
      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
      const totalMinutes = 24 * 60;

      const containerHeight = container.clientHeight;
      const contentHeight = content.clientHeight;

      // If layout hasn't stabilized yet, retry on the next frame
      if (containerHeight === 0 || contentHeight === 0) {
        requestAnimationFrame(runAnimation);
        return;
      }

      const currentY = contentHeight - (minutesSinceMidnight / totalMinutes) * contentHeight;
      const targetCenterY = containerHeight / 2;
      const minOffset = containerHeight - contentHeight; // midnight at bottom (<= 0)
      const maxOffset = 0; // content fully aligned at top
      const initialOffset = minOffset;
      // Center current time when possible, but don't scroll past top/bottom
      const unclampedTargetOffset = targetCenterY - currentY;
      const targetOffset = Math.max(minOffset, Math.min(maxOffset, unclampedTargetOffset));

      let start: number | null = null;
      const duration = 600; // ms

      const animate = (timestamp: number) => {
        if (start === null) start = timestamp;
        const elapsed = timestamp - start;
        const t = Math.min(1, elapsed / duration);
        const eased = t * t * (3 - 2 * t); // smoothstep
        const currentOffset = initialOffset + (targetOffset - initialOffset) * eased;
        content.style.transform = `translateY(${currentOffset}px)`;

        if (t < 1) {
          requestAnimationFrame(animate);
        }
      };

      // start with midnight at bottom
      content.style.transform = `translateY(${initialOffset}px)`;
      requestAnimationFrame(animate);
    };

    runAnimation();
  }, [isVisible, activities]);

  if (!heatmapData) {
    return null;
  }

  const totalLanes = HEATMAP_TYPES_IN_ORDER.length;
  const totalWidth = totalLanes * (LANE_WIDTH + LANE_GAP);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden timeline-v2-heatmap-container"
    >
      <div
        ref={contentRef}
        className="absolute inset-x-0 timeline-v2-heatmap-content"
        style={{ height: CHART_HEIGHT, width: totalWidth, margin: '0 auto' }}
      >
        {/* Hour grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {hourLines.map((hour) => {
            const topPercent = ((24 - hour) / 24) * 100;
            const showLabel = hour % 3 === 0 || hour === 0 || hour === 24;

            return (
              <div key={hour}>
                <div
                  className="absolute left-0 right-0 timeline-v2-heatmap-grid-hour"
                  style={{
                    top: `${topPercent}%`,
                    height: 1,
                    backgroundColor: '#e5e7eb',
                  }}
                />
                {showLabel && (
                  <span
                    className="absolute text-[9px] text-gray-400 timeline-v2-heatmap-hour-label"
                    style={{
                      top: `${topPercent}%`,
                      left: 0,
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

        {/* Stacked heatmap lanes */}
        {HEATMAP_TYPES_IN_ORDER.map((type, laneIndex) => {
          const data = heatmapData[type];
          const colors = HEATMAP_COLORS[type];
          const laneLeft = laneIndex * (LANE_WIDTH + LANE_GAP);

          if (!data || data.maxCount === 0) {
            return null;
          }

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

                const backgroundColor =
                  intensity > 0
                    ? interpolateColor(intensity, colors.base, colors.light)
                    : 'transparent';

                return (
                  <div
                    key={slotIndex}
                    className="absolute left-0 right-0 timeline-v2-heatmap-slot"
                    style={{
                      top: `${topPercent}%`,
                      height: `${heightPercent}%`,
                      backgroundColor,
                      opacity: getSlotOpacity(intensity),
                    }}
                    title={
                      intensity > 0
                        ? `${type}: ${Math.round(intensity * data.maxCount)}`
                        : undefined
                    }
                  />
                );
              })}
            </div>
          );
        })}

        {/* Current time bar - always based on \"now\" */}
        {(() => {
          const now = new Date();
          const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
          const totalMinutes = 24 * 60;
          const topPercent = ((24 * 60 - minutesSinceMidnight) / totalMinutes) * 100;

          return (
            <div
              className="absolute left-0 right-0 timeline-v2-heatmap-time-bar"
              style={{
                top: `${topPercent}%`,
                height: 2,
                backgroundColor: '#14b8a6',
              }}
            />
          );
        })()}
      </div>
    </div>
  );
};

export default TimelineV2Heatmap;


