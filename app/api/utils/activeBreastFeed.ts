import { randomUUID } from 'crypto';
import { ActiveBreastFeed, BreastSide } from '@prisma/client';
import prisma from '../db';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';

/**
 * Shared active breastfeed session logic used by both the internal
 * /api/active-breastfeed route (JWT auth) and the external hooks API
 * (/api/hooks/v1, API-key auth) so timer behavior is identical
 * regardless of which surface starts, updates, or ends a session.
 */

export type SessionUpdateAction = 'switch' | 'pause' | 'resume' | 'swap';

export const SESSION_UPDATE_ACTIONS: SessionUpdateAction[] = ['switch', 'pause', 'resume', 'swap'];

/** Seconds accrued on the currently active side since it started timing (0 when paused). */
function elapsedSeconds(session: ActiveBreastFeed, now: Date): number {
  if (session.currentSideStartTime && !session.isPaused) {
    return Math.floor((now.getTime() - session.currentSideStartTime.getTime()) / 1000);
  }
  return 0;
}

export interface StartSessionParams {
  babyId: string;
  side: BreastSide;
  familyId: string;
  caretakerId?: string | null;
}

/**
 * Creates a new active session. Callers should check for an existing session
 * first; a concurrent start still races on the babyId unique constraint, so
 * catch Prisma P2002 and treat it as "already active".
 */
export async function startBreastfeedSession({ babyId, side, familyId, caretakerId }: StartSessionParams): Promise<ActiveBreastFeed> {
  const now = new Date();
  return prisma.activeBreastFeed.create({
    data: {
      babyId,
      activeSide: side,
      isPaused: false,
      leftDuration: 0,
      rightDuration: 0,
      currentSideStartTime: now,
      sessionStartTime: now,
      familyId,
      caretakerId,
    },
  });
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
  const elapsed = elapsedSeconds(session, now);

  // Durations with the in-flight elapsed time folded in
  const accruedLeft = session.activeSide === 'LEFT' ? session.leftDuration + elapsed : session.leftDuration;
  const accruedRight = session.activeSide === 'RIGHT' ? session.rightDuration + elapsed : session.rightDuration;
  const otherSide = session.activeSide === 'LEFT' ? 'RIGHT' : 'LEFT';

  let updateData: any;

  switch (action) {
    case 'switch':
      updateData = {
        activeSide: otherSide,
        leftDuration: accruedLeft,
        rightDuration: accruedRight,
        currentSideStartTime: now,
        isPaused: false,
      };
      break;
    case 'pause':
      updateData = {
        leftDuration: accruedLeft,
        rightDuration: accruedRight,
        currentSideStartTime: null,
        isPaused: true,
      };
      break;
    case 'resume':
      updateData = {
        activeSide: side || session.activeSide,
        currentSideStartTime: now,
        isPaused: false,
      };
      break;
    case 'swap':
      updateData = {
        activeSide: otherSide,
        leftDuration: accruedRight,
        rightDuration: accruedLeft,
        ...(session.isPaused ? {} : { currentSideStartTime: now }),
      };
      break;
    default:
      return null;
  }

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
 * Finalizes a session: creates one FeedLog per side with accrued time
 * (linked by a shared sessionId), deletes the session, and fires the same
 * notifications as the in-app end-feed flow.
 */
export async function endBreastfeedSession(session: ActiveBreastFeed, opts: EndSessionOptions): Promise<EndSessionResult> {
  const now = new Date();

  const elapsed = elapsedSeconds(session, now);

  const finalLeftDuration = session.activeSide === 'LEFT'
    ? session.leftDuration + elapsed
    : session.leftDuration;
  const finalRightDuration = session.activeSide === 'RIGHT'
    ? session.rightDuration + elapsed
    : session.rightDuration;

  const leftDur = opts.leftDuration !== undefined ? opts.leftDuration : finalLeftDuration;
  const rightDur = opts.rightDuration !== undefined ? opts.rightDuration : finalRightDuration;

  // Create FeedLog records for each side that has duration
  // Last-fed side gets a slightly later startTime so it sorts first in lists
  const baseStartTime = session.sessionStartTime;
  const lastSideStartTime = new Date(baseStartTime.getTime() + 10);
  // Both rows share a sessionId so they always count as one nursing session
  const sessionId = randomUUID();
  const feedLogs = [];

  if (leftDur > 0) {
    const leftLog = await prisma.feedLog.create({
      data: {
        babyId: session.babyId,
        time: now,
        type: 'BREAST',
        side: 'LEFT',
        startTime: session.activeSide === 'LEFT' ? lastSideStartTime : baseStartTime,
        endTime: now,
        feedDuration: leftDur,
        sessionId,
        caretakerId: opts.caretakerId,
        familyId: opts.familyId,
      },
    });
    feedLogs.push(leftLog);
  }

  if (rightDur > 0) {
    const rightLog = await prisma.feedLog.create({
      data: {
        babyId: session.babyId,
        time: now,
        type: 'BREAST',
        side: 'RIGHT',
        startTime: session.activeSide === 'RIGHT' ? lastSideStartTime : baseStartTime,
        endTime: now,
        feedDuration: rightDur,
        sessionId,
        caretakerId: opts.caretakerId,
        familyId: opts.familyId,
      },
    });
    feedLogs.push(rightLog);
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
