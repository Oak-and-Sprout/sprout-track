import { describe, it, expect } from 'vitest';
import { parseStatsFilters, buildClickWhere } from '@/app/api/utils/short-link-stats';

const NOW = new Date('2026-07-31T12:00:00Z');

describe('parseStatsFilters', () => {
  it('defaults to 30 days, page 1, size 25', () => {
    const f = parseStatsFilters(new URLSearchParams(), NOW);
    expect(f.rangeStart).toEqual(new Date('2026-07-01T12:00:00Z')); // now - 30d
    expect(f).toMatchObject({ deviceType: null, country: null, referrer: null, page: 1, pageSize: 25 });
  });
  it('parses days=7/90 and all', () => {
    expect(parseStatsFilters(new URLSearchParams('days=7'), NOW).rangeStart).toEqual(new Date('2026-07-24T12:00:00Z'));
    expect(parseStatsFilters(new URLSearchParams('days=90'), NOW).rangeStart).toEqual(new Date('2026-05-02T12:00:00Z'));
    expect(parseStatsFilters(new URLSearchParams('days=all'), NOW).rangeStart).toBeNull();
  });
  it('falls back to 30 days on garbage and clamps pagination', () => {
    expect(parseStatsFilters(new URLSearchParams('days=banana'), NOW).rangeStart).toEqual(new Date('2026-07-01T12:00:00Z'));
    const f = parseStatsFilters(new URLSearchParams('page=0&pageSize=9999'), NOW);
    expect(f.page).toBe(1);
    expect(f.pageSize).toBe(100);
  });
  it('passes through filter values', () => {
    const f = parseStatsFilters(new URLSearchParams('deviceType=mobile&country=US&referrer=reddit.com'), NOW);
    expect(f).toMatchObject({ deviceType: 'mobile', country: 'US', referrer: 'reddit.com' });
  });
});

describe('buildClickWhere', () => {
  it('always scopes to the link id', () => {
    const w = buildClickWhere('link1', parseStatsFilters(new URLSearchParams('days=all'), NOW));
    expect(w).toEqual({ shortLinkId: 'link1' });
  });
  it('includes range and filters when set', () => {
    const w = buildClickWhere('link1', parseStatsFilters(new URLSearchParams('days=7&deviceType=mobile&country=US&referrer=reddit.com'), NOW));
    expect(w).toEqual({
      shortLinkId: 'link1',
      timestamp: { gte: new Date('2026-07-24T12:00:00Z') },
      deviceType: 'mobile',
      country: 'US',
      referrerDomain: 'reddit.com',
    });
  });
});
