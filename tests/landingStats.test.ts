import { describe, it, expect } from 'vitest';
import {
  formatFamilyCount,
  resolveLandingStats,
  LANDING_STATS_FALLBACK,
} from '@/src/utils/landing-stats';

describe('formatFamilyCount', () => {
  it('floors to the nearest 10 with a plus', () => {
    expect(formatFamilyCount(74)).toBe('70+');
    expect(formatFamilyCount(105)).toBe('100+');
    expect(formatFamilyCount(10)).toBe('10+');
  });

  it('shows small counts as-is without a plus', () => {
    expect(formatFamilyCount(0)).toBe('0');
    expect(formatFamilyCount(9)).toBe('9');
  });
});

describe('resolveLandingStats', () => {
  it('uses real values when present', () => {
    expect(resolveLandingStats(84, 400)).toEqual({ families: 84, stars: 400 });
  });

  it('falls back per-field when null', () => {
    expect(resolveLandingStats(null, 400)).toEqual({
      families: LANDING_STATS_FALLBACK.families,
      stars: 400,
    });
    expect(resolveLandingStats(84, null)).toEqual({
      families: 84,
      stars: LANDING_STATS_FALLBACK.stars,
    });
    expect(resolveLandingStats(null, null)).toEqual(LANDING_STATS_FALLBACK);
  });
});
