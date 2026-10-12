/**
 * Nursery Mode timer blocks (issue #219): view models for the "awake for" /
 * "sleeping for", "since last feed" and "since last diaper" blocks. Inputs come from
 * computeLatestStatus, and the rules (24 h cutoff, feedTimerFrom, warning
 * threshold) match the log-entry page's status bubbles.
 */
import type { LatestStatusData } from '@/src/components/Timeline/types';
import { effectiveFeedTime, elapsedMinutes, isPastWarning, isWithinStatusWindow } from '@/src/utils/latestStatus';

export type WakeTimer =
  | { kind: 'awake' | 'sleeping'; minutes: number }
  | { kind: 'none' };

export type SinceTimer =
  | { kind: 'since'; minutes: number; warning: boolean }
  | { kind: 'none' };

export type FeedTimer = SinceTimer | { kind: 'feeding' };

export interface FeedTimerBaby {
  feedTimerFrom?: string | null;
  feedWarningTime?: string | null;
}

export interface DiaperTimerBaby {
  diaperWarningTime?: string | null;
}

/** Minutes since `from`, or null when 24 h or older. Future times clamp to 0. */
function recentMinutes(from: Date | string | undefined, now: Date): number | null {
  if (!from) return null;
  const minutes = Math.max(0, elapsedMinutes(new Date(from), now));
  return isWithinStatusWindow(minutes) ? minutes : null;
}

export function wakeTimer(status: Pick<LatestStatusData, 'ongoingSleep' | 'lastSleepEndTime'>, now: Date): WakeTimer {
  if (status.ongoingSleep) {
    const minutes = recentMinutes(status.ongoingSleep.startTime, now);
    return minutes === null ? { kind: 'none' } : { kind: 'sleeping', minutes };
  }
  const minutes = recentMinutes(status.lastSleepEndTime, now);
  return minutes === null ? { kind: 'none' } : { kind: 'awake', minutes };
}

export function feedTimer(
  status: Pick<LatestStatusData, 'lastFeedTime' | 'lastFeedEndTime'>,
  baby: FeedTimerBaby,
  now: Date,
  feeding = false
): FeedTimer {
  if (feeding) return { kind: 'feeding' };
  return sinceTimer(effectiveFeedTime(status.lastFeedTime, status.lastFeedEndTime, baby.feedTimerFrom), baby.feedWarningTime, now);
}

/** Time since the last diaper change, warning at diaperWarningTime like the log-entry diaper bubble. */
export function diaperTimer(status: Pick<LatestStatusData, 'lastDiaperTime'>, baby: DiaperTimerBaby, now: Date): SinceTimer {
  return sinceTimer(status.lastDiaperTime, baby.diaperWarningTime, now);
}

function sinceTimer(from: Date | undefined, warningTime: string | null | undefined, now: Date): SinceTimer {
  const minutes = recentMinutes(from, now);
  return minutes === null ? { kind: 'none' } : { kind: 'since', minutes, warning: isPastWarning(minutes, warningTime) };
}

export function splitDuration(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, minutes);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
