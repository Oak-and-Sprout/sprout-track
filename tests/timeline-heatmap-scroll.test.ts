import { describe, it, expect } from 'vitest';
import { getHeatmapScrollTop } from '@/src/components/Timeline/TimelineV2/timeline-heatmap.utils';

describe('getHeatmapScrollTop', () => {
  const layout = { containerHeight: 600, contentHeight: 1500 };

  it('centers noon in the viewport', () => {
    // 1500px chart, midnight at the bottom → noon at 750px from the top.
    // A 600px viewport centers 750 at 300, so scrollTop is 450.
    expect(getHeatmapScrollTop({ ...layout, minutesSinceMidnight: 12 * 60 })).toBe(450);
  });

  it('clamps midnight to the bottom of the chart', () => {
    // Max scroll on a 1500px chart in a 600px viewport is 900.
    expect(getHeatmapScrollTop({ ...layout, minutesSinceMidnight: 0 })).toBe(900);
  });

  it('clamps end of day to the top of the chart', () => {
    expect(getHeatmapScrollTop({ ...layout, minutesSinceMidnight: 23 * 60 + 59 })).toBe(0);
  });

  it('returns 0 when layout sizes are not ready', () => {
    expect(getHeatmapScrollTop({ containerHeight: 0, contentHeight: 1500, minutesSinceMidnight: 720 })).toBe(0);
    expect(getHeatmapScrollTop({ containerHeight: 600, contentHeight: 0, minutesSinceMidnight: 720 })).toBe(0);
  });
});
