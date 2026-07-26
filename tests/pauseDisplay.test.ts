import { describe, it, expect } from 'vitest';
import { formatPauseDuration } from '@/src/utils/pauseDisplay';

const t = (key: string) => key; // identity translator

describe('formatPauseDuration', () => {
  it('returns empty string for zero or negative seconds', () => {
    expect(formatPauseDuration(0, t)).toBe('');
    expect(formatPauseDuration(-5, t)).toBe('');
  });

  it('formats sub-minute pauses as seconds only (no "0 min")', () => {
    expect(formatPauseDuration(30, t)).toBe('30 sec');
  });

  it('formats whole minutes with the short unit (no "1 minutes")', () => {
    expect(formatPauseDuration(60, t)).toBe('1 min');
    expect(formatPauseDuration(120, t)).toBe('2 min');
  });

  it('formats mixed durations as min + sec', () => {
    expect(formatPauseDuration(150, t)).toBe('2 min 30 sec');
  });
});
