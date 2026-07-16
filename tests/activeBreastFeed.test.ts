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

import { startBreastfeedSession } from '@/app/api/utils/activeBreastFeed';

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
