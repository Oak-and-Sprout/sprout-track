/**
 * Pure helpers for the food tracker (issue #203): food-name normalization and
 * duplicate detection for the family catalog, enjoyment validation,
 * "N unique foods tried" progress computation, and derivation of the baby's
 * allergen/reaction profile from reaction-flagged food logs.
 *
 * Kept free of Prisma/React so they can be unit tested (tests/foodLogUtils.test.ts).
 */
/** Valid FoodLog.enjoyment values (mirrors the FoodEnjoyment Prisma enum). */
export const FOOD_ENJOYMENT_VALUES = ['HATED', 'DISLIKED', 'NEUTRAL', 'LIKED', 'LOVED'] as const;

export type FoodEnjoymentValue = (typeof FOOD_ENJOYMENT_VALUES)[number];

/** The "100 foods before 1" goal the progress view counts toward. */
export const UNIQUE_FOOD_GOAL = 100;

/** Display order for enjoyment pickers/breakdowns: happiest → saddest, left to right. */
export const FOOD_ENJOYMENT_DISPLAY_ORDER = [...FOOD_ENJOYMENT_VALUES].reverse();

/**
 * Localization keys (== English labels) for each enjoyment value.
 * Components render them via t(FOOD_ENJOYMENT_LABELS[value]).
 */
export const FOOD_ENJOYMENT_LABELS: Record<FoodEnjoymentValue, string> = {
  HATED: 'Hated',
  DISLIKED: 'Disliked',
  NEUTRAL: 'Neutral',
  LIKED: 'Liked',
  LOVED: 'Loved',
};

/** Emoji shown on the enjoyment picker buttons; labels remain the accessible names. */
export const FOOD_ENJOYMENT_EMOJI: Record<FoodEnjoymentValue, string> = {
  HATED: '☹️',
  DISLIKED: '🫤',
  NEUTRAL: '😐',
  LIKED: '😃',
  LOVED: '😁',
};

/**
 * Fluent Emoji "Flat" SVGs (MIT, see public/emoji-flat/LICENSE.md) — consistent
 * rendering across platforms, unlike native emoji glyphs.
 */
export const FOOD_ENJOYMENT_ICON_SRC: Record<FoodEnjoymentValue, string> = {
  LOVED: '/emoji-flat/loved.svg',
  LIKED: '/emoji-flat/liked.svg',
  NEUTRAL: '/emoji-flat/neutral.svg',
  DISLIKED: '/emoji-flat/disliked.svg',
  HATED: '/emoji-flat/hated.svg',
};

/** Valid BabyAllergen.allergenType values (mirrors the AllergenType Prisma enum). */
export const ALLERGEN_TYPE_VALUES = ['FOOD', 'MEDICINE', 'ENVIRONMENT', 'OTHER'] as const;

export type AllergenTypeValue = (typeof ALLERGEN_TYPE_VALUES)[number];

/**
 * Localization keys (== English labels) for each allergen type.
 * Components render them via t(ALLERGEN_TYPE_LABELS[value]).
 */
export const ALLERGEN_TYPE_LABELS: Record<AllergenTypeValue, string> = {
  FOOD: 'Food',
  MEDICINE: 'Medicine',
  ENVIRONMENT: 'Environment',
  OTHER: 'Other',
};

/** Type guard for BabyAllergen.allergenType values. */
export function isValidAllergenType(value: unknown): value is AllergenTypeValue {
  return typeof value === 'string' && (ALLERGEN_TYPE_VALUES as readonly string[]).includes(value);
}

/** One food entry inside a multi-food meal (`FoodLog.foods` JSON). */
export interface FoodLogItem {
  foodId: string;
  hadReaction?: boolean;
  reactionDescription?: string | null;
}

/** Minimal shape of a FoodLog row the helpers need. */
export interface FoodLogLike {
  /** Legacy / dual-write single-food FK; null when N>1 foods are in `foods`. */
  foodId?: string | null;
  /** JSON text: FoodLogItem[] — preferred source for multi-food meals (#247). */
  foods?: string | null;
  time: Date | string;
  amount?: number | null;
  unitAbbr?: string | null;
  enjoyment?: string | null;
  /** Meal-level / legacy reaction flag (used when synthesizing from foodId-only rows). */
  hadReaction?: boolean;
  reactionDescription?: string | null;
  deletedAt?: Date | string | null;
}

/** Minimal shape of a Food catalog row the helpers need. */
export interface FoodLike {
  id: string;
  name: string;
  commonAllergen?: boolean;
}

