/**
 * Issue #225: per-baby configuration of which feed categories reset the
 * "time since last feed" timer. Stored on Baby.feedTimerTypes as a JSON
 * array of FeedTimerCategory; null means every feed counts (legacy behavior).
 */

export const FEED_TIMER_CATEGORIES = [
  'BREAST',
  'BOTTLE_BREAST_MILK',
  'BOTTLE_FORMULA',
  'BOTTLE_OTHER',
  'SOLIDS',
] as const;

export type FeedTimerCategory = (typeof FEED_TIMER_CATEGORIES)[number];

export interface FeedTimerFeedLike {
  type: string;
  bottleType?: string | null;
}

const MIXED_BOTTLE = 'Formula\\Breast';
const BREAST_MILK_BOTTLES = ['Breast Milk', MIXED_BOTTLE];
const FORMULA_BOTTLES = ['Formula', MIXED_BOTTLE];
const KNOWN_BOTTLE_TYPES = ['Breast Milk', 'Formula', MIXED_BOTTLE];

/**
 * Parse the stored JSON config. Returns null (= count all feeds) for
 * missing, invalid, or effectively-empty configs.
 */
export function parseFeedTimerTypes(
  json: string | null | undefined
): FeedTimerCategory[] | null {
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const categories = parsed.filter((c): c is FeedTimerCategory =>
      (FEED_TIMER_CATEGORIES as readonly string[]).includes(c as string)
    );
    return categories.length > 0 ? categories : null;
  } catch {
    return null;
  }
}

/**
 * Whether a feed counts toward the timer for the given categories.
 * null/undefined categories = every feed counts.
 */
export function feedCountsForTimer(
  feed: FeedTimerFeedLike,
  categories: readonly FeedTimerCategory[] | null | undefined
): boolean {
  if (!categories) return true;
  switch (feed.type) {
    case 'BREAST':
      return categories.includes('BREAST');
    case 'SOLIDS':
      return categories.includes('SOLIDS');
    case 'BOTTLE':
      switch (feed.bottleType) {
        case 'Breast Milk':
          return categories.includes('BOTTLE_BREAST_MILK');
        case 'Formula':
          return categories.includes('BOTTLE_FORMULA');
        case MIXED_BOTTLE:
          return (
            categories.includes('BOTTLE_BREAST_MILK') ||
            categories.includes('BOTTLE_FORMULA')
          );
        default:
          // 'Milk', 'Other', unknown, or unset bottle type
          return categories.includes('BOTTLE_OTHER');
      }
    default:
      return false;
  }
}

/**
 * Build a Prisma where clause fragment selecting only feeds that count
 * toward the timer. Returns {} (no filtering) for null/undefined.
 */
export function buildFeedTimerWhere(
  categories: readonly FeedTimerCategory[] | null | undefined
): Record<string, unknown> {
  if (!categories) return {};
  const or: Record<string, unknown>[] = [];
  if (categories.includes('BREAST')) or.push({ type: 'BREAST' });
  if (categories.includes('BOTTLE_BREAST_MILK')) {
    or.push({ type: 'BOTTLE', bottleType: { in: BREAST_MILK_BOTTLES } });
  }
  if (categories.includes('BOTTLE_FORMULA')) {
    or.push({ type: 'BOTTLE', bottleType: { in: FORMULA_BOTTLES } });
  }
  if (categories.includes('BOTTLE_OTHER')) {
    or.push({
      type: 'BOTTLE',
      OR: [{ bottleType: null }, { bottleType: { notIn: KNOWN_BOTTLE_TYPES } }],
    });
  }
  if (categories.includes('SOLIDS')) or.push({ type: 'SOLIDS' });
  return { OR: or };
}
