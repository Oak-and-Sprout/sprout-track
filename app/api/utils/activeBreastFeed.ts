import { randomUUID } from 'crypto';
import { ActiveBreastFeed, BreastSide } from '@prisma/client';
import prisma from '../db';
import { notifyActivityCreated, resetTimerNotificationState } from '@/src/lib/notifications/activityHook';
import { layoutBreastFeedSession } from '@/src/utils/feedSessionLayout';
import { applySessionAction as pureApply, ActiveBreastFeedState } from '@/src/utils/feedSessionActions';

export type SessionUpdateAction = 'switch' | 'pause' | 'resume' | 'swap';
export type SessionActionUpdate = ReturnType<typeof pureApply> extends infer R ? R : never;

export const SESSION_UPDATE_ACTIONS: SessionUpdateAction[] = ['switch', 'pause', 'resume', 'swap'];

export interface StartSessionParams {
  babyId: string;
  side: BreastSide;
  familyId: string;
  caretakerId?: string | null;
}

export async function startBreastfeedSession({ babyId, side, familyId, caretakerId }: StartSessionParams): Promise<ActiveBreastFeed> {
  const now = new Date();
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
      currentSideStartTime: now,
      sessionStartTime: now,
      familyId,
      caretakerId,
    },
  });
}

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
  leftDuration?: number;
  rightDuration?: number;
}

export interface EndSessionResult {
  feedLogs: { id: string; side: BreastSide | null; feedDuration: number | null }[];
  leftDuration: number;
  rightDuration: number;
}

export async function endBreastfeedSession(session: ActiveBreastFeed, opts: EndSessionOptions): Promise<EndSessionResult> {
  const now = new Date();

  const elapsed = (session.currentSideStartTime && !session.isPaused)
    ? Math.floor((now.getTime() - session.currentSideStartTime.getTime()) / 1000)
    : 0;

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

  const firstSide: BreastSide | null = session.firstSide ?? session.activeSide;
  const blocks = layoutBreastFeedSession({
    sessionStartTime: session.sessionStartTime,
    firstSide,
    leftDuration: leftDur,
    rightDuration: rightDur,
    pauseDuration: finalPauseDuration,
  });

  const sessionId = randomUUID();
  const feedLogs: { id: string; side: BreastSide | null; feedDuration: number | null }[] = [];

  for (const block of blocks) {
    const log = await prisma.feedLog.create({
      data: {
        babyId: session.babyId,
        time: now,
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

  await prisma.activeBreastFeed.delete({ where: { id: session.id } });

  notifyActivityCreated(session.babyId, 'feed', { accountId: opts.accountId, caretakerId: opts.caretakerId }, { type: 'BREAST' }).catch(console.error);
  resetTimerNotificationState(session.babyId, 'feed').catch(console.error);

  return {
    feedLogs: feedLogs.map(log => ({ id: log.id, side: log.side, feedDuration: log.feedDuration })),
    leftDuration: leftDur,
    rightDuration: rightDur,
  };
}
