import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { join } from 'path';

// st-guardian is a standalone CommonJS service, so load its helpers the way it does.
const require = createRequire(import.meta.url);
const { parseOffset, dayWindow, uptimePct, fillDays, groupIncidents, formatDuration, overallColor } =
  require('../st-guardian/uptime.js');

const INTERVAL = 30000;

describe('st-guardian uptime: parseOffset', () => {
  it('defaults to UTC for missing or junk input', () => {
    expect(parseOffset(null)).toBe(0);
    expect(parseOffset('abc')).toBe(0);
  });

  it('accepts real offsets and clamps the rest', () => {
    expect(parseOffset('-360')).toBe(-360);
    expect(parseOffset('99999')).toBe(840);
    expect(parseOffset('-99999')).toBe(-840);
  });
});

describe('st-guardian uptime: dayWindow', () => {
  // 2026-11-22 03:00 UTC is still Nov 21 (9 PM) in CST
  const now = Date.parse('2026-11-22T03:00:00Z');

  it('ends on the UTC date when no offset is given', () => {
    const { dates, since } = dayWindow(now, 0, 60);
    expect(dates).toHaveLength(60);
    expect(dates[59]).toBe('2026-11-22');
    expect(dates[0]).toBe('2026-09-24');
    expect(since).toBe('2026-09-24 00:00:00');
  });

  it("ends on the viewer's local date and starts at their local midnight", () => {
    const { dates, since } = dayWindow(now, -360, 60);
    expect(dates[59]).toBe('2026-11-21');
    expect(dates[0]).toBe('2026-09-23');
    expect(since).toBe('2026-09-23 06:00:00');
  });
});

describe('st-guardian uptime: uptimePct / fillDays', () => {
  it('never reports 100% when a ping failed', () => {
    expect(uptimePct(172799, 172800)).toBe(99.99);
    expect(uptimePct(2880, 2880)).toBe(100);
    expect(uptimePct(0, 0)).toBeNull();
  });

  it('fills days without pings as no-data', () => {
    const days = fillDays([{ date: '2026-11-21', total: 2880, up: 2879 }], ['2026-11-20', '2026-11-21']);
    expect(days).toEqual([
      { date: '2026-11-20', total: 0, up: 0, pct: null },
      { date: '2026-11-21', total: 2880, up: 2879, pct: 99.96 },
    ]);
  });
});

describe('st-guardian uptime: groupIncidents', () => {
  it('returns nothing for no failures', () => {
    expect(groupIncidents([], INTERVAL)).toEqual([]);
  });

  it('counts a single failed ping as one interval, not zero seconds', () => {
    expect(groupIncidents(['2026-11-22 08:02:29'], INTERVAL)).toEqual([
      { start: '2026-11-22T08:02:29.000Z', end: '2026-11-22T08:02:59.000Z', duration: 30 },
    ]);
  });

  it('merges consecutive failures and splits on gaps, newest first', () => {
    const incidents = groupIncidents([
      '2026-11-13 06:19:11', '2026-11-13 06:19:41', '2026-11-13 06:20:11', '2026-11-13 06:20:41',
      '2026-11-15 08:01:41',
    ], INTERVAL);
    expect(incidents.map((i: { start: string; duration: number }) => [i.start, i.duration])).toEqual([
      ['2026-11-15T08:01:41.000Z', 30],
      ['2026-11-13T06:19:11.000Z', 120],
    ]);
  });
});

describe('st-guardian uptime: formatDuration', () => {
  it('formats without trailing spaces', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('is self-contained so it can be inlined into the uptime page', () => {
    expect(new Function(`return (${formatDuration.toString()})(90)`)()).toBe('1m 30s');
  });
});

describe('st-guardian uptime: overallColor', () => {
  it('is green from 99.9% up, yellow from 99%, red below', () => {
    expect(overallColor(100)).toBe('#0f766e');
    expect(overallColor(99.98)).toBe('#0f766e');
    expect(overallColor(99.9)).toBe('#0f766e');
    expect(overallColor(99.89)).toBe('#eab308');
    expect(overallColor(99)).toBe('#eab308');
    expect(overallColor(98.99)).toBe('#ef4444');
  });

  it('is self-contained so it can be inlined into the status page', () => {
    expect(new Function(`return (${overallColor.toString()})(99.98)`)()).toBe('#0f766e');
  });
});

describe('st-guardian routes', () => {
  const guardian = readFileSync(join(__dirname, '..', 'st-guardian', 'index.js'), 'utf8');
  const appRoute = readFileSync(join(__dirname, '..', 'app', 'api', 'guardian', 'update', 'route.ts'), 'utf8');

  it('serves the status page at /status and the JSON summary at /uptime', () => {
    expect(guardian).toContain("'GET /status': handleStatusPage");
    expect(guardian).toContain("'GET /status/data': handleStatusData");
    expect(guardian).toContain("'GET /uptime': handleUptime");
  });

  it('does not stop the app when guardian itself shuts down', () => {
    const start = guardian.indexOf('function shutdown(signal)');
    const shutdown = guardian.slice(start, guardian.indexOf("process.on('SIGTERM'"));
    expect(start).toBeGreaterThan(-1);
    expect(shutdown).not.toContain('service.sh');
    expect(shutdown).not.toContain('execScript');
  });

  it('the app reads guardian version info from the JSON route, not the HTML page', () => {
    expect(appRoute).toContain("targetPath = '/uptime'");
    expect(appRoute).not.toContain("targetPath = '/status'");
  });
});
