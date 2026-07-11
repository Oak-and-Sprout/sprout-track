import { describe, it, expect } from 'vitest';
import {
  groupBreastFeedSessions,
  countBreastFeedSessions,
} from '@/src/utils/feedSessionUtils';

// Issue #198: a nursing session using both sides is stored as two FeedLog rows
// (one per side); counting surfaces must treat the pair as one feed.
const at = (iso: string) => new Date(iso);

describe('groupBreastFeedSessions', () => {
  it('groups a timer-created left+right pair (identical time) into one session', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 480 },
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'RIGHT', feedDuration: 360 },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].leftDuration).toBe(480);
    expect(sessions[0].rightDuration).toBe(360);
    expect(sessions[0].totalDuration).toBe(840);
    expect(sessions[0].rows).toHaveLength(2);
  });

  it('groups separately-logged sides with a break in between (e.g. 20 minutes apart)', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 480 },
      { type: 'BREAST', time: at('2026-07-10T10:20:00Z'), side: 'RIGHT', feedDuration: 360 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(1);
  });

  it('does not merge feeds more than 30 minutes apart', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 480 },
      { type: 'BREAST', time: at('2026-07-10T10:31:00Z'), side: 'RIGHT', feedDuration: 360 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(2);
  });

  it('groups a session that spans midnight', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T23:50:00Z'), side: 'LEFT', feedDuration: 600 },
      { type: 'BREAST', time: at('2026-07-11T00:10:00Z'), side: 'RIGHT', feedDuration: 480 },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(1);
    // The session belongs to the day it started
    expect(sessions[0].time.toISOString()).toBe('2026-07-10T23:50:00.000Z');
    expect(sessions[0].totalDuration).toBe(1080);
  });

  it('falls back to amount (minutes) for older records without feedDuration', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', amount: 8 },
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'RIGHT', feedDuration: 360 },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].leftDuration).toBe(480);
    expect(sessions[0].rightDuration).toBe(360);
  });

  it('does not merge same-side feeds even when close together', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 300 },
      { type: 'BREAST', time: at('2026-07-10T10:00:30Z'), side: 'LEFT', feedDuration: 300 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(2);
  });

  it('counts a single-side feed as one session', () => {
    const rows = [{ type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 480 }];
    expect(countBreastFeedSessions(rows)).toBe(1);
  });

  it('never pairs rows without a side', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: null, feedDuration: 480 },
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'RIGHT', feedDuration: 360 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(2);
  });

  it('ignores non-BREAST rows', () => {
    const rows = [
      { type: 'BOTTLE', time: at('2026-07-10T10:00:00Z'), side: null },
      { type: 'SOLIDS', time: at('2026-07-10T11:00:00Z'), side: null },
      { type: 'BREAST', time: at('2026-07-10T12:00:00Z'), side: 'LEFT', feedDuration: 480 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(1);
  });

  it('handles a full day of mixed sessions in arbitrary order', () => {
    const rows = [
      // session 2: right only
      { type: 'BREAST', time: at('2026-07-10T14:00:00Z'), side: 'RIGHT', feedDuration: 600 },
      // session 1: both sides, 15 minutes apart
      { type: 'BREAST', time: at('2026-07-10T08:45:00Z'), side: 'RIGHT', feedDuration: 360 },
      { type: 'BREAST', time: at('2026-07-10T08:30:00Z'), side: 'LEFT', feedDuration: 480 },
      // session 3: both sides via timer
      { type: 'BREAST', time: at('2026-07-10T18:15:10Z'), side: 'LEFT', feedDuration: 420 },
      { type: 'BREAST', time: at('2026-07-10T18:15:10Z'), side: 'RIGHT', feedDuration: 300 },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(3);
    // sorted by time
    expect(sessions[0].totalDuration).toBe(840);
    expect(sessions[1].rightDuration).toBe(600);
    expect(sessions[2].totalDuration).toBe(720);
  });

  it('accepts string timestamps (client-side activity objects)', () => {
    const rows = [
      { type: 'BREAST', time: '2026-07-10T10:00:00.000Z', side: 'LEFT', feedDuration: 480 },
      { type: 'BREAST', time: '2026-07-10T10:00:00.000Z', side: 'RIGHT', feedDuration: 360 },
    ];
    expect(countBreastFeedSessions(rows)).toBe(1);
  });

  it('returns an empty list for no feeds', () => {
    expect(groupBreastFeedSessions([])).toEqual([]);
  });
});

describe('explicit sessionId linking', () => {
  it('groups rows sharing a sessionId regardless of time gap', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 120, sessionId: 's1' },
      { type: 'BREAST', time: at('2026-07-10T11:30:00Z'), side: 'RIGHT', feedDuration: 600, sessionId: 's1' },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].sessionId).toBe('s1');
    expect(sessions[0].totalDuration).toBe(720);
  });

  it("supports the user's three-feed example: left 2m + right 10m + separate 5m all linked", () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 120, sessionId: 's1' },
      { type: 'BREAST', time: at('2026-07-10T10:05:00Z'), side: 'RIGHT', feedDuration: 600, sessionId: 's1' },
      { type: 'BREAST', time: at('2026-07-10T10:45:00Z'), side: 'LEFT', feedDuration: 300, sessionId: 's1' },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].rows).toHaveLength(3);
    expect(sessions[0].leftDuration).toBe(420);
    expect(sessions[0].rightDuration).toBe(600);
  });

  it('a unique sessionId is a deliberate singleton: an unlinked feed never re-merges heuristically', () => {
    const rows = [
      // These two would merge under the 30-min heuristic, but the user unlinked them
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 480, sessionId: 'solo-1' },
      { type: 'BREAST', time: at('2026-07-10T10:05:00Z'), side: 'RIGHT', feedDuration: 360, sessionId: 'solo-2' },
    ];
    expect(countBreastFeedSessions(rows)).toBe(2);
  });

  it('linked rows never absorb nearby unlinked rows; unlinked rows still pair heuristically', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T10:00:00Z'), side: 'LEFT', feedDuration: 120, sessionId: 's1' },
      { type: 'BREAST', time: at('2026-07-10T10:02:00Z'), side: 'RIGHT', feedDuration: 600, sessionId: 's1' },
      // Legacy rows without sessionId, close to the linked pair
      { type: 'BREAST', time: at('2026-07-10T10:10:00Z'), side: 'LEFT', feedDuration: 300 },
      { type: 'BREAST', time: at('2026-07-10T10:20:00Z'), side: 'RIGHT', feedDuration: 200 },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionId).toBe('s1');
    expect(sessions[1].sessionId).toBeNull();
    expect(sessions[1].rows).toHaveLength(2);
  });

  it('sessions are sorted by start time across linked and heuristic groups', () => {
    const rows = [
      { type: 'BREAST', time: at('2026-07-10T14:00:00Z'), side: 'LEFT', feedDuration: 300 },
      { type: 'BREAST', time: at('2026-07-10T08:00:00Z'), side: 'RIGHT', feedDuration: 300, sessionId: '早' },
    ];
    const sessions = groupBreastFeedSessions(rows);
    expect(sessions[0].sessionId).toBe('早');
    expect(sessions[1].sessionId).toBeNull();
  });
});
