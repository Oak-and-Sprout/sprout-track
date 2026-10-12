import { describe, it, expect } from 'vitest';
import { formatHeatmapHourLabel } from '@/src/components/Timeline/TimelineV2/timeline-heatmap.utils';

describe('formatHeatmapHourLabel', () => {
  it('keeps compact 12-hour labels', () => {
    expect(formatHeatmapHourLabel(0, '12h')).toBe('12a');
    expect(formatHeatmapHourLabel(24, '12h')).toBe('12a');
    expect(formatHeatmapHourLabel(3, '12h')).toBe('3a');
    expect(formatHeatmapHourLabel(12, '12h')).toBe('12p');
    expect(formatHeatmapHourLabel(15, '12h')).toBe('3p');
  });

  it('uses zero-padded 24-hour labels', () => {
    expect(formatHeatmapHourLabel(0, '24h')).toBe('00');
    expect(formatHeatmapHourLabel(24, '24h')).toBe('00');
    expect(formatHeatmapHourLabel(3, '24h')).toBe('03');
    expect(formatHeatmapHourLabel(12, '24h')).toBe('12');
    expect(formatHeatmapHourLabel(15, '24h')).toBe('15');
    expect(formatHeatmapHourLabel(21, '24h')).toBe('21');
  });
});
