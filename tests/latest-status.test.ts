import { describe, it, expect } from 'vitest';
import {
  computeLatestStatus,
  effectiveFeedTime,
  elapsedMinutes,
  formatDurationLabel,
  isPastWarning,
  isWithinStatusWindow,
  warningTimeToMinutes,
} from '@/src/utils/latestStatus';

const bottle = (id: string, time: string, bottleType: string | null = 'Formula') =>
  ({ id, type: 'BOTTLE', bottleType, amount: 4, time, startTime: null, endTime: null, sessionId: null, side: null });
const breast = (id: string, side: string, startTime: string, endTime: string, sessionId: string | null = null) =>
  ({ id, type: 'BREAST', bottleType: null, amount: null, side, time: endTime, startTime, endTime, sessionId, feedDuration: 600 });
const food = (id: string, time: string) => ({ id, foodId: 'f1', time, enjoyment: null });
const sleep = (id: string, startTime: string, endTime: string | null) =>
  ({ id, type: 'NAP', startTime, endTime, duration: endTime ? 60 : null, location: 'Crib' });

describe('computeLatestStatus — feeds', () => {
  it('returns nothing for no activities', () => {
    expect(computeLatestStatus([], null)).toEqual({ lastPumpTime: undefined });
  });

  it('picks the most recent counted feed', () => {
    const s = computeLatestStatus([bottle('a', '2026-10-12T08:00:00Z'), bottle('b', '2026-10-12T11:00:00Z')], null);
    expect(s.lastFeedTime?.toISOString()).toBe('2026-10-12T11:00:00.000Z');
    expect(s.lastFeedEndTime).toBeUndefined();
  });

  it('skips feeds of excluded types (feedTimerTypes)', () => {
    const acts = [bottle('formula', '2026-10-12T11:00:00Z', 'Formula'), bottle('milk', '2026-10-12T09:00:00Z', 'Breast Milk')];
    const s = computeLatestStatus(acts, ['BOTTLE_BREAST_MILK']);
    expect(s.lastFeedTime?.toISOString()).toBe('2026-10-12T09:00:00.000Z');
  });

  it('returns no feed when every feed is excluded', () => {
    expect(computeLatestStatus([bottle('a', '2026-10-12T11:00:00Z')], ['BREAST']).lastFeedTime).toBeUndefined();
  });

  it('counts food only when FOOD is a timer category (or all feeds count)', () => {
    const acts = [bottle('a', '2026-10-12T08:00:00Z'), food('f', '2026-10-12T12:00:00Z')];
    expect(computeLatestStatus(acts, null).lastFeedTime?.toISOString()).toBe('2026-10-12T12:00:00.000Z');
    expect(computeLatestStatus(acts, ['BOTTLE_FORMULA']).lastFeedTime?.toISOString()).toBe('2026-10-12T08:00:00.000Z');
    expect(computeLatestStatus(acts, ['FOOD']).lastFeedTime?.toISOString()).toBe('2026-10-12T12:00:00.000Z');
  });

  it('times a linked breast session from its first start to its last end', () => {
    const acts = [
      breast('l', 'LEFT', '2026-10-12T10:00:00Z', '2026-10-12T10:10:00Z', 's1'),
      breast('r', 'RIGHT', '2026-10-12T10:12:00Z', '2026-10-12T10:25:00Z', 's1'),
    ];
    const s = computeLatestStatus(acts, null);
    expect(s.lastFeedTime?.toISOString()).toBe('2026-10-12T10:00:00.000Z');
    expect(s.lastFeedEndTime?.toISOString()).toBe('2026-10-12T10:25:00.000Z');
  });
});

