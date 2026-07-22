import { describe, it, expect } from 'vitest';
import { applySessionAction, ActiveBreastFeedState } from '@/src/utils/feedSessionActions';

const at = (iso: string) => new Date(iso);

function makeSession(overrides: Partial<ActiveBreastFeedState> = {}): ActiveBreastFeedState {
  return {
    activeSide: 'LEFT',
    isPaused: false,
    leftDuration: 0,
    rightDuration: 0,
    pauseDuration: 0,
    pausedAt: null,
    firstSide: 'LEFT',
    currentSideStartTime: at('2026-07-20T21:00:00Z'),
    ...overrides,
  };
}

describe('applySessionAction — pause accumulation', () => {
  it('pause sets pausedAt and stops currentSideStartTime', () => {
    const session = makeSession({ leftDuration: 0 });
    const now = at('2026-07-20T21:10:00Z');
    const result = applySessionAction(session, 'pause', now);
    expect(result).toMatchObject({
      isPaused: true,
      pausedAt: now,
      currentSideStartTime: null,
      leftDuration: 600,
    });
  });

  it('pause while already paused is a no-op (preserves original pausedAt)', () => {
    const originalPausedAt = at('2026-07-20T21:10:00Z');
    const session = makeSession({
      leftDuration: 600,
      isPaused: true,
      pausedAt: originalPausedAt,
      currentSideStartTime: null,
    });
    const now = at('2026-07-20T21:15:00Z');
    const result = applySessionAction(session, 'pause', now);
    expect(result).toEqual({});
  });

  it('resume adds the pause gap to pauseDuration and clears pausedAt', () => {
    const session = makeSession({
      leftDuration: 600,
      isPaused: true,
      pausedAt: at('2026-07-20T21:10:00Z'),
      currentSideStartTime: null,
    });
    const now = at('2026-07-20T21:12:00Z');
    const result = applySessionAction(session, 'resume', now);
    expect(result).toMatchObject({
      isPaused: false,
      pausedAt: null,
      currentSideStartTime: now,
      pauseDuration: 120,
    });
  });

  it('switch while paused accumulates the pause duration before switching', () => {
    const session = makeSession({
      leftDuration: 600,
      isPaused: true,
      pausedAt: at('2026-07-20T21:10:00Z'),
      currentSideStartTime: null,
    });
    const now = at('2026-07-20T21:12:00Z');
    const result = applySessionAction(session, 'switch', now);
    expect(result).toMatchObject({
      activeSide: 'RIGHT',
      isPaused: false,
      pausedAt: null,
      pauseDuration: 120,
      leftDuration: 600,
      rightDuration: 0,
    });
  });

  it('pause while not paused does not add to pauseDuration', () => {
    const session = makeSession({ leftDuration: 300, currentSideStartTime: at('2026-07-20T21:05:00Z') });
    const now = at('2026-07-20T21:10:00Z');
    const result = applySessionAction(session, 'pause', now);
    expect(result!.pauseDuration).toBeUndefined();
    expect(result!.leftDuration).toBe(600);
  });
});

describe('applySessionAction — switch', () => {
  it('accumulates elapsed time on the active side before switching', () => {
    const session = makeSession({ currentSideStartTime: at('2026-07-20T21:00:00Z') });
    const now = at('2026-07-20T21:10:00Z');
    const result = applySessionAction(session, 'switch', now);
    expect(result).toMatchObject({
      activeSide: 'RIGHT',
      leftDuration: 600,
      rightDuration: 0,
      isPaused: false,
      currentSideStartTime: now,
    });
  });
});

describe('applySessionAction — swap flips firstSide', () => {
  it('flips firstSide from LEFT to RIGHT and swaps durations', () => {
    const now = at('2026-07-20T21:05:00Z');
    const session = makeSession({
      leftDuration: 300,
      rightDuration: 0,
      firstSide: 'LEFT',
      currentSideStartTime: now,
    });
    const result = applySessionAction(session, 'swap', now);
    expect(result!.firstSide).toBe('RIGHT');
    expect(result!.leftDuration).toBe(0);
    expect(result!.rightDuration).toBe(300);
  });

  it('preserves null firstSide (legacy session)', () => {
    const now = at('2026-07-20T21:05:00Z');
    const session = makeSession({ firstSide: null, currentSideStartTime: now });
    const result = applySessionAction(session, 'swap', now);
    expect(result!.firstSide).toBeNull();
  });
});

describe('applySessionAction — resume can switch side', () => {
  it('resumes on a different side when resumeSide is provided', () => {
    const session = makeSession({ isPaused: true, pausedAt: at('2026-07-20T21:10:00Z'), currentSideStartTime: null });
    const now = at('2026-07-20T21:12:00Z');
    const result = applySessionAction(session, 'resume', now, 'RIGHT');
    expect(result!.activeSide).toBe('RIGHT');
  });
});
