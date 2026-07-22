import { randomUUID } from 'crypto';
import { ActiveBreastFeed, BreastSide } from '@prisma/client';
import prisma from '../db';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';
import { layoutBreastFeedSession } from '@/src/utils/feedSessionLayout';
import { applySessionAction as pureApply, ActiveBreastFeedState } from '@/src/utils/feedSessionActions';

/**
 * Shared active breastfeed session logic used by both the internal
 * /api/active-breastfeed route (JWT auth) and the external hooks API
 * (/api/hooks/v1, API-key auth) so timer behavior is identical
 * regardless of which surface starts, updates, or ends a session.
 */

export type SessionUpdateAction = 'switch' | 'pause' | 'resume' | 'swap';

export const SESSION_UPDATE_ACTIONS: SessionUpdateAction[] = ['switch', 'pause', 'resume', 'swap'];

export interface StartSessionParams {
  babyId: string;
  side: BreastSide;
  familyId: string;
  caretakerId?: string | null;
  startTime?: Date;
}

/** Client clocks drift; treat timestamps up to this far in the future as "now". */
export const START_TIME_CLOCK_SKEW_MS = 2 * 60 * 1000;

export type StartTimeResolution =
  | { ok: true; startTime?: Date }
  | { ok: false; error: string };

/**
 * Validate a client-requested session start time. Omitted input is fine
 * (caller defaults to now); malformed input is rejected; timestamps within
 * START_TIME_CLOCK_SKEW_MS of the future are clamped to server now, and
 * anything further ahead is rejected.
 */
export function resolveRequestedStartTime(
  requested: unknown,
  now: Date = new Date()
): StartTimeResolution {
  if (requested === undefined) return { ok: true };
  if (typeof requested !== 'string' || !requested.trim()) {
    return { ok: false, error: 'Start time must be a valid date' };
  }
  const parsed = new Date(requested);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'Start time must be a valid date' };
  }
  const aheadMs = parsed.getTime() - now.getTime();
  if (aheadMs > START_TIME_CLOCK_SKEW_MS) {
    return { ok: false, error: 'Start time cannot be in the future' };
  }
  return { ok: true, startTime: aheadMs > 0 ? now : parsed };
}

/**
 * Creates a new active session. Callers should check for an existing session
 * first; a concurrent start still races on the babyId unique constraint, so
 * catch Prisma P2002 and treat it as "already active".
 */
export async function startBreastfeedSession({ babyId, side, familyId, caretakerId, startTime }: StartSessionParams): Promise<ActiveBreastFeed> {
  const sessionStartTime = startTime ?? new Date();
  return prisma.activeBreastFeed.create({
    data: {
      babyId,
      activeSide: side,
      isPaused: false,
      leftDuration: 0,
      rightDuration: 0,
      pauseDuration: 0,
      pausedAt: null,
      firstSide: side,
      currentSideStartTime: sessionStartTime,
      sessionStartTime,
      familyId,
      caretakerId,
    },
  });
}

/**
 * Adapts a DB session row to the pure, unit-tested state machine in
 * src/utils/feedSessionActions.
 */
export function applySessionAction(
  session: ActiveBreastFeed,
  action: SessionUpdateAction,
  now: Date,
  resumeSide?: BreastSide
) {
  const state: ActiveBreastFeedState = {
    activeSide: session.activeSide,
    isPaused: session.isPaused,
    leftDuration: session.leftDuration,
    rightDuration: session.rightDuration,
    pauseDuration: session.pauseDuration,
    pausedAt: session.pausedAt,
    firstSide: session.firstSide,
    currentSideStartTime: session.currentSideStartTime,
  };
  return pureApply(state, action, now, resumeSide);
}

/**
 * Applies a timer action to a session and returns the updated record.
 * - switch: accumulate time on current side, start timing the other side
 * - pause: accumulate time on current side, stop timing
 * - resume: start timing again (optionally on a given side)
 * - swap: reassign all accrued time to the opposite side (corrects starting
 *   the timer on the wrong side); running/paused state is preserved
 * Returns null for an unknown action.
 */
