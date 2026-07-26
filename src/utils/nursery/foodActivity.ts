/**
 * Pure helpers for the nursery-mode food card: catalog ordering for the
 * tap-to-log picker and meta-line note formatting. Kept free of i18n/React so
 * they're testable without mocking localization — callers pass
 * already-localized labels (tests/nursery-food-activity.test.ts).
 */

export interface NurseryFoodItem {
  id: string;
  name: string;
}

/** Alphabetical by name. Returns a new array. */
export function sortFoodsByName<T extends NurseryFoodItem>(foods: readonly T[]): T[] {
  return [...foods].sort((a, b) => a.name.localeCompare(b.name));
}

/** Case-insensitive substring match on the food name; a blank query returns everything. */
export function filterFoodsByQuery<T extends NurseryFoodItem>(foods: readonly T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...foods];
  return foods.filter(f => f.name.toLowerCase().includes(q));
}

export interface FoodLogNoteData {
  foodName: string;
  enjoymentLabel?: string | null;
}

/** "Banana" or "Banana · Loved" — the food card's meta-line note. */
export function formatFoodLogNote(data: FoodLogNoteData): string {
  return data.enjoymentLabel ? `${data.foodName} · ${data.enjoymentLabel}` : data.foodName;
}
