import { createHash } from 'crypto';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'bot' | 'unknown';

export interface ParsedUserAgent {
  deviceType: DeviceType;
  browser: string | null;
  os: string | null;
}

const BOT_RE = /bot|crawler|spider|curl|wget|python-requests|facebookexternalhit|preview/i;
const TABLET_RE = /ipad|tablet/i;
const ANDROID_RE = /android/i;
const MOBILE_RE = /mobi|iphone|android/i;

/**
 * Parses a user-agent string into a coarse device/browser/OS classification.
 * Returns 'unknown' device with null browser/os for null/empty input.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) {
    return { deviceType: 'unknown', browser: null, os: null };
  }

  let deviceType: DeviceType;
  if (BOT_RE.test(ua)) {
    deviceType = 'bot';
  } else if (TABLET_RE.test(ua) || (ANDROID_RE.test(ua) && !/mobile/i.test(ua))) {
    deviceType = 'tablet';
  } else if (MOBILE_RE.test(ua)) {
    deviceType = 'mobile';
  } else {
    deviceType = 'desktop';
  }

  let browser: string | null = null;
  if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//i.test(ua)) {
    browser = 'Opera';
  } else if (/SamsungBrowser/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/Chrome\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari/i.test(ua) && !/Chrome|Edg|OPR/i.test(ua)) {
    browser = 'Safari';
  }

  let os: string | null = null;
  if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  return { deviceType, browser, os };
}

/**
 * Validates that a string is an absolute http/https URL, rejecting relative
 * paths, protocol-relative URLs, and non-http(s) schemes like javascript:/data:.
 */
export function isValidDestinationUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Appends incoming query params (from req.nextUrl.search) onto the destination
 * URL. On key conflict the destination's own param wins. Fragment is preserved.
 */
export function mergeQueryParams(destinationUrl: string, incomingSearch: string): string {
  const url = new URL(destinationUrl);
  const incoming = new URLSearchParams(incomingSearch);
  incoming.forEach((value, key) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.append(key, value);
    }
  });
  return url.toString();
}

/**
 * Computes a daily-rotating visitor hash: sha256(secret|dayUtc|ip|userAgent),
 * sliced to the first 16 hex characters.
 */
export function computeVisitorHash(ip: string, userAgent: string, dayUtc: string, secret: string): string {
  return createHash('sha256')
    .update(`${secret}|${dayUtc}|${ip}|${userAgent}`)
    .digest('hex')
    .slice(0, 16);
}

/** Formats a Date as its UTC calendar day, "YYYY-MM-DD". */
export function utcDayString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Extracts the lowercase hostname from a referer URL, or null if invalid/empty. */
export function extractReferrerDomain(referer: string | null | undefined): string | null {
  if (!referer) {
    return null;
  }
  try {
    return new URL(referer).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Hex-encodes the first 4 bytes of the given array into an 8 char lowercase slug. */
export function bytesToSlug(bytes: Uint8Array): string {
  return Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Reads the client IP from x-forwarded-for (first hop) or x-real-ip. */
export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) {
      return first;
    }
  }
  return headers.get('x-real-ip');
}

/** Reads country/region from CDN-provided geo headers. */
export function getCountry(headers: Headers): { country: string | null; region: string | null } {
  const raw = headers.get('cf-ipcountry') ?? headers.get('x-vercel-ip-country');
  const country = raw && raw.toUpperCase() !== 'XX' ? raw.toUpperCase() : null;
  const region = headers.get('x-vercel-ip-country-region') ?? null;
  return { country, region };
}

export interface ClickRowLite {
  timestamp: Date;
  visitorHash: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  referrerDomain: string | null;
}

export interface DayPoint {
  date: string;
  clicks: number;
  uniques: number;
}

export interface BreakdownEntry {
  value: string;
  count: number;
}

export interface ClickAggregates {
  series: DayPoint[];
  totals: { clicks: number; uniques: number };
  breakdowns: {
    deviceType: BreakdownEntry[];
    browser: BreakdownEntry[];
    os: BreakdownEntry[];
    country: BreakdownEntry[];
    referrerDomain: BreakdownEntry[];
  };
}

function sortedBreakdown(counts: Map<string, number>): BreakdownEntry[] {
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

function incrementCount(map: Map<string, number>, value: string | null | undefined) {
  if (!value) {
    return;
  }
  map.set(value, (map.get(value) ?? 0) + 1);
}

/**
 * Aggregates click rows into a zero-filled daily series (rangeStart..rangeEnd
 * inclusive, UTC days), totals, and sorted breakdowns by field.
 *
 * uniques are counted per UTC day (distinct non-null visitorHash); totals.uniques
 * sums the per-day uniques since the visitor hash rotates daily and cross-day
 * dedup is not possible — this is a documented estimate, not exact.
 */
export function aggregateClicks(rows: ClickRowLite[], rangeStart: Date, rangeEnd: Date): ClickAggregates {
  const dayClicks = new Map<string, number>();
  const dayUniques = new Map<string, Set<string>>();

  const deviceTypeCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  const referrerDomainCounts = new Map<string, number>();

  for (const row of rows) {
    const day = utcDayString(row.timestamp);
    dayClicks.set(day, (dayClicks.get(day) ?? 0) + 1);
    if (row.visitorHash) {
      if (!dayUniques.has(day)) {
        dayUniques.set(day, new Set());
      }
      dayUniques.get(day)!.add(row.visitorHash);
    }

    incrementCount(deviceTypeCounts, row.deviceType);
    incrementCount(browserCounts, row.browser);
    incrementCount(osCounts, row.os);
    incrementCount(countryCounts, row.country);
    incrementCount(referrerDomainCounts, row.referrerDomain);
  }

  const series: DayPoint[] = [];
  const cursor = new Date(Date.UTC(
    rangeStart.getUTCFullYear(),
    rangeStart.getUTCMonth(),
    rangeStart.getUTCDate(),
  ));
  const endDay = utcDayString(rangeEnd);
  let totalUniques = 0;
  while (utcDayString(cursor) <= endDay) {
    const day = utcDayString(cursor);
    const clicks = dayClicks.get(day) ?? 0;
    const uniques = dayUniques.get(day)?.size ?? 0;
    series.push({ date: day, clicks, uniques });
    totalUniques += uniques;
    cursor.setTime(cursor.getTime() + 86400000);
  }

  return {
    series,
    totals: { clicks: rows.length, uniques: totalUniques },
    breakdowns: {
      deviceType: sortedBreakdown(deviceTypeCounts),
      browser: sortedBreakdown(browserCounts),
      os: sortedBreakdown(osCounts),
      country: sortedBreakdown(countryCounts),
      referrerDomain: sortedBreakdown(referrerDomainCounts),
    },
  };
}

export interface CsvClickRow {
  timestamp: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  region: string | null;
  referrerDomain: string | null;
  queryString: string | null;
}

const CSV_HEADER = 'timestamp,deviceType,browser,os,country,region,referrerDomain,queryString';

export function escapeCsvField(value: string | null): string {
  if (value === null) {
    return '';
  }
  if (/^[=+\-@\t]/.test(value)) {
    value = `'${value}`;
  }
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Builds an RFC-4180 CSV (with header, CRLF line endings) from click rows. */
export function buildClicksCsv(rows: CsvClickRow[]): string {
  const lines = [CSV_HEADER];
  for (const row of rows) {
    lines.push([
      row.timestamp,
      row.deviceType,
      row.browser,
      row.os,
      row.country,
      row.region,
      row.referrerDomain,
      row.queryString,
    ].map(escapeCsvField).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}
