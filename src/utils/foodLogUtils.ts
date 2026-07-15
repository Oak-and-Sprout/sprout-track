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
