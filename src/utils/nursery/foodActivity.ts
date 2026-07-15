/**
 * Pure helpers for the nursery-mode food card: catalog ordering for the
 * tap-to-log picker and meta-line note formatting. Kept free of i18n/React so
 * they're testable without mocking localization — callers pass
 * already-localized labels (tests/nursery-food-activity.test.ts).
 */

export interface NurseryFoodItem {
  id: string;
  name: string;
  /** Non-deleted logs for this food (family-wide), from GET /api/food. */
  foodLogCount?: number;
}

/** Most-logged foods first; ties and never-logged foods alphabetical. Returns a new array. */
export function sortFoodsByFrequency<T extends NurseryFoodItem>(foods: readonly T[]): T[] {
  return [...foods].sort(
    (a, b) => (b.foodLogCount ?? 0) - (a.foodLogCount ?? 0) || a.name.localeCompare(b.name),
  );
}

export interface FoodLogNoteData {
  foodName: string;
  enjoymentLabel?: string | null;
}

/** "Banana" or "Banana · Loved" — the food card's meta-line note. */
export function formatFoodLogNote(data: FoodLogNoteData): string {
  return data.enjoymentLabel ? `${data.foodName} · ${data.enjoymentLabel}` : data.foodName;
}