export interface FoodProgress {
  uniqueFoodCount: number;
  totalTries: number;
  /** ISO time of the earliest (non-deleted) try per foodId. */
  firstTryByFoodId: Record<string, string>;
  countsByEnjoyment: Record<FoodEnjoymentValue, number>;
}

export interface AllergenEntry {
  foodId: string;
  foodName: string;
  commonAllergen: boolean;
  /** Reactions sorted oldest-first; description is null when none was given. */
  reactions: { time: string; description: string | null }[];
  /** ISO time of the first reaction-flagged log (when this allergen was first observed). */
  firstReactionAt: string;
}

/**
 * Leading/trailing junk stripped by normalizeFoodName: whitespace plus
 * periods, commas, hyphens, and straight/curly quotes (e.g. the ". carrots"
 * artifacts the SOLIDS conversion produced). Interior punctuation is kept so
 * names like "mac & cheese" or "banana-bread" survive.
 * Mirrored in scripts/convert-solids-feeds-core.js — keep them in sync.
 */
const EDGE_JUNK = /^[\s.,\-'"‘’“”]+|[\s.,\-'"‘’“”]+$/g;

/**
 * Trim, collapse internal whitespace, and strip leading/trailing punctuation
 * junk in a food name ('. carrots' → 'carrots').
 * Returns '' for empty or junk-only input (callers should reject that).
 */
export function normalizeFoodName(name: string): string {
  return name.replace(/\s+/g, ' ').replace(EDGE_JUNK, '');
}

/** Case-insensitive comparison key for catalog duplicate detection. */
export function foodNameKey(name: string): string {
  return normalizeFoodName(name).toLowerCase();
}

/** Format a time as the local-day YYYY-MM-DD string used by ?date= deep links. */
export function toDateParam(time: Date | string): string {
  const d = new Date(time);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Build a deep link to the log-entry timeline for the local day of `time`,
 * optionally selecting the baby the entry belongs to.
 */
export function buildLogEntryLink(slug: string, time: Date | string, babyId?: string): string {
  const params = new URLSearchParams({ date: toDateParam(time) });
  if (babyId) params.set('babyId', babyId);
  return `/${slug}/log-entry?${params.toString()}`;
}

/** True when `name` case-insensitively matches any of `existingNames`. */
export function isDuplicateFoodName(name: string, existingNames: string[]): boolean {
  const key = foodNameKey(name);
  return key !== '' && existingNames.some(existing => foodNameKey(existing) === key);
}

/** Minimal shape of a catalog food (with usage count) the manager helpers need. */
export interface FoodSummaryLike {
  id: string;
  name: string;
  /** Non-deleted food logs pointing at this food. */
  count: number;
}

export interface FoodDuplicateSuggestion {
  /** The non-canonical duplicate. */
  id: string;
  /** The canonical food it should merge into. */
  mergeIntoId: string;
}

/**
 * Groups foods whose names match after normalization (case-insensitive,
 * punctuation junk stripped); every non-canonical member of a group gets a
 * one-click merge suggestion. Canonical = highest count (ties broken by
 * name ascending, then id ascending for stability).
 */
export function getFoodDuplicateSuggestions(foods: FoodSummaryLike[]): FoodDuplicateSuggestion[] {
  const groups = new Map<string, FoodSummaryLike[]>();
  for (const food of foods) {
    const key = foodNameKey(food.name);
    if (key === '') continue;
    const group = groups.get(key);
    if (group) group.push(food);
    else groups.set(key, [food]);
  }

  const suggestions: FoodDuplicateSuggestion[] = [];
  for (const group of Array.from(groups.values())) {
    if (group.length < 2) continue;
    const canonical = [...group].sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )[0];
    for (const food of group) {
      if (food.id !== canonical.id) {
        suggestions.push({ id: food.id, mergeIntoId: canonical.id });
      }
    }
  }
  return suggestions;
}

export type FoodMergeValidation =
  | { valid: true; sourceFoodId: string; targetFoodId: string }
  | { valid: false; error: string };

/** Validates the body of a merge request (presence + source ≠ target). */
export function validateFoodMerge(sourceFoodId: unknown, targetFoodId: unknown): FoodMergeValidation {
  if (typeof sourceFoodId !== 'string' || sourceFoodId === '') {
    return { valid: false, error: 'A source food is required' };
  }
  if (typeof targetFoodId !== 'string' || targetFoodId === '') {
    return { valid: false, error: 'A target food is required' };
  }
  if (sourceFoodId === targetFoodId) {
    return { valid: false, error: 'A food cannot be merged into itself' };
  }
  return { valid: true, sourceFoodId, targetFoodId };
}

/** Type guard for FoodLog.enjoyment values. */
export function isValidEnjoyment(value: unknown): value is FoodEnjoymentValue {
  return typeof value === 'string' && (FOOD_ENJOYMENT_VALUES as readonly string[]).includes(value);
}

const toIso = (time: Date | string): string => new Date(time).toISOString();

const isDeleted = (log: FoodLogLike): boolean => log.deletedAt != null;

/** Parse `FoodLog.foods` JSON text into items; returns [] on missing/invalid. */
export function parseFoodsJson(foods: string | null | undefined): FoodLogItem[] {
  if (foods == null || foods === '') return [];
  try {
    const parsed = JSON.parse(foods);
    if (!Array.isArray(parsed)) return [];
    const items: FoodLogItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const foodId = (entry as FoodLogItem).foodId;
      if (typeof foodId !== 'string' || foodId === '') continue;
      items.push({
        foodId,
        hadReaction: (entry as FoodLogItem).hadReaction === true,
        reactionDescription:
          typeof (entry as FoodLogItem).reactionDescription === 'string'
            ? (entry as FoodLogItem).reactionDescription
            : (entry as FoodLogItem).reactionDescription ?? null,
      });
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Canonical read path for meal foods (#247 / #203 compat).
 * 1) Prefer non-empty `foods` JSON array
 * 2) Else synthesize one item from legacy `foodId` + row-level reaction fields
 * 3) Else []
 */
export function expandFoodItems(log: FoodLogLike): FoodLogItem[] {
  const fromJson = parseFoodsJson(log.foods);
  if (fromJson.length > 0) return fromJson;
  if (typeof log.foodId === 'string' && log.foodId !== '') {
    return [
      {
        foodId: log.foodId,
        hadReaction: log.hadReaction === true,
        reactionDescription: log.reactionDescription ?? null,
      },
    ];
  }
  return [];
}

/** Serialize food items for `FoodLog.foods` persistence. */
export function serializeFoodItems(items: FoodLogItem[]): string {
  return JSON.stringify(
    items.map(item => ({
      foodId: item.foodId,
      ...(item.hadReaction ? { hadReaction: true } : {}),
      ...(item.reactionDescription && item.reactionDescription.trim()
        ? { reactionDescription: item.reactionDescription.trim() }
        : {}),
    }))
  );
}

/**
 * Dual-write helpers for create/update: N=1 keeps foodId FK; N>1 clears it.
 * Also derives meal-level hadReaction from any item reaction.
 */
export function buildFoodLogFoodFields(items: FoodLogItem[]): {
  foodId: string | null;
  foods: string;
  hadReaction: boolean;
  reactionDescription: string | null;
} {
  const normalized = items.filter(item => typeof item.foodId === 'string' && item.foodId !== '');
  const reacting = normalized.filter(item => item.hadReaction === true);
  const firstDesc =
    reacting
      .map(item => item.reactionDescription?.trim())
      .find(desc => desc && desc.length > 0) ?? null;
  return {
    foodId: normalized.length === 1 ? normalized[0].foodId : null,
    foods: serializeFoodItems(normalized),
    hadReaction: reacting.length > 0,
    reactionDescription: firstDesc,
  };
}

/** Rewrite source foodId → target foodId inside a foods JSON string (merge). */
export function rewriteFoodsJsonIds(
  foodsJson: string | null | undefined,
  sourceFoodId: string,
  targetFoodId: string
): string | null {
  const items = parseFoodsJson(foodsJson);
  if (items.length === 0) return foodsJson ?? null;
  let changed = false;
  const next = items.map(item => {
    if (item.foodId === sourceFoodId) {
      changed = true;
      return { ...item, foodId: targetFoodId };
    }
    return item;
  });
  // Dedupe if both source and target were in the same meal
  const seen = new Set<string>();
  const deduped: FoodLogItem[] = [];
  for (const item of next) {
    if (seen.has(item.foodId)) {
      changed = true;
      const existing = deduped.find(d => d.foodId === item.foodId);
      if (existing && item.hadReaction) {
        existing.hadReaction = true;
        if (item.reactionDescription?.trim()) {
          existing.reactionDescription = item.reactionDescription;
        }
      }
      continue;
    }
    seen.add(item.foodId);
    deduped.push({ ...item });
  }
  return changed ? serializeFoodItems(deduped) : (foodsJson ?? null);
}

/** True when foods JSON references foodId (for catalog delete / count). */
export function foodsJsonReferencesFoodId(
  foodsJson: string | null | undefined,
  foodId: string
): boolean {
  return parseFoodsJson(foodsJson).some(item => item.foodId === foodId);
}

/** True if activity looks like a FoodLog (multi-food or legacy). */
export function isFoodLogActivity(
  activity: unknown
): activity is { foodId?: string | null; foods?: string | null; foodItems?: unknown[]; time?: string } {
  if (!activity || typeof activity !== 'object') return false;
  const a = activity as Record<string, unknown>;
  if ('foodItems' in a && Array.isArray(a.foodItems) && a.foodItems.length > 0) return true;
  if ('foods' in a && a.foods != null && a.foods !== '') return true;
  if ('foodId' in a && a.foodId != null && a.foodId !== '') return true;
  // Legacy / Prisma rows always include foodId key (may be null for multi-food);
  // treat presence of foods column key with null foodId as food when foods is set above.
  // Also accept foodId key alone for older clients that only send foodId (including empty during edit init).
  if ('foodId' in a) return true;
  return false;
}

/** One selected food in the meal composer, before it is persisted. */
export interface MealTagInput {
  foodId: string;
  hadReaction: boolean;
  reactionDescription: string | null;
}

/**
 * Build the `foods` items for a meal from the composer's selection.
 *
 * The invariant: a food is recorded as having reacted only when THAT FOOD's own
 * tag carries the flag. The meal-level switch is a suppressor, never a source —
 * turning it off clears every reaction, but turning it on cannot invent one.
 *
 * This replaces an inline branch that special-cased a single-food meal by
 * hard-coding `hadReaction: true` from the meal-level switch. Because the switch
 * is seeded on edit as "did any food in this meal react", editing a multi-food
 * meal down to one food wrote a reaction onto the survivor that it never had,
 * and dropped that food's own description (#247).
 */
export function buildMealItems(input: {
  tags: MealTagInput[];
  mealReaction: boolean;
}): FoodLogItem[] {
  return input.tags
    .filter(tag => typeof tag.foodId === 'string' && tag.foodId !== '')
    .map(tag => {
      const reacted = input.mealReaction && tag.hadReaction === true;
      const description = reacted ? tag.reactionDescription?.trim() : '';
      return {
        foodId: tag.foodId,
        hadReaction: reacted,
        reactionDescription: description ? description : null,
      };
    });
}

/**
 * Whether any food in the built meal actually reacted. Lets the form clear a
 * meal-level switch the user left on without flagging a food, so the saved row
 * and the UI agree.
 */
export function mealHasAnyReaction(items: FoodLogItem[]): boolean {
  return items.some(item => item.hadReaction === true);
}

/** Display title for a meal: "Banana", "Banana, Avocado", or "Banana +2". */
export function formatFoodMealTitle(
  names: string[],
  options?: { maxNames?: number }
): string {
  const cleaned = names.map(n => n.trim()).filter(Boolean);
  if (cleaned.length === 0) return '';
  const maxNames = options?.maxNames ?? 2;
  if (cleaned.length <= maxNames) return cleaned.join(', ');
  return `${cleaned.slice(0, maxNames).join(', ')} +${cleaned.length - maxNames}`;
}

/**
 * First-try times per foodId across expanded meal items (JS; replaces Prisma groupBy).
 * Returns ISO times of earliest non-deleted try per food.
 */
export function computeFirstTryByFoodId(logs: FoodLogLike[]): Record<string, string> {
  return computeFoodProgress(logs).firstTryByFoodId;
}

/** Whether this meal includes any food whose first-ever try is this meal's time. */
export function mealIncludesFirstTry(
  log: FoodLogLike,
  firstTryByFoodId: Record<string, string>
): boolean {
  if (isDeleted(log)) return false;
  const time = toIso(log.time);
  return expandFoodItems(log).some(item => firstTryByFoodId[item.foodId] === time);
}

/**
 * All-time food-try progress for a baby ("100 foods before 1").
 * Soft-deleted logs are excluded; the same food tried N times counts once.
 * Multi-food meals expand items for unique/first-try; totalTries = meal count.
 */
export function computeFoodProgress(logs: FoodLogLike[]): FoodProgress {
  const firstTryByFoodId: Record<string, string> = {};
  const countsByEnjoyment = Object.fromEntries(
    FOOD_ENJOYMENT_VALUES.map(value => [value, 0])
  ) as Record<FoodEnjoymentValue, number>;
  let totalTries = 0;

  for (const log of logs) {
    if (isDeleted(log)) continue;
    const items = expandFoodItems(log);
    if (items.length === 0) continue;
    totalTries += 1;
    const time = toIso(log.time);
    for (const item of items) {
      const existing = firstTryByFoodId[item.foodId];
      if (!existing || time < existing) {
        firstTryByFoodId[item.foodId] = time;
      }
    }
    if (isValidEnjoyment(log.enjoyment)) {
      countsByEnjoyment[log.enjoyment] += 1;
    }
  }

  return {
    uniqueFoodCount: Object.keys(firstTryByFoodId).length,
    totalTries,
    firstTryByFoodId,
    countsByEnjoyment,
  };
}

/**
 * Derive the baby's allergen/reaction profile from reaction-flagged food items.
 * Multi-food meals only flag foods whose item hadReaction is true.
 * Entries sort by food name.
 */
export function deriveAllergens(logs: FoodLogLike[], foods: FoodLike[]): AllergenEntry[] {
  const foodsById = new Map(foods.map(food => [food.id, food]));
  const entriesByFoodId = new Map<string, AllergenEntry>();

  for (const log of logs) {
    if (isDeleted(log)) continue;
    const time = toIso(log.time);
    for (const item of expandFoodItems(log)) {
      if (item.hadReaction !== true) continue;
      const food = foodsById.get(item.foodId);
      if (!food) continue;
      let entry = entriesByFoodId.get(food.id);
      if (!entry) {
        entry = {
          foodId: food.id,
          foodName: food.name,
          commonAllergen: food.commonAllergen === true,
          reactions: [],
          firstReactionAt: '',
        };
        entriesByFoodId.set(food.id, entry);
      }
      const description =
        item.reactionDescription && item.reactionDescription.trim()
          ? item.reactionDescription.trim()
          : null;
      entry.reactions.push({ time, description });
    }
  }

  const entries = Array.from(entriesByFoodId.values());
  for (const entry of entries) {
    entry.reactions.sort((a, b) => a.time.localeCompare(b.time));
    entry.firstReactionAt = entry.reactions[0].time;
  }
  return entries.sort((a, b) => a.foodName.localeCompare(b.foodName));
}

/** A FoodLog row with the joined catalog food, as returned by /api/food-log. */
export type FoodLogWithFood = FoodLogLike & {
  food?: FoodLike | null;
  /** Optional catalog map for multi-food meals (foodId → Food). */
  foodsById?: Record<string, FoodLike | undefined> | Map<string, FoodLike>;
};

/** Resolve catalog metadata for a foodId from a log join or foodsById map. */
function resolveFoodMeta(log: FoodLogWithFood, foodId: string): FoodLike | null {
  if (log.food?.id === foodId) return log.food;
  if (log.foodsById instanceof Map) return log.foodsById.get(foodId) ?? null;
  if (log.foodsById && typeof log.foodsById === 'object') {
    return log.foodsById[foodId] ?? null;
  }
  return null;
}

/** One row of the per-food history list on the FoodForm Progress tab. */
export interface FoodTryListEntry {
  foodId: string;
  foodName: string;
  commonAllergen: boolean;
  tryCount: number;
  /** ISO time of the earliest (non-deleted) try. */
  firstTryTime: string;
  /** ISO time of the latest (non-deleted) try. */
  latestTryTime: string;
  /** Enjoyment of the most recent try that recorded one, or null. */
  latestEnjoyment: FoodEnjoymentValue | null;
  /** True when any non-deleted try was reaction-flagged. */
  hadReaction: boolean;
  /** Amount totals keyed by lowercase unit abbreviation (e.g. { tbsp: 3, g: 20 }). */
  totalAmounts: Record<string, number>;
}

/**
 * Format per-unit amount totals for display (e.g. '3 tbsp, 20 g').
 * Returns '' when there are no amounts. Units sort alphabetically for a
 * stable rendering across days.
 */
export function formatAmountsByUnit(amounts: Record<string, number>): string {
  return Object.entries(amounts)
    .filter(([, total]) => total > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, total]) => `${Math.round(total * 100) / 100} ${unit.toLowerCase()}`)
    .join(', ');
}