export async function updateBreastfeedSession(
  session: ActiveBreastFeed,
  action: SessionUpdateAction,
  side?: BreastSide
): Promise<ActiveBreastFeed | null> {
  const now = new Date();
  const updateData = applySessionAction(session, action, now, side);
  if (!updateData) return null;

  return prisma.activeBreastFeed.update({
    where: { id: session.id },
    data: updateData,
  });
}

export interface EndSessionOptions {
  familyId: string;
  caretakerId?: string | null;
  accountId?: string | null;
  /** Optional duration overrides (seconds), e.g. from form adjustments */
  leftDuration?: number;
  rightDuration?: number;
}

export interface EndSessionResult {
  feedLogs: { id: string; side: BreastSide | null; feedDuration: number | null }[];
  leftDuration: number;
  rightDuration: number;
}

/**
 * Finalizes a session: creates one FeedLog per side with real per-side
 * start/end spans (first-use order, pause gap between sides, shared
 * sessionId), deletes the session, and fires the same notifications as the
 * in-app end-feed flow.
 */
export async function endBreastfeedSession(session: ActiveBreastFeed, opts: EndSessionOptions): Promise<EndSessionResult> {
  const now = new Date();

  const elapsed = (session.currentSideStartTime && !session.isPaused)
    ? Math.floor((now.getTime() - session.currentSideStartTime.getTime()) / 1000)
    : 0;

  // Ending while paused counts the trailing gap as pause time
  const trailingPause = session.isPaused && session.pausedAt
    ? Math.floor((now.getTime() - session.pausedAt.getTime()) / 1000)
    : 0;
  const finalPauseDuration = session.pauseDuration + trailingPause;

  const finalLeftDuration = session.activeSide === 'LEFT'
    ? session.leftDuration + elapsed
    : session.leftDuration;
  const finalRightDuration = session.activeSide === 'RIGHT'
    ? session.rightDuration + elapsed
    : session.rightDuration;

  const leftDur = opts.leftDuration !== undefined ? opts.leftDuration : finalLeftDuration;
  const rightDur = opts.rightDuration !== undefined ? opts.rightDuration : finalRightDuration;

  // Legacy in-flight sessions (null firstSide) fall back to the opposite of
  // activeSide to preserve the previous sort order.
  const firstSide: BreastSide | null = session.firstSide ?? (session.activeSide === 'LEFT' ? 'RIGHT' : 'LEFT');
  const blocks = layoutBreastFeedSession({
    sessionStartTime: session.sessionStartTime,
    firstSide,
    leftDuration: leftDur,
    rightDuration: rightDur,
    pauseDuration: finalPauseDuration,
  });

  // Both rows share a sessionId so they always count as one nursing session
  const sessionId = randomUUID();
  const feedLogs: { id: string; side: BreastSide | null; feedDuration: number | null }[] = [];

  for (const block of blocks) {
    const log = await prisma.feedLog.create({
      data: {
        babyId: session.babyId,
        // Each side's `time` is its own start: the linked-session list shows
        // `time`, and the edit form writes startTime back into `time` on
        // update, so a session-end stamp here would disagree with both (#240)
        time: block.startTime,
        type: 'BREAST',
        side: block.side,
        startTime: block.startTime,
        endTime: block.endTime,
        feedDuration: block.duration,
        pauseDuration: finalPauseDuration,
        sessionId,
        caretakerId: opts.caretakerId,
        familyId: opts.familyId,
      },
    });
    feedLogs.push(log);
  }

  // Delete the active session
  await prisma.activeBreastFeed.delete({ where: { id: session.id } });

  // Notify subscribers about completed breastfeed and reset feed timer (non-blocking)
  notifyActivityCreated(session.babyId, 'feed', { accountId: opts.accountId, caretakerId: opts.caretakerId }, { type: 'BREAST' }).catch(console.error);
  resetTimerNotificationState(session.babyId, 'feed').catch(console.error);

  return {
    feedLogs: feedLogs.map(log => ({ id: log.id, side: log.side, feedDuration: log.feedDuration })),
    leftDuration: leftDur,
    rightDuration: rightDur,
  };
}
