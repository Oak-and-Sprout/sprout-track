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
  'FOOD',
] as const;

// Legacy category name: 'SOLIDS' feeds were migrated to the FoodLog table
// (issue #203). Stored configs may still carry 'SOLIDS'; it maps to 'FOOD'.
const LEGACY_SOLIDS = 'SOLIDS';

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
    const categories = parsed
      .map((c) => (c === LEGACY_SOLIDS ? 'FOOD' : c))
      .filter((c): c is FeedTimerCategory =>
        (FEED_TIMER_CATEGORIES as readonly string[]).includes(c as string)
      );
    return categories.length > 0 ? categories : null;
  } catch {
    return null;
  }
}

/**
 * Strict write-time validation for the stored JSON config. Unlike
 * parseFeedTimerTypes (which reads leniently), this rejects anything the
 * client shouldn't send: non-array JSON, empty arrays (the client stores
 * null for "all feeds"), and unknown entries.
 */
export function isValidFeedTimerTypes(
  json: string | null | undefined
): boolean {
  if (json === null || json === undefined) return true;
  try {
    const parsed: unknown = JSON.parse(json);
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (c) =>
          (FEED_TIMER_CATEGORIES as readonly string[]).includes(c as string) ||
          c === LEGACY_SOLIDS
      )
    );
  } catch {
    return false;
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
 * Whether solid-food (FoodLog) entries reset the timer for the given
 * categories. Food lives in a separate table (issue #203), so it is handled
 * outside the FeedLog where clause. null/undefined = every feed counts, which
 * includes food.
 */
export function foodCountsForTimer(
  categories: readonly FeedTimerCategory[] | null | undefined
): boolean {
  if (!categories) return true;
  return categories.includes('FOOD');
}

/**
 * Build a Prisma where clause fragment selecting only FeedLog rows that count
 * toward the timer. Returns {} (no filtering) for null/undefined. Food is not
 * a FeedLog row — see foodCountsForTimer for the FoodLog side.
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
  return { OR: or };
}