/**
 * Group food logs into a per-food history list (name, try count, first/latest
 * try, latest enjoyment, reaction flag) for display. Soft-deleted logs are
 * excluded; multi-food meals count +1 try per included food; entries sort
 * newest-latest-try first.
 */
export function buildFoodTryList(logs: FoodLogWithFood[]): FoodTryListEntry[] {
  const entriesByFoodId = new Map<string, FoodTryListEntry & { latestEnjoymentTime: string | null }>();

  for (const log of logs) {
    if (isDeleted(log)) continue;
    const items = expandFoodItems(log);
    if (items.length === 0) continue;
    const time = toIso(log.time);
    for (const item of items) {
      const meta = resolveFoodMeta(log, item.foodId);
      let entry = entriesByFoodId.get(item.foodId);
      if (!entry) {
        entry = {
          foodId: item.foodId,
          foodName: meta?.name || '',
          commonAllergen: meta?.commonAllergen === true,
          tryCount: 0,
          firstTryTime: time,
          latestTryTime: time,
          latestEnjoyment: null,
          latestEnjoymentTime: null,
          hadReaction: false,
          totalAmounts: {},
        };
        entriesByFoodId.set(item.foodId, entry);
      }
      if (meta?.name) entry.foodName = meta.name;
      if (meta?.commonAllergen === true) entry.commonAllergen = true;
      entry.tryCount += 1;
      // Meal-level amount only attaches when the meal has a single food (N=1),
      // so multi-food meals don't inflate every food's totals with the shared amount.
      if (items.length === 1 && typeof log.amount === 'number' && log.amount > 0) {
        const unit = (log.unitAbbr || 'g').toLowerCase();
        entry.totalAmounts[unit] = (entry.totalAmounts[unit] || 0) + log.amount;
      }
      if (time < entry.firstTryTime) entry.firstTryTime = time;
      if (time > entry.latestTryTime) entry.latestTryTime = time;
      if (isValidEnjoyment(log.enjoyment) && (entry.latestEnjoymentTime === null || time >= entry.latestEnjoymentTime)) {
        entry.latestEnjoyment = log.enjoyment;
        entry.latestEnjoymentTime = time;
      }
      if (item.hadReaction === true) entry.hadReaction = true;
    }
  }

  return Array.from(entriesByFoodId.values())
    .map(({ latestEnjoymentTime, ...entry }) => entry)
    .sort((a, b) => b.latestTryTime.localeCompare(a.latestTryTime));
}

