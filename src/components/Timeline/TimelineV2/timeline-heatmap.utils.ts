import { ActivityType } from '../types';

// Shared heatmap configuration
export const TIME_SLOTS = 288; // 5-minute slots
export const SLOT_MINUTES = 5;

export type HeatmapType = 'wakeTime' | 'bedtime' | 'naps' | 'allSleep' | 'feeds' | 'diapers' | 'pumps';

export const HEATMAP_TYPES_IN_ORDER: HeatmapType[] = [
  'wakeTime',
  'bedtime',
  'naps',
  'allSleep',
  'feeds',
  'diapers',
  'pumps',
];

// Heatmap color scales - using activity colors as base
export const HEATMAP_COLORS: Record<HeatmapType, { base: string; light: string }> = {
  wakeTime: { base: '#fbbf24', light: '#fef3c7' },      // amber - sunrise
  bedtime: { base: '#6366f1', light: '#e0e7ff' },       // indigo - night
  naps: { base: '#6b7280', light: '#f3f4f6' },          // gray - sleep
  allSleep: { base: '#6b7280', light: '#f3f4f6' },      // gray - sleep
  feeds: { base: '#7dd3fc', light: '#e0f2fe' },         // sky - feed
  diapers: { base: '#0d9488', light: '#ccfbf1' },       // teal - diaper
  pumps: { base: '#c084fc', light: '#f3e8ff' },         // purple - pump
};

