// tests/shortLinkUtils.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseUserAgent, isValidDestinationUrl, mergeQueryParams, computeVisitorHash,
  utcDayString, extractReferrerDomain, bytesToSlug, getClientIp, getCountry,
  aggregateClicks, buildClicksCsv,
} from '@/src/utils/short-link-utils';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CHROME_WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const BOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('parseUserAgent', () => {
  it('detects iPhone Safari as mobile/Safari/iOS', () => {
    expect(parseUserAgent(IPHONE_UA)).toEqual({ deviceType: 'mobile', browser: 'Safari', os: 'iOS' });
  });
  it('detects Windows Chrome desktop', () => {
    expect(parseUserAgent(CHROME_WIN_UA)).toEqual({ deviceType: 'desktop', browser: 'Chrome', os: 'Windows' });
  });
  it('detects Android Chrome mobile', () => {
    expect(parseUserAgent(ANDROID_UA)).toEqual({ deviceType: 'mobile', browser: 'Chrome', os: 'Android' });
  });
  it('detects iPad as tablet', () => {
    expect(parseUserAgent(IPAD_UA).deviceType).toBe('tablet');
  });
  it('detects bots', () => {
    expect(parseUserAgent(BOT_UA).deviceType).toBe('bot');
  });
  it('handles null/empty/garbage', () => {
    expect(parseUserAgent(null)).toEqual({ deviceType: 'unknown', browser: null, os: null });
    expect(parseUserAgent('')).toEqual({ deviceType: 'unknown', browser: null, os: null });
    expect(parseUserAgent('lol not a ua').deviceType).toBe('desktop');
  });
  it('detects browser/os buckets case-insensitively', () => {
    expect(parseUserAgent('mozilla/5.0 (windows nt 10.0) chrome/126.0')).toEqual(
      expect.objectContaining({ browser: 'Chrome', os: 'Windows' }),
    );
  });
});

describe('isValidDestinationUrl', () => {
  it('accepts http/https absolute URLs', () => {
    expect(isValidDestinationUrl('https://sprout-track.com/pricing')).toBe(true);
    expect(isValidDestinationUrl('http://example.com')).toBe(true);
  });
  it('rejects dangerous or relative values', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.com', '/pricing', '', 'not a url']) {
      expect(isValidDestinationUrl(bad)).toBe(false);
    }
  });
});

describe('mergeQueryParams', () => {
  it('appends incoming params', () => {
    expect(mergeQueryParams('https://x.com/p', '?utm_source=qr&utm_medium=print'))
      .toBe('https://x.com/p?utm_source=qr&utm_medium=print');
  });
  it('destination param wins on conflict', () => {
    expect(mergeQueryParams('https://x.com/p?utm_source=site', '?utm_source=qr&b=2'))
      .toBe('https://x.com/p?utm_source=site&b=2');
  });
  it('handles empty incoming query and preserves fragment', () => {
    expect(mergeQueryParams('https://x.com/p#frag', '')).toBe('https://x.com/p#frag');
    expect(mergeQueryParams('https://x.com/p#frag', '?a=1')).toBe('https://x.com/p?a=1#frag');
  });
});

describe('computeVisitorHash', () => {
  it('is deterministic and 16 hex chars', () => {
    const h = computeVisitorHash('1.2.3.4', 'ua', '2026-07-31', 's3cret');
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(computeVisitorHash('1.2.3.4', 'ua', '2026-07-31', 's3cret')).toBe(h);
  });
  it('changes across days (daily rotation)', () => {
    expect(computeVisitorHash('1.2.3.4', 'ua', '2026-07-31', 's'))
      .not.toBe(computeVisitorHash('1.2.3.4', 'ua', '2026-08-01', 's'));
  });
});

describe('utcDayString / extractReferrerDomain / bytesToSlug', () => {
  it('formats UTC day', () => {
    expect(utcDayString(new Date('2026-07-31T23:59:59Z'))).toBe('2026-07-31');
    expect(utcDayString(new Date('2026-01-05T00:00:00Z'))).toBe('2026-01-05');
  });
  it('extracts referrer domain', () => {
    expect(extractReferrerDomain('https://www.Reddit.com/r/x?y=1')).toBe('www.reddit.com');
    expect(extractReferrerDomain('garbage')).toBeNull();
    expect(extractReferrerDomain(null)).toBeNull();
  });
  it('encodes 4 bytes to 8 hex chars', () => {
    expect(bytesToSlug(new Uint8Array([0xa1, 0xb2, 0xc3, 0xd4]))).toBe('a1b2c3d4');
    expect(bytesToSlug(new Uint8Array([0, 1, 2, 3, 99]))).toBe('00010203');
  });
});

