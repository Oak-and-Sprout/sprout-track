'use strict';

// Pure uptime math for st-guardian. Unit tested in tests/guardian-uptime.test.ts.

const DAY_MS = 86400000;

// Viewer's UTC offset in minutes east of UTC (e.g. -360 for CST), clamped to real-world offsets
function parseOffset(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? Math.max(-840, Math.min(840, n)) : 0;
}

// The `count` calendar days ending today in the viewer's timezone (oldest first), and the
// UTC instant the oldest one starts, formatted like the health_pings.timestamp column.
function dayWindow(nowMs, offsetMin, count) {
  const todayStart = Math.floor((nowMs + offsetMin * 60000) / DAY_MS) * DAY_MS;
  const dates = [];
  for (let i = count - 1; i >= 0; i--) {
    dates.push(new Date(todayStart - i * DAY_MS).toISOString().slice(0, 10));
  }
  const sinceMs = todayStart - (count - 1) * DAY_MS - offsetMin * 60000;
  return { dates, since: new Date(sinceMs).toISOString().slice(0, 19).replace('T', ' ') };
}

// Floored, not rounded: a window containing any failed ping must never read 100%
function uptimePct(up, total) {
  return total > 0 ? Math.floor((up / total) * 10000) / 100 : null;
}

function fillDays(rows, dates) {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return dates.map((date) => {
    const r = byDate.get(date);
    return r
      ? { date, total: r.total, up: r.up, pct: uptimePct(r.up, r.total) }
      : { date, total: 0, up: 0, pct: null };
  });
}

// Group failed pings (ascending 'YYYY-MM-DD HH:MM:SS' UTC strings) into incidents, newest first.
// Each failed ping stands for one health interval of downtime, so a single failure lasts one
// interval rather than zero seconds.
function groupIncidents(timestamps, intervalMs) {
  const maxGap = intervalMs * 2.5;
  const incidents = [];
  let start = null;
  let last = null;
  const close = () => incidents.push({
    start: new Date(start).toISOString(),
    end: new Date(last + intervalMs).toISOString(),
    duration: Math.round((last - start + intervalMs) / 1000),
  });

  for (const t of timestamps) {
    const ts = Date.parse(t.replace(' ', 'T') + 'Z');
    if (start !== null && ts - last > maxGap) {
      close();
      start = null;
    }
    if (start === null) start = ts;
    last = ts;
  }
  if (start !== null) close();
  return incidents.reverse();
}

// Also inlined into the uptime page via toString(), so it must stay self-contained
function formatDuration(seconds) {
  if (seconds < 60) return seconds + 's';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return m + 'm' + (s ? ' ' + s + 's' : '');
  const rm = m % 60;
  return Math.floor(m / 60) + 'h' + (rm ? ' ' + rm + 'm' : '');
}

module.exports = { parseOffset, dayWindow, uptimePct, fillDays, groupIncidents, formatDuration };
