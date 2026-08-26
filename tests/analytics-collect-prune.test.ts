import { describe, it, expect } from 'vitest';
import { shouldPrune, PRUNE_CUTOFF_DAYS, pruneCutoffDate } from '@/app/api/analytics/collect/route';

describe('retention prune helpers', () => {
  it('cutoff is 365 days', () => {
    expect(PRUNE_CUTOFF_DAYS).toBe(365);
  });
  it('shouldPrune triggers on a small random slice only', () => {
    expect(shouldPrune(0.0005)).toBe(true);   // < 1/500
    expect(shouldPrune(0.5)).toBe(false);
  });
  it('pruneCutoffDate is now minus 365 days', () => {
    const now = new Date('2026-08-26T00:00:00Z');
    expect(pruneCutoffDate(now).toISOString()).toBe('2025-08-26T00:00:00.000Z');
  });
});
