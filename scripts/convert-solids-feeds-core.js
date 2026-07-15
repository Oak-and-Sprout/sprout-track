/**
 * Pure decision logic for the SOLIDS feed -> FoodLog conversion
 * (scripts/convert-solids-feeds.js). Kept free of Prisma so it can be unit
 * tested (tests/convertSolidsFeeds.test.ts).
 *
 * Rules:
 * - Catalog food name: the feed's free-text `food` (trimmed, whitespace
 *   collapsed); when blank, the reaction cause doubles as the food name;
 *   when neither exists, the per-family generic 'Solids' entry is used.
 * - Reaction description: when a cause exists and was NOT used as the food
 *   name it is prefixed as 'Cause: <cause>. <description>'.
 * - Idempotency: a feed whose id already appears in FoodLog.feedLogId was
 *   converted by an earlier run and is skipped.
 * - Catalog matching is case-insensitive on the normalized name; the first
 *   seen casing is preserved on create.
 */

/** Name used for solids feeds with no food text and no reaction cause. */
const GENERIC_FOOD_NAME = 'Solids';

/** Trim and collapse internal whitespace (mirrors src/utils/foodLogUtils normalizeFoodName). */
function normalizeFoodName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

/** Case-insensitive catalog matching key (mirrors src/utils/foodLogUtils foodNameKey). */
function foodNameKey(name) {
  return normalizeFoodName(name).toLowerCase();
}

/**
 * Decide the catalog food name for a SOLIDS feed row.
 * Returns { name, usedCause }: `usedCause` is true when the reaction cause
 * doubles as the food name because the food text was blank.
 */
function resolveCatalogFoodName(feed) {
  const food = normalizeFoodName(feed.food);
  if (food) return { name: food, usedCause: false };
  const cause = normalizeFoodName(feed.reactionCause);
  if (cause) return { name: cause, usedCause: true };
  return { name: GENERIC_FOOD_NAME, usedCause: false };
}

/**
 * Compose the FoodLog.reactionDescription from the feed's reaction fields.
 * The cause is folded in as a 'Cause: ...' prefix unless it already became
 * the catalog food name. Returns null when there is nothing to record.
 */
function composeReactionDescription(feed, usedCause) {
  const description = typeof feed.reactionDescription === 'string' ? feed.reactionDescription.trim() : '';
  const cause = normalizeFoodName(feed.reactionCause);
  if (cause && !usedCause) {
    return description ? `Cause: ${cause}. ${description}` : `Cause: ${cause}.`;
  }
  return description || null;
}

/** Feeds not yet converted (their id is absent from FoodLog.feedLogId values). */
function filterUnconverted(feeds, convertedFeedLogIds) {
  const converted = new Set(convertedFeedLogIds);
  return feeds.filter((feed) => !converted.has(feed.id));
}

/**
 * Build the FoodLog create data for a SOLIDS feed row (everything except
 * foodId, which requires the catalog lookup/create).
 */
function buildFoodLogData(feed) {
  const { usedCause } = resolveCatalogFoodName(feed);
  const amount = typeof feed.amount === 'number' && Number.isFinite(feed.amount) && feed.amount > 0 ? feed.amount : null;
  const notes = typeof feed.notes === 'string' && feed.notes.trim() ? feed.notes.trim() : null;
  return {
    time: feed.time,
    amount,
    unitAbbr: amount != null && feed.unitAbbr ? feed.unitAbbr : null,
    notes,
    hadReaction: feed.hadReaction === true,
    reactionDescription: composeReactionDescription(feed, usedCause),
    babyId: feed.babyId,
    caretakerId: feed.caretakerId || null,
    familyId: feed.familyId || null,
    feedLogId: feed.id,
    // Preserve soft-deleted feeds as soft-deleted food logs
    deletedAt: feed.deletedAt || null,
  };
}

module.exports = {
  GENERIC_FOOD_NAME,
  normalizeFoodName,
  foodNameKey,
  resolveCatalogFoodName,
  composeReactionDescription,
  filterUnconverted,
  buildFoodLogData,
};