/**
 * Count foods whose FIRST (all-time, non-deleted) try falls within
 * [start, end] — the "new foods in range" stat for Reports. `logs` must be the
 * baby's full all-time log list, otherwise first tries are misidentified.
 */
export function countFirstTriesInRange(logs: FoodLogLike[], start: Date | string, end: Date | string): number {
  const { firstTryByFoodId } = computeFoodProgress(logs);
  const startIso = toIso(start);
  const endIso = toIso(end);
  return Object.values(firstTryByFoodId).filter(time => time >= startIso && time <= endIso).length;
}

/** One "new food this month" row for the Monthly Report Foods section. */
export interface NewFoodEntry {
  foodId: string;
  foodName: string;
  commonAllergen: boolean;
  /** ISO time of the food's first-ever (non-deleted) try. */
  firstTryTime: string;
  /** Enjoyment of the most recent in-range try that recorded one, or null. */
  enjoyment: FoodEnjoymentValue | null;
  /** True when any in-range try of this food was reaction-flagged. */
  hadReaction: boolean;
}

/**
 * Foods whose FIRST-ever (non-deleted) try falls within [start, end], with the
 * enjoyment/reaction outcome of their in-range tries. `logs` must be the
 * baby's full all-time log list (with the food join), otherwise first tries
 * are misidentified. Entries sort by first try, oldest first.
 */