// Interpolate between two colors based on intensity (0-1)
export const interpolateColor = (intensity: number, baseColor: string, lightColor: string): string => {
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

// Map normalized intensity (0-1) to an opacity value with a strong bias toward high intensities.
// - Below 0.5: smoothly fades toward 0, reaching ~0.2 opacity at 0.5
// - Above 0.5: curves up toward ~0.9 opacity, emphasizing the top 10–20% of intensities
export const getSlotOpacity = (intensity: number): number => {
  if (intensity <= 0) return 0;

  const clamped = Math.max(0, Math.min(1, intensity));

  if (clamped <= 0.5) {
    // 0 -> 0, 0.5 -> 0.2
    return 0.4 * clamped;
  }

  // Upper half: ease-in curve from 0.2 at 0.5 to 0.9 at 1.0
  const t = (clamped - 0.5) / 0.5; // 0..1
  const minOpacity = 0.2;
  const maxOpacity = 0.9;
  const curved = minOpacity + (maxOpacity - minOpacity) * (t * t);

  return curved;
};

// Convert time to slot index
export const timeToSlot = (hours: number): number => {
  const slot = Math.floor((hours * 60) / SLOT_MINUTES);
  return Math.max(0, Math.min(TIME_SLOTS - 1, slot));
};

const getHours = (d: Date) => d.getHours() + d.getMinutes() / 60;

export interface HeatmapSeriesData {
  slots: number[];
  maxCount: number;
}

export type HeatmapData = Record<HeatmapType, HeatmapSeriesData>;

export const buildHeatmapDataForActivities = (activities: ActivityType[]): HeatmapData => {
  const slotCounts: Record<HeatmapType, number[]> = {
    wakeTime: new Array(TIME_SLOTS).fill(0),
    bedtime: new Array(TIME_SLOTS).fill(0),
    naps: new Array(TIME_SLOTS).fill(0),
    allSleep: new Array(TIME_SLOTS).fill(0),
    feeds: new Array(TIME_SLOTS).fill(0),
    diapers: new Array(TIME_SLOTS).fill(0),
    pumps: new Array(TIME_SLOTS).fill(0),
  };

  activities.forEach((activity) => {
    const base = new Date(
      'time' in activity && activity.time
        ? activity.time
        : 'startTime' in activity && activity.startTime
        ? activity.startTime
        : 'date' in activity && activity.date
        ? activity.date
        : new Date().toISOString()
    );
    if (Number.isNaN(base.getTime())) return;

    // Sleep activities
    if ('duration' in activity && 'startTime' in activity && 'type' in activity &&
        (activity.type === 'NAP' || activity.type === 'NIGHT_SLEEP')) {
      const start = activity.startTime ? new Date(activity.startTime) : base;
      const end = activity.endTime ? new Date(activity.endTime) : null;

      const startHours = getHours(start);
      const endHours = end ? getHours(end) : startHours;

      if (activity.type === 'NIGHT_SLEEP') {
        // Bedtime - just the start time (±30 min window), only after noon
        if (startHours >= 12) {
          const bedtimeStart = Math.max(0, startHours - 30/60);
          const bedtimeEnd = Math.min(24, startHours + 30/60);
          for (let slot = timeToSlot(bedtimeStart); slot <= timeToSlot(bedtimeEnd); slot++) {
            slotCounts.bedtime[slot]++;
          }
        }

        // Wake time - just the end time (±30 min window) if available, only before noon
        if (end && endHours < 12) {
          const wakeStart = Math.max(0, endHours - 30/60);
          const wakeEnd = Math.min(24, endHours + 30/60);
          for (let slot = timeToSlot(wakeStart); slot <= timeToSlot(wakeEnd); slot++) {
            slotCounts.wakeTime[slot]++;
          }
        }

        // All sleep - full duration (night sleep only)
        if (end) {
          if (endHours < startHours) {
            for (let slot = timeToSlot(startHours); slot < TIME_SLOTS; slot++) {
              slotCounts.allSleep[slot]++;
            }
            for (let slot = 0; slot <= timeToSlot(endHours); slot++) {
              slotCounts.allSleep[slot]++;
            }
          } else {
            for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
              slotCounts.allSleep[slot]++;
            }
          }
        }
      } else if (activity.type === 'NAP') {
        // Nap windows - full duration, but not counted in allSleep
        if (end) {
          for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
            slotCounts.naps[slot]++;
          }
        } else {
          // No end time, use ±30 min window
          const napStart = Math.max(0, startHours - 30/60);
          const napEnd = Math.min(24, startHours + 30/60);
          for (let slot = timeToSlot(napStart); slot <= timeToSlot(napEnd); slot++) {
            slotCounts.naps[slot]++;
          }
        }
      }
    }

    // Feed activities
    if ('amount' in activity && 'type' in activity && 'time' in activity) {
      const feedTime = new Date(activity.time);
      const feedHours = getHours(feedTime);

      // ±30 min window
      const feedStart = Math.max(0, feedHours - 30/60);
      const feedEnd = Math.min(24, feedHours + 30/60);
      for (let slot = timeToSlot(feedStart); slot <= timeToSlot(feedEnd); slot++) {
        slotCounts.feeds[slot]++;
      }
    }

    // Diaper activities
    if ('condition' in activity && 'type' in activity && 'time' in activity) {
      const diaperTime = new Date(activity.time);
      const diaperHours = getHours(diaperTime);

      // ±30 min window
      const diaperStart = Math.max(0, diaperHours - 30/60);
      const diaperEnd = Math.min(24, diaperHours + 30/60);
      for (let slot = timeToSlot(diaperStart); slot <= timeToSlot(diaperEnd); slot++) {
        slotCounts.diapers[slot]++;
      }
    }

    // Pump activities
    if ('leftAmount' in activity || 'rightAmount' in activity) {
      const start = 'startTime' in activity && activity.startTime ? new Date(activity.startTime) : base;
      const end = 'endTime' in activity && activity.endTime ? new Date(activity.endTime) : null;

      const startHours = getHours(start);

      if (end) {
        const endHours = getHours(end);
        for (let slot = timeToSlot(startHours); slot <= timeToSlot(endHours); slot++) {
          slotCounts.pumps[slot]++;
        }
      } else {
        // ±30 min window
        const pumpStart = Math.max(0, startHours - 30/60);
        const pumpEnd = Math.min(24, startHours + 30/60);
        for (let slot = timeToSlot(pumpStart); slot <= timeToSlot(pumpEnd); slot++) {
          slotCounts.pumps[slot]++;
        }
      }
    }
  });

  const normalizedData: HeatmapData = {} as HeatmapData;

  HEATMAP_TYPES_IN_ORDER.forEach((type) => {
    const counts = slotCounts[type];
    const maxCount = Math.max(...counts, 1);
    normalizedData[type] = {
      slots: counts.map(count => count / maxCount),
      maxCount,
    };
  });

  return normalizedData;
};


