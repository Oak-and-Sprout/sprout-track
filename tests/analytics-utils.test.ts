import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  aggregatePageviews,
  computeFunnel,
  buildPageviewsCsv,
  ANALYTICS_FUNNEL_STAGES,
  type PageviewRowLite,
} from '@/src/utils/analytics-utils';

describe('normalizePath', () => {
  it('accepts a known root path', () => {
    expect(normalizePath('/')).toBe('/');
  });
  it('strips query and hash and trailing slash', () => {
    expect(normalizePath('/pricing/?utm=x#top')).toBe('/pricing');
  });
  it('lowercases the path', () => {
    expect(normalizePath('/Pricing')).toBe('/pricing');
  });
  it('maps a resume-setup slug to a placeholder', () => {
    expect(normalizePath('/abc123/resume-setup')).toBe('/:slug/resume-setup');
  });
  it('rejects unknown paths', () => {
    expect(normalizePath('/family/secret')).toBeNull();
    expect(normalizePath('/../etc')).toBeNull();
    expect(normalizePath('')).toBeNull();
  });
});

describe('aggregatePageviews', () => {
  const d = (s: string) => new Date(s);
  const row = (over: Partial<PageviewRowLite>): PageviewRowLite => ({
    timestamp: d('2026-08-20T10:00:00Z'), visitorHash: 'h1', deviceType: 'desktop',
    browser: 'Chrome', os: 'macOS', country: 'US', referrerDomain: 'google.com',
    path: '/pricing', ...over,
  });

  it('zero-fills the daily series across the range', () => {
    const agg = aggregatePageviews([row({})], d('2026-08-19T00:00:00Z'), d('2026-08-21T00:00:00Z'));
    expect(agg.series.map(p => p.date)).toEqual(['2026-08-19', '2026-08-20', '2026-08-21']);
    expect(agg.series[1]).toEqual({ date: '2026-08-20', views: 1, uniques: 1 });
  });
  it('counts uniques per UTC day by visitorHash', () => {
    const rows = [row({ visitorHash: 'a' }), row({ visitorHash: 'a' }), row({ visitorHash: 'b' })];
    const agg = aggregatePageviews(rows, d('2026-08-20T00:00:00Z'), d('2026-08-20T23:59:59Z'));
    expect(agg.totals).toEqual({ views: 3, uniques: 2 });
  });
  it('produces a top-pages breakdown sorted by count', () => {
    const rows = [row({ path: '/pricing' }), row({ path: '/features' }), row({ path: '/pricing' })];
    const agg = aggregatePageviews(rows, d('2026-08-20T00:00:00Z'), d('2026-08-20T23:59:59Z'));
    expect(agg.breakdowns.path[0]).toEqual({ value: '/pricing', count: 2 });
  });
  it('ignores null breakdown values', () => {
    const agg = aggregatePageviews([row({ country: null })], d('2026-08-20T00:00:00Z'), d('2026-08-20T23:59:59Z'));
    expect(agg.breakdowns.country).toEqual([]);
  });
});

describe('computeFunnel', () => {
  it('counts distinct visitors per stage', () => {
    const rows = [
      { path: '/', visitorHash: 'a' }, { path: '/', visitorHash: 'b' },
      { path: '/login', visitorHash: 'a' }, { path: '/gift-success', visitorHash: 'a' },
    ];
    const stages = [
      { label: 'Landing', paths: ['/'] },
      { label: 'Login', paths: ['/login'] },
      { label: 'Conversion', paths: ['/gift-success'] },
    ];
    expect(computeFunnel(rows, stages)).toEqual([
      { label: 'Landing', visitors: 2 },
      { label: 'Login', visitors: 1 },
      { label: 'Conversion', visitors: 1 },
    ]);
  });
  it('ignores rows with null visitorHash', () => {
    const rows = [{ path: '/', visitorHash: null }, { path: '/', visitorHash: 'a' }];
    expect(computeFunnel(rows, [{ label: 'L', paths: ['/'] }])).toEqual([{ label: 'L', visitors: 1 }]);
  });
  it('exposes default stages', () => {
    expect(ANALYTICS_FUNNEL_STAGES.length).toBeGreaterThanOrEqual(3);
  });
});

describe('buildPageviewsCsv', () => {
  it('includes a path column and escapes injection', () => {
    const csv = buildPageviewsCsv([{
      timestamp: '2026-08-20T10:00:00.000Z', path: '/pricing', deviceType: 'desktop',
      browser: 'Chrome', os: 'macOS', country: 'US', region: null,
      referrerDomain: '=cmd()', queryString: null,
    }]);
    expect(csv.split('\r\n')[0]).toBe('timestamp,path,deviceType,browser,os,country,region,referrerDomain,queryString');
    expect(csv).toContain("'=cmd()");
  });
});