export function buildNewFoodsForRange(
  logs: FoodLogWithFood[],
  start: Date | string,
  end: Date | string
): NewFoodEntry[] {
  const { firstTryByFoodId } = computeFoodProgress(logs);
  const startIso = toIso(start);
  const endIso = toIso(end);

  const entriesByFoodId = new Map<string, NewFoodEntry & { latestEnjoymentTime: string | null }>();
  for (const [foodId, firstTry] of Object.entries(firstTryByFoodId)) {
    if (firstTry >= startIso && firstTry <= endIso) {
      entriesByFoodId.set(foodId, {
        foodId,
        foodName: '',
        commonAllergen: false,
        firstTryTime: firstTry,
        enjoyment: null,
        latestEnjoymentTime: null,
        hadReaction: false,
      });
    }
  }

  for (const log of logs) {
    if (isDeleted(log)) continue;
    const time = toIso(log.time);
    for (const item of expandFoodItems(log)) {
      const entry = entriesByFoodId.get(item.foodId);
      if (!entry) continue;
      const meta = resolveFoodMeta(log, item.foodId);
      if (meta?.name) entry.foodName = meta.name;
      if (meta?.commonAllergen === true) entry.commonAllergen = true;
      if (time < startIso || time > endIso) continue;
      if (isValidEnjoyment(log.enjoyment) && (entry.latestEnjoymentTime === null || time >= entry.latestEnjoymentTime)) {
        entry.enjoyment = log.enjoyment;
        entry.latestEnjoymentTime = time;
      }
      if (item.hadReaction === true) entry.hadReaction = true;
    }
  }

  return Array.from(entriesByFoodId.values())
    .map(({ latestEnjoymentTime, ...entry }) => entry)
    .sort((a, b) => a.firstTryTime.localeCompare(b.firstTryTime));
}

