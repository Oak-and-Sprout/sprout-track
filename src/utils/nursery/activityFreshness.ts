/**
 * Age cutoff for nursery-mode tile meta lines. A tile shows only a clock time
 * ("3:42 pm") with no date, so an entry from days ago is indistinguishable from
 * one an hour old — past the window we show nothing instead (issue #250).
 */

/** Rolling window a tile's last-activity line must fall within. */
export const TILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * True when `timestamp` is recent enough to show on a tile. Missing or
 * unparseable input is treated as stale. Future-dated entries stay visible —
 * only the past side of the window is bounded.
 */
export function isWithinTileWindow(
  timestamp: string | Date | null | undefined,
  now: number
): boolean {
  if (!timestamp) return false;
  const time = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return false;
  return now - time < TILE_MAX_AGE_MS;
}
