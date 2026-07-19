import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createSession } = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

vi.mock('@/app/api/db', () => ({
  default: {
    activeBreastFeed: {
      create: createSession,
    },
  },
}));

vi.mock('@/src/lib/notifications/activityHook', () => ({
  notifyActivityCreated: vi.fn(),
  resetTimerNotificationState: vi.fn(),
}));

import {
  startBreastfeedSession,
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
