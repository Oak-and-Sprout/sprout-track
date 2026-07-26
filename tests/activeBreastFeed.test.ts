import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSession, deleteSession, createFeedLog } = vi.hoisted(() => ({
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  createFeedLog: vi.fn(),
}));

vi.mock('@/app/api/db', () => ({
  default: {
    activeBreastFeed: {
      create: createSession,
      delete: deleteSession,
    },
    feedLog: {
      create: createFeedLog,
    },
  },
}));

vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: vi.fn().mockResolvedValue(undefined),
  resetTimerNotificationState: vi.fn().mockResolvedValue(undefined),
}));

import {
  startBreastfeedSession,
  endBreastfeedSession,
  resolveRequestedStartTime,
  START_TIME_CLOCK_SKEW_MS,
} from '@/app/api/utils/activeBreastFeed';

describe('startBreastfeedSession', () => {
  beforeEach(() => {
    createSession.mockResolvedValue({ id: 'session-1' });
  });

  it('uses a requested time for the active timer and session start', async () => {
    const requestedStartTime = new Date('2020-01-02T03:04:05.000Z');

    await startBreastfeedSession({
      babyId: 'baby-1',
      side: 'LEFT',
      familyId: 'family-1',
      startTime: requestedStartTime,
    });

    expect(createSession).toHaveBeenCalledWith({
      data: expect.objectContaining({
        currentSideStartTime: requestedStartTime,
        sessionStartTime: requestedStartTime,
      }),
    });
  });
});

// Issue #240: each row's `time` must be its own side's start time, not the
// moment the session ended — the linked-session list displays `time`, and
// re-saving from the edit form writes startTime into `time`, so a session-end
// stamp made the two paths disagree.
describe('endBreastfeedSession', () => {
  beforeEach(() => {
    let nextId = 0;
    createFeedLog.mockReset();
    createFeedLog.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `log-${++nextId}`,
      ...data,
    }));
    deleteSession.mockReset();
    deleteSession.mockResolvedValue({});
  });

  it('stamps each FeedLog time with that side\'s start time', async () => {
    const sessionStartTime = new Date('2026-07-22T12:00:00.000Z');
    const session = {
      id: 'session-1',
      babyId: 'baby-1',
      activeSide: 'RIGHT',
      isPaused: false,
      leftDuration: 120,
      rightDuration: 60,
      pauseDuration: 30,
      pausedAt: null,
      firstSide: 'LEFT',
      currentSideStartTime: null,
      sessionStartTime,
      familyId: 'family-1',
      caretakerId: 'caretaker-1',
    };

    await endBreastfeedSession(session as any, { familyId: 'family-1' });

    expect(createFeedLog).toHaveBeenCalledTimes(2);
    const rows = createFeedLog.mock.calls.map(([arg]) => arg.data);
    const left = rows.find(r => r.side === 'LEFT')!;
    const right = rows.find(r => r.side === 'RIGHT')!;

    // First side starts at the session start; second side starts after the
    // first side's duration plus the pause gap.
    expect(left.time).toEqual(sessionStartTime);
    expect(left.time).toEqual(left.startTime);
    expect(right.time).toEqual(new Date('2026-07-22T12:02:30.000Z'));
    expect(right.time).toEqual(right.startTime);
  });

  it('stamps a single-side session with the session start time', async () => {
    const sessionStartTime = new Date('2026-07-22T08:00:00.000Z');
    const session = {
      id: 'session-2',
      babyId: 'baby-1',
      activeSide: 'LEFT',
      isPaused: false,
      leftDuration: 300,
      rightDuration: 0,
      pauseDuration: 0,
      pausedAt: null,
      firstSide: 'LEFT',
      currentSideStartTime: null,
      sessionStartTime,
      familyId: 'family-1',
      caretakerId: null,
    };

    await endBreastfeedSession(session as any, { familyId: 'family-1' });

    expect(createFeedLog).toHaveBeenCalledTimes(1);
    const [{ data }] = createFeedLog.mock.calls[0];
    expect(data.time).toEqual(sessionStartTime);
    expect(data.time).toEqual(data.startTime);
  });
});

describe('resolveRequestedStartTime', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('accepts an omitted start time (server assigns now downstream)', () => {
    expect(resolveRequestedStartTime(undefined, now)).toEqual({ ok: true });
  });

  it('accepts a past timestamp unchanged', () => {
    const past = '2026-07-19T11:00:00.000Z';
    expect(resolveRequestedStartTime(past, now)).toEqual({
      ok: true,
      startTime: new Date(past),
    });
  });

  it('rejects non-string and empty inputs', () => {
    for (const bad of [123, {}, [], '', '   ', null]) {
      expect(resolveRequestedStartTime(bad, now)).toEqual({
        ok: false,
        error: 'Start time must be a valid date',
      });
    }
  });

  it('rejects unparseable date strings', () => {
    expect(resolveRequestedStartTime('not-a-date', now)).toEqual({
      ok: false,
      error: 'Start time must be a valid date',
    });
  });

  it('clamps near-future timestamps (clock skew) to server now', () => {
    const slightlyFuture = new Date(now.getTime() + 30_000).toISOString();
    expect(resolveRequestedStartTime(slightlyFuture, now)).toEqual({
      ok: true,
      startTime: now,
    });
    const atLimit = new Date(now.getTime() + START_TIME_CLOCK_SKEW_MS).toISOString();
    expect(resolveRequestedStartTime(atLimit, now)).toEqual({
      ok: true,
      startTime: now,
    });
  });

  it('rejects timestamps beyond the skew window', () => {
    const tooFar = new Date(now.getTime() + START_TIME_CLOCK_SKEW_MS + 1_000).toISOString();
    expect(resolveRequestedStartTime(tooFar, now)).toEqual({
      ok: false,
      error: 'Start time cannot be in the future',
    });
  });
});