/** Minimal shape of a FeedLog row the feed-reaction helpers need. */
export interface ReactionFeedLogLike {
  time: Date | string;
  /** Solids description text ("carrot"), when the feed was SOLIDS. */
  food?: string | null;
  hadReaction?: boolean;
  reactionDescription?: string | null;
  /** What caused the reaction (e.g. a formula name like "Similac"). */
  reactionCause?: string | null;
  deletedAt?: Date | string | null;
}

/** An allergen derived from reaction-flagged feed logs. */
export interface FeedAllergenEntry {
  /**
   * The `reactionCause` text when present, else the solids `food` text;
   * null groups reaction-flagged feeds without either (UI localizes the label).
   */
  name: string | null;
  /** Reactions sorted oldest-first; description is null when none was given. */
  reactions: { time: string; description: string | null }[];
  /** ISO time of the first reaction-flagged feed (when this allergen was first observed). */
  firstReactionAt: string;
}

const GENERIC_FEED_KEY = ' generic-feed';

/**
 * Derive allergens from reaction-flagged feed logs. Feeds group
 * case-insensitively by `reactionCause` when present (e.g. a formula name),
 * else by the solids `food` text; reaction-flagged feeds with neither (e.g. a
 * formula bottle) group into a single generic entry with `name: null`.
 * Entries sort by name, generic entry last.
 */
