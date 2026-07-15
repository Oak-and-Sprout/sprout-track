/**
 * Pure helpers for the food tracker (issue #203): food-name normalization and
 * duplicate detection for the family catalog, enjoyment validation,
 * "N unique foods tried" progress computation, and derivation of the baby's
 * allergen/reaction profile from reaction-flagged food logs.
 *
 * Kept free of Prisma/React so they can be unit tested (tests/foodLogUtils.test.ts).
 */
import { COMMON_ALLERGEN_KEYWORDS } from '@/src/constants/commonAllergens';

/** Valid FoodLog.enjoyment values (mirrors the FoodEnjoyment Prisma enum). */
export const FOOD_ENJOYMENT_VALUES = ['HATED', 'DISLIKED', 'NEUTRAL', 'LIKED', 'LOVED'] as const;

export type FoodEnjoymentValue = (typeof FOOD_ENJOYMENT_VALUES)[number];

/** The "100 foods before 1" goal the progress view counts toward. */
export const UNIQUE_FOOD_GOAL = 100;

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

/** Minimal shape of a FoodLog row the helpers need. */
export interface FoodLogLike {
  foodId: string;
  time: Date | string;
  enjoyment?: string | null;
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
 * Trim and collapse internal whitespace in a food name.
 * Returns '' for empty or whitespace-only input (callers should reject that).
 */
export function normalizeFoodName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
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

/** Type guard for FoodLog.enjoyment values. */
export function isValidEnjoyment(value: unknown): value is FoodEnjoymentValue {
  return typeof value === 'string' && (FOOD_ENJOYMENT_VALUES as readonly string[]).includes(value);
}

/**
 * True when a food name contains a big-9 common-allergen keyword,
 * used to pre-suggest the catalog `commonAllergen` flag.
 */
export function isLikelyCommonAllergen(name: string): boolean {
  const key = foodNameKey(name);
  return key !== '' && COMMON_ALLERGEN_KEYWORDS.some(keyword => key.includes(keyword));
}

const toIso = (time: Date | string): string => new Date(time).toISOString();

const isDeleted = (log: FoodLogLike): boolean => log.deletedAt != null;

/**
 * All-time food-try progress for a baby ("100 foods before 1").
 * Soft-deleted logs are excluded; the same food tried N times counts once.
 */
export function computeFoodProgress(logs: FoodLogLike[]): FoodProgress {
  const firstTryByFoodId: Record<string, string> = {};
  const countsByEnjoyment = Object.fromEntries(
    FOOD_ENJOYMENT_VALUES.map(value => [value, 0])
  ) as Record<FoodEnjoymentValue, number>;
  let totalTries = 0;

  for (const log of logs) {
    if (isDeleted(log)) continue;
    totalTries += 1;
    const time = toIso(log.time);
    const existing = firstTryByFoodId[log.foodId];
    if (!existing || time < existing) {
      firstTryByFoodId[log.foodId] = time;
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
 * Derive the baby's allergen/reaction profile from reaction-flagged logs.
 * Only foods with at least one non-deleted `hadReaction` log appear; each entry
 * aggregates that food's reactions (oldest first). Entries sort by food name.
 */
export function deriveAllergens(logs: FoodLogLike[], foods: FoodLike[]): AllergenEntry[] {
  const foodsById = new Map(foods.map(food => [food.id, food]));
  const entriesByFoodId = new Map<string, AllergenEntry>();

  for (const log of logs) {
    if (isDeleted(log) || !log.hadReaction) continue;
    const food = foodsById.get(log.foodId);
    if (!food) continue;
    let entry = entriesByFoodId.get(food.id);
    if (!entry) {
      entry = {
        foodId: food.id,
        foodName: food.name,
        commonAllergen: food.commonAllergen === true,
        reactions: [],
        firstReactionAt: '', // set after reactions are sorted
      };
      entriesByFoodId.set(food.id, entry);
    }
    const description =
      log.reactionDescription && log.reactionDescription.trim()
        ? log.reactionDescription.trim()
        : null;
    entry.reactions.push({ time: toIso(log.time), description });
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
};

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
}

/**
 * Group food logs into a per-food history list (name, try count, first/latest
 * try, latest enjoyment, reaction flag) for display. Soft-deleted logs are
 * excluded; entries sort newest-latest-try first.
 */
export function buildFoodTryList(logs: FoodLogWithFood[]): FoodTryListEntry[] {
  const entriesByFoodId = new Map<string, FoodTryListEntry & { latestEnjoymentTime: string | null }>();

  for (const log of logs) {
    if (isDeleted(log)) continue;
    const time = toIso(log.time);
    let entry = entriesByFoodId.get(log.foodId);
    if (!entry) {
      entry = {
        foodId: log.foodId,
        foodName: log.food?.name || '',
        commonAllergen: log.food?.commonAllergen === true,
        tryCount: 0,
        firstTryTime: time,
        latestTryTime: time,
        latestEnjoyment: null,
        latestEnjoymentTime: null,
        hadReaction: false,
      };
      entriesByFoodId.set(log.foodId, entry);
    }
    entry.tryCount += 1;
    if (time < entry.firstTryTime) entry.firstTryTime = time;
    if (time > entry.latestTryTime) entry.latestTryTime = time;
    if (isValidEnjoyment(log.enjoyment) && (entry.latestEnjoymentTime === null || time >= entry.latestEnjoymentTime)) {
      entry.latestEnjoyment = log.enjoyment;
      entry.latestEnjoymentTime = time;
    }
    if (log.hadReaction === true) entry.hadReaction = true;
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
    const entry = entriesByFoodId.get(log.foodId);
    if (!entry) continue;
    if (log.food?.name) entry.foodName = log.food.name;
    if (log.food?.commonAllergen === true) entry.commonAllergen = true;
    const time = toIso(log.time);
    if (time < startIso || time > endIso) continue;
    if (isValidEnjoyment(log.enjoyment) && (entry.latestEnjoymentTime === null || time >= entry.latestEnjoymentTime)) {
      entry.enjoyment = log.enjoyment;
      entry.latestEnjoymentTime = time;
    }
    if (log.hadReaction === true) entry.hadReaction = true;
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
