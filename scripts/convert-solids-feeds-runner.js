/**
 * SOLIDS feed -> FoodLog conversion runner.
 *
 * Shared by the startup CLI wrapper (scripts/convert-solids-feeds.js) and the
 * post-restore migration routes (/api/database/migrate and migrate-initial),
 * so a restored backup containing legacy SOLIDS feeds is converted the same
 * way as a live database at startup. Pure decision logic lives in
 * scripts/convert-solids-feeds-core.js (unit tested in
 * tests/convertSolidsFeeds.test.ts).
 *
 * Behavior:
 * - Idempotent: converted feeds are deleted, and any feed whose id already
 *   appears in FoodLog.feedLogId is skipped (guards against a crash between
 *   the FoodLog insert and the FeedLog delete).
 * - Per family, distinct food names become catalog Food entries (matched
 *   case-insensitively; blank names fall back to the reaction cause, then to
 *   a generic 'Solids' entry).
 * - Photo links move from ('feed', feedId) to ('foodLog', foodLogId).
 * - Each feed row converts inside a transaction; unexpected per-row errors
 *   are logged and skipped so callers never crash on partial data.
 */

const {
  foodNameKey,
  resolveCatalogFoodName,
  filterUnconverted,
  buildFoodLogData,
  placeFoodTile,
} = require('./convert-solids-feeds-core');

/**
 * Place the 'food' activity tile next to 'feed' in every caretaker's saved
 * activity settings (Settings.activitySettings JSON, keyed by caretaker).
 * Skips entries that already contain 'food', so later user re-orders stick.
 *
 * @returns {Promise<number>} number of caretaker entries updated
 */
async function placeFoodTiles(prisma) {
  const rows = await prisma.settings.findMany({
    where: { activitySettings: { not: null } },
    select: { id: true, activitySettings: true },
  });

  let updatedEntries = 0;
  for (const row of rows) {
    try {
      const all = JSON.parse(row.activitySettings);
      if (!all || typeof all !== 'object') continue;

      let rowChanged = false;
      for (const key of Object.keys(all)) {
        const entry = all[key];
        if (!entry || typeof entry !== 'object') continue;
        const placed = placeFoodTile(entry);
        if (placed.changed) {
          all[key] = { ...entry, order: placed.order, visible: placed.visible };
          rowChanged = true;
          updatedEntries++;
        }
      }

      if (rowChanged) {
        await prisma.settings.update({
          where: { id: row.id },
          data: { activitySettings: JSON.stringify(all) },
        });
      }
    } catch (error) {
      console.error(`Solids conversion: failed to place food tile for settings ${row.id}, skipping. ${error.message}`);
    }
  }
  return updatedEntries;
}

/**
 * Convert all remaining SOLIDS FeedLog rows into Food + FoodLog records.
 *
 * @param {import('@prisma/client').PrismaClient} prisma - connected client
 * @returns {Promise<{ total: number, converted: number, skipped: number, errors: number }>}
 */
async function convertSolidsFeeds(prisma) {
  // Place the food tile next to feed in saved tile orders. Runs on every
  // startup/restore (independently of whether any feeds remain to convert)
  // but only touches entries that don't have the food tile yet.
  const tileEntriesUpdated = await placeFoodTiles(prisma);

  // All SOLIDS feeds (soft-deleted ones convert to soft-deleted food logs)
  const feeds = await prisma.feedLog.findMany({
    where: { type: 'SOLIDS' },
    orderBy: { time: 'asc' },
  });

  if (feeds.length === 0) {
    return { total: 0, converted: 0, skipped: 0, errors: 0, tileEntriesUpdated };
  }

  // Guard against double-conversion: skip feeds already linked from a food log
  const convertedLinks = await prisma.foodLog.findMany({
    where: { feedLogId: { not: null } },
    select: { feedLogId: true },
  });
  const pending = filterUnconverted(feeds, convertedLinks.map((link) => link.feedLogId));

  let converted = 0;
  let errors = 0;

  // Per-family catalog cache: familyId ('' for null) -> (name key -> food id)
  const catalogByFamily = new Map();

  async function getCatalog(familyId) {
    const cacheKey = familyId || '';
    let catalog = catalogByFamily.get(cacheKey);
    if (!catalog) {
      const foods = await prisma.food.findMany({
        where: { familyId: familyId || null, deletedAt: null },
        select: { id: true, name: true },
      });
      catalog = new Map(foods.map((food) => [foodNameKey(food.name), food.id]));
      catalogByFamily.set(cacheKey, catalog);
    }
    return catalog;
  }

  for (const feed of pending) {
    try {
      const { name } = resolveCatalogFoodName(feed);
      const catalog = await getCatalog(feed.familyId);
      let foodId = catalog.get(foodNameKey(name));
      if (!foodId) {
        const food = await prisma.food.create({
          data: { name, commonAllergen: false, familyId: feed.familyId || null },
        });
        foodId = food.id;
        catalog.set(foodNameKey(name), foodId);
      }

      await prisma.$transaction(async (tx) => {
        const foodLog = await tx.foodLog.create({
          data: { ...buildFoodLogData(feed), foodId },
        });
        // Re-link photos from the feed to the new food log
        await tx.photoLink.updateMany({
          where: { activityType: 'feed', activityId: feed.id },
          data: { activityType: 'foodLog', activityId: foodLog.id },
        });
        // Hard-delete the source feed (matches /api/feed-log DELETE)
        await tx.feedLog.delete({ where: { id: feed.id } });
      });

      converted++;
    } catch (error) {
      errors++;
      console.error(`Solids conversion: failed to convert feed ${feed.id}, skipping. ${error.message}`);
    }
  }

  return {
    total: feeds.length,
    converted,
    skipped: feeds.length - pending.length,
    errors,
    tileEntriesUpdated,
  };
}

/** One-line human-readable summary of a conversion result. */
function summarizeConversion(result) {
  const tileSuffix = result.tileEntriesUpdated > 0
    ? ` Food tile placed for ${result.tileEntriesUpdated} caretaker setting(s).`
    : '';
  if (result.total === 0) {
    return `Solids conversion: no SOLIDS feeds found, nothing to do.${tileSuffix}`;
  }
  return (
    `Solids conversion: ${result.converted} feed(s) converted, ${result.skipped} skipped (already converted)` +
    (result.errors > 0 ? `, ${result.errors} error(s)` : '') + `.${tileSuffix}`
  );
}

module.exports = { convertSolidsFeeds, summarizeConversion };