describe('computeLatestStatus — sleep', () => {
  it('reports an ongoing sleep and the last completed one', () => {
    const acts = [sleep('old', '2026-10-12T06:00:00Z', '2026-10-12T07:00:00Z'), sleep('now', '2026-10-12T12:00:00Z', null)];
    const s = computeLatestStatus(acts, null);
    expect(s.ongoingSleep?.id).toBe('now');
    expect(s.lastSleepEndTime?.toISOString()).toBe('2026-10-12T07:00:00.000Z');
  });

  it('uses the latest end time among completed sleeps', () => {
    const acts = [sleep('a', '2026-10-12T06:00:00Z', '2026-10-12T07:00:00Z'), sleep('b', '2026-10-12T09:00:00Z', '2026-10-12T10:30:00Z')];
    const s = computeLatestStatus(acts, null);
    expect(s.ongoingSleep).toBeUndefined();
    expect(s.lastSleepEndTime?.toISOString()).toBe('2026-10-12T10:30:00.000Z');
    expect(s.lastEndedSleep?.id).toBe('b');
  });

  it('does not mistake feeds or food for sleep', () => {
    const s = computeLatestStatus([breast('l', 'LEFT', '2026-10-12T10:00:00Z', '2026-10-12T10:10:00Z'), food('f', '2026-10-12T12:00:00Z')], null);
    expect(s.ongoingSleep).toBeUndefined();
    expect(s.lastSleepEndTime).toBeUndefined();
  });
});

describe('effectiveFeedTime', () => {
  const start = new Date('2026-10-12T10:00:00Z');
  const end = new Date('2026-10-12T10:25:00Z');
  it('uses the start by default', () => {
    expect(effectiveFeedTime(start, end, 'start')).toBe(start);
    expect(effectiveFeedTime(start, end, undefined)).toBe(start);
  });
  it('uses the end when feedTimerFrom is "end" and an end exists', () => {
    expect(effectiveFeedTime(start, end, 'end')).toBe(end);
  });
  it('falls back to the start when there is no end time (e.g. bottle)', () => {
    expect(effectiveFeedTime(start, undefined, 'end')).toBe(start);
  });
  it('returns undefined without a feed', () => {
    expect(effectiveFeedTime(undefined, undefined, 'end')).toBeUndefined();
  });
});

describe('warning thresholds', () => {
  it('parses hh:mm', () => {
    expect(warningTimeToMinutes('03:00')).toBe(180);
    expect(warningTimeToMinutes('1:30')).toBe(90);
  });
  it('rejects empty or malformed values', () => {
    expect(warningTimeToMinutes(undefined)).toBeNull();
    expect(warningTimeToMinutes('')).toBeNull();
    expect(warningTimeToMinutes('abc')).toBeNull();
  });
  it('warns at exactly the threshold, not before', () => {
    expect(isPastWarning(179, '03:00')).toBe(false);
    expect(isPastWarning(180, '03:00')).toBe(true);
    expect(isPastWarning(500, null)).toBe(false);
  });
});

describe('elapsedMinutes / isWithinStatusWindow', () => {
  it('floors whole minutes', () => {
    expect(elapsedMinutes(new Date('2026-10-12T10:00:00Z'), new Date('2026-10-12T10:59:59Z'))).toBe(59);
  });
  it('measures real elapsed time across a DST change', () => {
    // US fall-back: 2026-11-01 01:30 EDT -> 01:30 EST is one wall-clock repeat, 60 real minutes
    expect(elapsedMinutes(new Date('2026-11-01T05:30:00Z'), new Date('2026-11-01T06:30:00Z'))).toBe(60);
  });
  it('treats 24 h or more as outside the window', () => {
    expect(isWithinStatusWindow(1439)).toBe(true);
    expect(isWithinStatusWindow(1440)).toBe(false);
  });
});

describe('formatDurationLabel', () => {
  const t = (k: string) => k;
  it('speaks hours and minutes with singular/plural units', () => {
    expect(formatDurationLabel(83, t)).toBe('1 hour 23 minutes');
    expect(formatDurationLabel(121, t)).toBe('2 hours 1 minute');
    expect(formatDurationLabel(5, t)).toBe('5 minutes');
  });
});
