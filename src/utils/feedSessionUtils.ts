/**
 * Utilities for grouping breastfeeding FeedLog rows into nursing sessions.
 *
 * A nursing session that uses both sides is stored as one FeedLog row per side
 * so per-side durations are preserved. Counting surfaces must treat the rows of
 * one session as ONE feed (issue #198); this module is the single place that
 * defines how rows group.
 *
 * Two mechanisms, in priority order:
 * 1. Explicit `sessionId` — rows sharing a sessionId are one session (any
 *    number of rows, any sides). A row whose sessionId is unique to it is a
 *    deliberate singleton: the user unlinked it, so it never merges.
 * 2. Heuristic fallback for legacy rows without a sessionId — different-side
 *    rows within SESSION_TOLERANCE_MS of each other pair up (at most one LEFT
 *    and one RIGHT; sideless rows never pair).
 */

/** Minimal shape of a feed log row needed for session grouping. */
export interface BreastFeedLike {
  type: string;
  time: string | Date;
  side?: string | null;
  feedDuration?: number | null;
  /** Older records store the duration in minutes here instead of feedDuration. */
  amount?: number | null;
  /** Explicit session link; takes precedence over the time heuristic. */
  sessionId?: string | null;
}

/**
 * Heuristic window for legacy rows without a sessionId: two different-side
 * feeds within this gap count as one nursing session, even when logged
 * separately — a break between sides is still one session. A plain time gap,
 * so it spans midnight.
 */
export const SESSION_TOLERANCE_MS = 30 * 60_000;

export interface BreastFeedSession<T extends BreastFeedLike = BreastFeedLike> {
  /** The rows that make up this session. */
  rows: T[];
  /** Time of the earliest row in the session (the day the session belongs to). */
  time: Date;
  /** Shared sessionId when the session is explicitly linked. */
  sessionId: string | null;
  /** Summed durations (seconds) of LEFT / RIGHT rows in the session. */
  leftDuration: number;
  rightDuration: number;
  totalDuration: number;
}

// feedDuration is in seconds; older records store minutes in amount
function rowDurationSeconds(row: BreastFeedLike): number {
  return row.feedDuration || (row.amount ? row.amount * 60 : 0);
}

function buildSession<T extends BreastFeedLike>(
  rows: T[],
  firstTs: number,
  sessionId: string | null
): BreastFeedSession<T> {
  let left = 0;
  let right = 0;
  for (const row of rows) {
    const duration = rowDurationSeconds(row);
    if (row.side === 'LEFT') left += duration;
    else if (row.side === 'RIGHT') right += duration;
  }
  return {
    rows,
    time: new Date(firstTs),
    sessionId,
    leftDuration: left,
    rightDuration: right,
    totalDuration: left + right,
  };
}

/**
 * Group BREAST rows into nursing sessions: by shared `sessionId` when present,
 * otherwise by the time heuristic. Non-BREAST rows are ignored. Sessions are
 * returned sorted by start time.
 */
export function groupBreastFeedSessions<T extends BreastFeedLike>(
  feeds: T[],
  toleranceMs: number = SESSION_TOLERANCE_MS
): BreastFeedSession<T>[] {
  const sorted = feeds
    .filter(f => f.type === 'BREAST')
    .map(f => ({ row: f, ts: new Date(f.time).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  const sessions: BreastFeedSession<T>[] = [];

  // Explicitly linked rows group by sessionId, regardless of gaps or sides
  const bySessionId = new Map<string, { rows: T[]; firstTs: number }>();
  for (const { row, ts } of sorted) {
    if (!row.sessionId) continue;
    const group = bySessionId.get(row.sessionId);
    if (group) {
      group.rows.push(row);
    } else {
      bySessionId.set(row.sessionId, { rows: [row], firstTs: ts });
    }
  }
  bySessionId.forEach((group, sessionId) => {
    sessions.push(buildSession(group.rows, group.firstTs, sessionId));
  });

  // Heuristic pairing for rows without a sessionId
  let current: { rows: T[]; sides: Set<string>; firstTs: number; lastTs: number } | null = null;

  const flush = () => {
    if (!current) return;
    sessions.push(buildSession(current.rows, current.firstTs, null));
    current = null;
  };

  for (const { row, ts } of sorted) {
    if (row.sessionId) continue;
    const side = row.side || null;
    const joins =
      current !== null &&
      side !== null &&
      current.sides.size > 0 &&
      !current.sides.has(side) &&
      ts - current.lastTs <= toleranceMs;

    if (joins && current) {
      current.rows.push(row);
      current.sides.add(side!);
      current.lastTs = ts;
    } else {
      flush();
      current = { rows: [row], sides: new Set(side ? [side] : []), firstTs: ts, lastTs: ts };
    }
  }
  flush();

  return sessions.sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Generate a new session id. crypto.randomUUID is unavailable in insecure
 * browser contexts (plain-http self-hosted deployments), so fall back to a
 * timestamp+random id there.
 */
export function newFeedSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Number of nursing sessions represented by the given feed logs
 * (linked or paired rows count once; non-BREAST rows are ignored).
 */
export function countBreastFeedSessions(
  feeds: BreastFeedLike[],
  toleranceMs: number = SESSION_TOLERANCE_MS
): number {
  return groupBreastFeedSessions(feeds, toleranceMs).length;
}
