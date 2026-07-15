/**
 * Pure aggregation of a day's feed activities for the daily-stats tiles
 * (issue #207): bottle + breast feeds are counted together as "milk" feeds,
 * solids are counted separately so each can render its own tile.
 */

import { convertVolume } from './unit-conversion';
import { groupBreastFeedSessions, BreastFeedLike } from './feedSessionUtils';

/** Minimal shape of a feed activity needed for daily-stats aggregation. */
export interface FeedActivityLike {
  type?: string;
  time?: string | Date;
  amount?: number | null;
  unitAbbr?: string | null;
}

export interface FeedStats {
  /** Bottle feeds plus breast-feed sessions (issue #198 grouping). */
  milkFeedCount: number;
  /** Total bottle volume in the preferred unit. */
  bottleFeedTotal: number;
  leftBreastMinutes: number;
  rightBreastMinutes: number;
  solidsCount: number;
  /** Solids totals keyed by unit abbreviation (e.g. { g: 45 }). */
  solidsAmounts: Record<string, number>;
}

/**
 * Aggregate feed stats for the day between startOfDay and endOfDay.
 * `windowActivities` (the surrounding days too) is used for breast-session
 * grouping so sessions that span midnight group correctly; each session is
 * attributed to the day it started. Falls back to `activities`.
 */
export function aggregateFeedStats(
  activities: unknown[],
  windowActivities: unknown[] | undefined,
  startOfDay: Date,
  endOfDay: Date,
  preferredUnit: string
): FeedStats {
  let milkFeedCount = 0;
  let bottleFeedTotal = 0;
  let leftBreastMinutes = 0;
  let rightBreastMinutes = 0;
  let solidsCount = 0;
  const solidsAmounts: Record<string, number> = {};

  for (const raw of activities) {
    const activity = raw as FeedActivityLike;
    if (activity && typeof activity === 'object' && 'amount' in activity && 'type' in activity) {
      const time = new Date(activity.time as string | Date);
      if (time >= startOfDay && time <= endOfDay) {
        if (activity.type === 'BOTTLE') {
          milkFeedCount++;
          const entryUnit = activity.unitAbbr || 'OZ';
          const amount = activity.amount || 0;
          bottleFeedTotal += convertVolume(amount, entryUnit, preferredUnit);
        } else if (activity.type === 'SOLIDS') {
          solidsCount++;
          // Track solids amounts by unit
          const unit = activity.unitAbbr || 'g';
          if (!solidsAmounts[unit]) {
            solidsAmounts[unit] = 0;
          }
          solidsAmounts[unit] += activity.amount || 0;
        }
      }
    }
  }

  // Breast feeds: group per-side rows into nursing sessions (issue #198). The
  // grouping window spans midnight, so use the surrounding days' activities
  // and attribute each session (count and minutes) to the day it started.
  const breastRows = ((windowActivities ?? activities) as BreastFeedLike[])
    .filter(a => a && 'type' in a && a.type === 'BREAST');
  for (const session of groupBreastFeedSessions(breastRows)) {
    if (session.time >= startOfDay && session.time <= endOfDay) {
      milkFeedCount++;
      leftBreastMinutes += Math.floor(session.leftDuration / 60);
      rightBreastMinutes += Math.floor(session.rightDuration / 60);
    }
  }

  return { milkFeedCount, bottleFeedTotal, leftBreastMinutes, rightBreastMinutes, solidsCount, solidsAmounts };
}
