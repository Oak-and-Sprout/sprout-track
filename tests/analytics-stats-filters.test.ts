import { describe, it, expect } from 'vitest';
import { parseAnalyticsFilters, buildPageviewWhere } from '@/app/api/utils/analytics';

const now = new Date('2026-08-26T00:00:00Z');

describe('parseAnalyticsFilters', () => {
  it('defaults to 30 days, page 1, pageSize 25', () => {
    const f = parseAnalyticsFilters(new URLSearchParams(), now);
    expect(f.page).toBe(1); expect(f.pageSize).toBe(25); expect(f.path).toBeNull();
    expect(f.rangeStart?.toISOString()).toBe('2026-07-27T00:00:00.000Z');
  });
  it('supports all-time', () => {
    expect(parseAnalyticsFilters(new URLSearchParams('days=all'), now).rangeStart).toBeNull();
  });
  it('caps pageSize at 100 and floors garbage', () => {
    expect(parseAnalyticsFilters(new URLSearchParams('pageSize=9999'), now).pageSize).toBe(100);
    expect(parseAnalyticsFilters(new URLSearchParams('pageSize=x'), now).pageSize).toBe(25);
  });
  it('passes through a path filter', () => {
    expect(parseAnalyticsFilters(new URLSearchParams('path=/pricing'), now).path).toBe('/pricing');
  });
});

describe('buildPageviewWhere', () => {
  it('adds timestamp and path when present', () => {
    const where = buildPageviewWhere({ rangeStart: now, path: '/pricing', page: 1, pageSize: 25 });
    expect(where).toEqual({ timestamp: { gte: now }, path: '/pricing' });
  });
  it('omits both when null', () => {
    expect(buildPageviewWhere({ rangeStart: null, path: null, page: 1, pageSize: 25 })).toEqual({});
  });
});