export function deriveFeedAllergens(logs: ReactionFeedLogLike[]): FeedAllergenEntry[] {
  const entriesByKey = new Map<string, FeedAllergenEntry & { earliestTime: string }>();

  for (const log of logs) {
    if (log.deletedAt != null || log.hadReaction !== true) continue;
    const name =
      (log.reactionCause && normalizeFoodName(log.reactionCause)) ||
      (log.food && normalizeFoodName(log.food)) ||
      null;
    const key = name === null ? GENERIC_FEED_KEY : foodNameKey(name);
    const time = toIso(log.time);
    let entry = entriesByKey.get(key);
    if (!entry) {
      entry = { name, reactions: [], firstReactionAt: '', earliestTime: time };
      entriesByKey.set(key, entry);
    } else if (time < entry.earliestTime) {
      // Display the food text as first recorded (casings may differ per log)
      entry.earliestTime = time;
      entry.name = name;
    }
    const description =
      log.reactionDescription && log.reactionDescription.trim()
        ? log.reactionDescription.trim()
        : null;
    entry.reactions.push({ time, description });
  }

  const entries = Array.from(entriesByKey.values()).map(({ earliestTime, ...entry }) => entry);
  for (const entry of entries) {
    entry.reactions.sort((a, b) => a.time.localeCompare(b.time));
    entry.firstReactionAt = entry.reactions[0].time;
  }
  return entries.sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    return a.name.localeCompare(b.name);
  });
}

/** Minimal shape of a manual BabyAllergen row the merge helper needs. */
export interface ManualAllergenLike {
  id: string;
  name: string;
  allergenType?: string | null;
  reactionDescription?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  deletedAt?: Date | string | null;
}

export type AllergenSourceType = 'manual' | 'food-log' | 'feed';

const ALLERGEN_SOURCE_ORDER: AllergenSourceType[] = ['manual', 'food-log', 'feed'];

