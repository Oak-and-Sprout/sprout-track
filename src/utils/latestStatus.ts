/**
 * "Latest status" derivation shared by the log-entry page (TimelineV2 →
 * ActivityTileGroup status bubbles) and Nursery Mode's timer blocks, so both
 * surfaces agree on what the last feed / sleep was and when a warning fires.
 */
import type { LatestStatusData } from '@/src/components/Timeline/types';
import type { SleepLogResponse } from '@/app/api/types';
import { FeedTimerCategory, feedCountsForTimer, foodCountsForTimer } from './feedTimerConfig';
import { groupBreastFeedSessions } from './feedSessionUtils';
import { findLatestPumpTime } from './pumpTimer';

/** Status bubbles/timers hide anything 24 h old or more (a likely-forgotten log). */
export const STATUS_WINDOW_MINUTES = 24 * 60;

const byTimeDesc = (key: string) => (a: any, b: any) => new Date(b[key]).getTime() - new Date(a[key]).getTime();

/**
 * Extract the latest feed / diaper / pump / sleep status from a mixed list of
 * activity rows (FeedLog, FoodLog, DiaperLog, PumpLog, SleepLog shapes).
 * `feedTimerCategories` is the baby's parsed feedTimerTypes (null = all feeds count).
 */
export function computeLatestStatus(
  activities: readonly object[],
  feedTimerCategories: readonly FeedTimerCategory[] | null | undefined
): LatestStatusData {
  const status: LatestStatusData = {};

  // Food (issue #203) lives in FoodLog and is discriminated by `foodId`; when
  // the FOOD category counts it can reset the timer alongside breast/bottle feeds.
  const lastFeed = activities
    .filter((a) => {
      if (!('time' in a)) return false;
      if ('foodId' in a) return foodCountsForTimer(feedTimerCategories);
      return (
        'amount' in a && 'type' in a &&
        ((a as any).type === 'BOTTLE' || (a as any).type === 'BREAST') &&
        feedCountsForTimer(a as any, feedTimerCategories)
      );
    })
    .sort(byTimeDesc('time'))[0];

  if (lastFeed) {
    const feedAny = lastFeed as any;
    if (feedAny.type === 'BREAST') {
      // Linked/paired rows count as one feeding (#198): time the timer against
      // the whole nursing session, not just its latest row
      const breastFeeds = activities.filter((a) =>
        'amount' in a && (a as any).type === 'BREAST' && 'time' in a
      ) as any[];
      const session = groupBreastFeedSessions(breastFeeds)
        .find(s => s.rows.some((r: any) => r.id === feedAny.id));
      const rows: any[] = session?.rows ?? [feedAny];
      // Prefer explicit startTime/endTime; `time` only equals the session end
      // for newly logged feeds and can hold the start time after an edit
      const startMs = Math.min(...rows.map(r => new Date(r.startTime || r.time).getTime()));
      const endMs = Math.max(...rows.map(r => new Date(r.endTime || r.time).getTime()));
      status.lastFeedTime = new Date(startMs);
      status.lastFeedEndTime = new Date(endMs);
    } else {
      status.lastFeedTime = new Date(feedAny.time);
    }
  }

  const lastDiaper = activities
    .filter((a) => 'condition' in a && 'time' in a)
    .sort(byTimeDesc('time'))[0];
  if (lastDiaper) {
    status.lastDiaperTime = new Date((lastDiaper as any).time);
  }

  status.lastPumpTime = findLatestPumpTime(activities);

  const sleepLogs = activities.filter((a) =>
    'duration' in a && 'startTime' in a &&
    'type' in a && ((a as any).type === 'NAP' || (a as any).type === 'NIGHT_SLEEP')
  );

  const ongoingSleep = sleepLogs.find(log => !(log as any).endTime);
  if (ongoingSleep) {
    status.ongoingSleep = ongoingSleep as unknown as SleepLogResponse;
  }

  const lastSleep = sleepLogs
    .filter((log) => typeof (log as any).endTime === 'string')
    .sort(byTimeDesc('endTime'))[0] as any;
  if (lastSleep) {
    status.lastSleepEndTime = new Date(lastSleep.endTime);
    status.lastEndedSleep = lastSleep as SleepLogResponse & { endTime: string };
  }

  return status;
}

/** The feed timer's anchor: the feed end when the baby counts from the end and one exists, else the start. */
export function effectiveFeedTime(
  lastFeedTime: Date | undefined,
  lastFeedEndTime: Date | undefined,
  feedTimerFrom: string | null | undefined
): Date | undefined {
  return feedTimerFrom === 'end' && lastFeedEndTime ? lastFeedEndTime : lastFeedTime;
}

/** Whole minutes between two instants. Epoch-based, so DST changes don't skew it. */
export function elapsedMinutes(from: Date, now: Date): number {
  return Math.floor((now.getTime() - from.getTime()) / 60000);
}

export function isWithinStatusWindow(minutes: number): boolean {
  return minutes < STATUS_WINDOW_MINUTES;
}

/** Baby warning times are stored as "hh:mm"; null when unset or malformed. */
export function warningTimeToMinutes(warningTime: string | null | undefined): number | null {
  if (!warningTime) return null;
  const [hours, minutes] = warningTime.split(':').map(Number);
  const total = hours * 60 + minutes;
  return Number.isFinite(total) ? total : null;
}

/** True once `minutes` reaches the warning threshold (same rule as the status bubbles). */
export function isPastWarning(minutes: number, warningTime: string | null | undefined): boolean {
  const threshold = warningTimeToMinutes(warningTime);
  return threshold !== null && minutes >= threshold;
}

/** Screen-reader duration, e.g. "1 hour 23 minutes". */
export function formatDurationLabel(minutes: number, t: (key: string) => string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return [
    hours > 0 ? `${hours} ${hours === 1 ? t('hour') : t('hours')}` : null,
    `${mins} ${mins === 1 ? t('minute') : t('minutes')}`,
  ].filter(Boolean).join(' ');
}
