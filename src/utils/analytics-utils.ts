import { utcDayString, extractReferrerDomain, escapeCsvField, type BreakdownEntry } from '@/src/utils/short-link-utils';

export type { BreakdownEntry };

/** Canonical, allowlisted public + auth-funnel routes we record pageviews for. */
export const ANALYTICS_ALLOWED_PATHS: string[] = [
  '/', '/features', '/pricing', '/terms', '/privacy', '/gift-success',
  '/login', '/setup', '/verify', '/passwordreset', '/family-select',
  '/:slug/resume-setup',
];

/**
 * Normalizes a raw client path to a canonical allowlisted path, or null if it
 * is not a known public/funnel route. Strips query/hash/trailing-slash,
 * lowercases, and maps `/<slug>/resume-setup` to `/:slug/resume-setup`.
 */
export function normalizePath(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let p = raw.split('#')[0].split('?')[0].trim().toLowerCase();
  if (!p.startsWith('/')) return null;
  if (p.includes('..')) return null;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (ANALYTICS_ALLOWED_PATHS.includes(p)) return p;
  if (/^\/[a-z0-9-]+\/resume-setup$/.test(p)) return '/:slug/resume-setup';
  return null;
}

export interface PageviewRowLite {
  timestamp: Date;
  visitorHash: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  referrerDomain: string | null;
  path: string;
}

export interface PageviewDayPoint { date: string; views: number; uniques: number; }

export interface PageviewAggregates {
  series: PageviewDayPoint[];
  totals: { views: number; uniques: number };
  breakdowns: {
    path: BreakdownEntry[];
    referrerDomain: BreakdownEntry[];
    country: BreakdownEntry[];
    deviceType: BreakdownEntry[];
    browser: BreakdownEntry[];
    os: BreakdownEntry[];
  };
}

function sortedBreakdown(counts: Map<string, number>): BreakdownEntry[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

function inc(map: Map<string, number>, value: string | null | undefined) {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

/**
 * Aggregates pageview rows into a zero-filled daily series (UTC), totals, and
 * sorted breakdowns. uniques are per-UTC-day distinct visitorHash; totals.uniques
 * sums per-day uniques (the hash rotates daily, so cross-day dedup is not possible).
 */
export function aggregatePageviews(rows: PageviewRowLite[], rangeStart: Date, rangeEnd: Date): PageviewAggregates {
  const dayUniques = new Map<string, Set<string>>();
  const pathCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const dayViews = new Map<string, number>();

  for (const row of rows) {
    const day = utcDayString(row.timestamp);
    dayViews.set(day, (dayViews.get(day) ?? 0) + 1);
    if (row.visitorHash) {
      if (!dayUniques.has(day)) dayUniques.set(day, new Set());
      dayUniques.get(day)!.add(row.visitorHash);
    }
    inc(pathCounts, row.path);
    inc(referrerCounts, row.referrerDomain);
    inc(countryCounts, row.country);
    inc(deviceCounts, row.deviceType);
    inc(browserCounts, row.browser);
    inc(osCounts, row.os);
  }

  const series: PageviewDayPoint[] = [];
  const cursor = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth(), rangeStart.getUTCDate()));
  const endDay = utcDayString(rangeEnd);
  let totalUniques = 0;
  while (utcDayString(cursor) <= endDay) {
    const day = utcDayString(cursor);
    const uniques = dayUniques.get(day)?.size ?? 0;
    series.push({ date: day, views: dayViews.get(day) ?? 0, uniques });
    totalUniques += uniques;
    cursor.setTime(cursor.getTime() + 86400000);
  }

  return {
    series,
    totals: { views: rows.length, uniques: totalUniques },
    breakdowns: {
      path: sortedBreakdown(pathCounts),
      referrerDomain: sortedBreakdown(referrerCounts),
      country: sortedBreakdown(countryCounts),
      deviceType: sortedBreakdown(deviceCounts),
      browser: sortedBreakdown(browserCounts),
      os: sortedBreakdown(osCounts),
    },
  };
}

export interface FunnelStageDef { label: string; paths: string[]; }
export interface FunnelStageResult { label: string; visitors: number; }

/** Default coarse conversion funnel (page-based, approximate — no cookies). */
export const ANALYTICS_FUNNEL_STAGES: FunnelStageDef[] = [
  { label: 'Landing', paths: ['/'] },
  { label: 'Signup / Login', paths: ['/login', '/setup', '/verify', '/:slug/resume-setup'] },
  { label: 'Conversion', paths: ['/gift-success'] },
];

/** Distinct-visitor count per stage (non-null visitorHash whose path is in the stage set). */
export function computeFunnel(
  rows: Pick<PageviewRowLite, 'path' | 'visitorHash'>[],
  stages: FunnelStageDef[],
): FunnelStageResult[] {
  return stages.map((stage) => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.visitorHash && stage.paths.includes(r.path)) set.add(r.visitorHash);
    }
    return { label: stage.label, visitors: set.size };
  });
}

export interface CsvPageviewRow {
  timestamp: string; path: string; deviceType: string | null; browser: string | null;
  os: string | null; country: string | null; region: string | null;
  referrerDomain: string | null; queryString: string | null;
}

const CSV_HEADER = 'timestamp,path,deviceType,browser,os,country,region,referrerDomain,queryString';

/** Builds an RFC-4180 CSV (header, CRLF) from pageview rows, escaping injection. */
export function buildPageviewsCsv(rows: CsvPageviewRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push([
      row.timestamp, row.path, row.deviceType, row.browser, row.os,
      row.country, row.region, row.referrerDomain, row.queryString,
    ].map(escapeCsvField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

// re-export for the collect endpoint's server-side derivation
export { extractReferrerDomain };