/** One row of the combined (derived + manual) allergen list. */
export interface MergedAllergen {
  /** Display name; null only for the generic bottle/formula feed entry (UI localizes it). */
  name: string | null;
  /** Where this allergen is recorded, in ['manual', 'food-log', 'feed'] order. */
  sources: AllergenSourceType[];
  /** Manual entry's type when present; derived entries are FOOD. */
  allergenType: AllergenTypeValue;
  /** BabyAllergen id when a manual entry contributed (enables delete). */
  manualId: string | null;
  commonAllergen: boolean;
  /** Manual reaction description first, then unique derived descriptions. */
  reactionDescriptions: string[];
  /** Derived reaction events (food logs + feeds), oldest first. */
  reactions: { time: string; description: string | null }[];
  notes: string | null;
  /** ISO time the allergen was first recorded: manual createdAt / first derived reaction (earliest wins). */
  dateAdded: string;
}

/**
 * Combine allergens derived from reaction-flagged food logs (and optionally
 * feed logs) with manually recorded BabyAllergen entries. Entries dedupe
 * case-insensitively by name; when both exist the manual entry wins for
 * metadata (display name, type, notes) while derived reaction events are
 * kept. Returns a stable name-sorted list (generic feed entry last), each
 * entry carrying its source(s) and the earliest date it was recorded.
 */
export function mergeAllergens(
  derived: AllergenEntry[],
  manual: ManualAllergenLike[],
  feedDerived: FeedAllergenEntry[] = []
): MergedAllergen[] {
  const entriesByKey = new Map<string, MergedAllergen>();

  const minIso = (a: string, b: string): string => (a !== '' && a <= b ? a : b === '' ? a : b);

  for (const entry of derived) {
    const key = foodNameKey(entry.foodName);
    entriesByKey.set(key, {
      name: entry.foodName,
      sources: ['food-log'],
      allergenType: 'FOOD',
      manualId: null,
      commonAllergen: entry.commonAllergen,
      reactionDescriptions: [],
      reactions: [...entry.reactions],
      notes: null,
      dateAdded: entry.firstReactionAt,
    });
  }

  for (const entry of feedDerived) {
    const key = entry.name === null ? GENERIC_FEED_KEY : foodNameKey(entry.name);
    const existing = entriesByKey.get(key);
    if (existing) {
      existing.sources.push('feed');
      existing.reactions = [...existing.reactions, ...entry.reactions]
        .sort((a, b) => a.time.localeCompare(b.time));
      existing.dateAdded = minIso(existing.dateAdded, entry.firstReactionAt);
    } else {
      entriesByKey.set(key, {
        name: entry.name,
        sources: ['feed'],
        allergenType: 'FOOD',
        manualId: null,
        commonAllergen: false,
        reactionDescriptions: [],
        reactions: [...entry.reactions],
        notes: null,
        dateAdded: entry.firstReactionAt,
      });
    }
  }

  for (const entry of manual) {
    if (entry.deletedAt != null) continue;
    const name = normalizeFoodName(entry.name);
    if (!name) continue;
    const key = foodNameKey(name);
    const createdAt = toIso(entry.createdAt);
    const manualType = isValidAllergenType(entry.allergenType) ? entry.allergenType : 'OTHER';
    const manualDescription =
      entry.reactionDescription && entry.reactionDescription.trim()
        ? entry.reactionDescription.trim()
        : null;
    const manualNotes = entry.notes && entry.notes.trim() ? entry.notes.trim() : null;

    const existing = entriesByKey.get(key);
    if (existing) {
      // Manual entry wins for metadata; derived reaction events are kept
      existing.sources.push('manual');
      existing.name = name;
      existing.allergenType = manualType;
      existing.manualId = entry.id;
      existing.notes = manualNotes;
      if (manualDescription) existing.reactionDescriptions.unshift(manualDescription);
      existing.dateAdded = minIso(existing.dateAdded, createdAt);
    } else {
      entriesByKey.set(key, {
        name,
        sources: ['manual'],
        allergenType: manualType,
        manualId: entry.id,
        commonAllergen: false,
        reactionDescriptions: manualDescription ? [manualDescription] : [],
        reactions: [],
        notes: manualNotes,
        dateAdded: createdAt,
      });
    }
  }

  const entries = Array.from(entriesByKey.values());
  for (const entry of entries) {
    entry.sources = ALLERGEN_SOURCE_ORDER.filter(source => entry.sources.includes(source));
    // Fold unique derived descriptions in after any manual description
    for (const reaction of entry.reactions) {
      if (reaction.description && !entry.reactionDescriptions.includes(reaction.description)) {
        entry.reactionDescriptions.push(reaction.description);
      }
    }
  }
  return entries.sort((a, b) => {
    if (a.name === null) return 1;
    if (b.name === null) return -1;
    return foodNameKey(a.name).localeCompare(foodNameKey(b.name)) || a.name.localeCompare(b.name);
  });
}