describe('getClientIp / getCountry', () => {
  it('reads forwarded-for first hop', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
    expect(getClientIp(new Headers({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(getClientIp(new Headers())).toBeNull();
  });
  it('reads CDN country headers', () => {
    expect(getCountry(new Headers({ 'cf-ipcountry': 'us' }))).toEqual({ country: 'US', region: null });
    expect(getCountry(new Headers({ 'cf-ipcountry': 'XX' })).country).toBeNull();
    expect(getCountry(new Headers())).toEqual({ country: null, region: null });
  });
});

describe('aggregateClicks', () => {
  const row = (day: string, hash: string | null, extra: Partial<import('@/src/utils/short-link-utils').ClickRowLite> = {}) => ({
    timestamp: new Date(`${day}T12:00:00Z`),
    visitorHash: hash,
    deviceType: 'mobile', browser: 'Safari', os: 'iOS', country: 'US', referrerDomain: null,
    ...extra,
  });
  it('zero-fills days and counts uniques per day', () => {
    const agg = aggregateClicks(
      [row('2026-07-01', 'aaa'), row('2026-07-01', 'aaa'), row('2026-07-03', 'bbb')],
      new Date('2026-07-01T00:00:00Z'), new Date('2026-07-03T23:59:59Z'),
    );
    expect(agg.series).toEqual([
      { date: '2026-07-01', clicks: 2, uniques: 1 },
      { date: '2026-07-02', clicks: 0, uniques: 0 },
      { date: '2026-07-03', clicks: 1, uniques: 1 },
    ]);
    expect(agg.totals).toEqual({ clicks: 3, uniques: 2 });
  });
  it('builds sorted breakdowns and skips nulls', () => {
    const agg = aggregateClicks(
      [row('2026-07-01', 'a'), row('2026-07-01', 'b', { deviceType: 'desktop' }), row('2026-07-01', 'c', { deviceType: 'desktop', country: null })],
      new Date('2026-07-01T00:00:00Z'), new Date('2026-07-01T23:59:59Z'),
    );
    expect(agg.breakdowns.deviceType).toEqual([{ value: 'desktop', count: 2 }, { value: 'mobile', count: 1 }]);
    expect(agg.breakdowns.country).toEqual([{ value: 'US', count: 2 }]);
  });
  it('handles empty rows', () => {
    const agg = aggregateClicks([], new Date('2026-07-01T00:00:00Z'), new Date('2026-07-01T23:59:59Z'));
    expect(agg.series).toEqual([{ date: '2026-07-01', clicks: 0, uniques: 0 }]);
    expect(agg.totals).toEqual({ clicks: 0, uniques: 0 });
  });
});

describe('buildClicksCsv', () => {
  it('escapes and joins rows', () => {
    const csv = buildClicksCsv([
      { timestamp: '2026-07-31T12:00:00.000Z', deviceType: 'mobile', browser: 'Safari', os: 'iOS', country: 'US', region: null, referrerDomain: 'a,b.com', queryString: 'utm="x"' },
    ]);
    expect(csv).toBe(
      'timestamp,deviceType,browser,os,country,region,referrerDomain,queryString\r\n' +
      '2026-07-31T12:00:00.000Z,mobile,Safari,iOS,US,,"a,b.com","utm=""x"""\r\n'
    );
  });
  it('handles empty input (header only)', () => {
    expect(buildClicksCsv([])).toBe('timestamp,deviceType,browser,os,country,region,referrerDomain,queryString\r\n');
  });
  it('quotes a field containing a bare carriage return', () => {
    const csv = buildClicksCsv([
      { timestamp: '2026-07-31T12:00:00.000Z', deviceType: 'mobile', browser: 'Safari', os: 'iOS', country: 'US', region: null, referrerDomain: 'a\rb.com', queryString: null },
    ]);
    expect(csv).toBe(
      'timestamp,deviceType,browser,os,country,region,referrerDomain,queryString\r\n' +
      '2026-07-31T12:00:00.000Z,mobile,Safari,iOS,US,,"a\rb.com",\r\n'
    );
  });
});
