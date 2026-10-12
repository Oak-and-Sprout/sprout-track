import { formatAmountsByUnit, sumAmountsByUnit } from './foodLogUtils';

/**
 * Pure state helpers for the multi-food meal composer in the Food Tracker
 * (#271). Each selected food tag holds its own amount; the shared Amount
 * stepper edits a pending draft for the selected tag, which the Update button
 * (or switching tags / saving) commits.
 */

/** A food's amount as edited in the form: raw input ('' = not recorded) + unit. */
export interface FoodAmountDraft {
  amount: string;
  unitAbbr: string;
}

/** Positive amount parsed from raw input, else null. */
function parseAmount(raw: string): number | null {
  const value = parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A blank or non-positive amount clears it; "15." → "15". */
function normalizeDraft(draft: FoodAmountDraft): FoodAmountDraft {
  const amount = parseAmount(draft.amount);
  return { amount: amount === null ? '' : String(amount), unitAbbr: draft.unitAbbr };
}

/** A tag's amount for its badge ("15 g"), or '' when none is recorded. */
export function formatFoodTagAmount(draft: FoodAmountDraft, unitLabel: (unitAbbr: string) => string): string {
  const amount = parseAmount(draft.amount);
  return amount === null ? '' : `${amount} ${unitLabel(draft.unitAbbr)}`;
}

/** Whether the pending draft differs from the tag's saved amount (a unit only counts with an amount). */
export function isAmountDraftDirty(draft: FoodAmountDraft, saved: FoodAmountDraft): boolean {
  const pending = parseAmount(draft.amount);
  const current = parseAmount(saved.amount);
  if (pending === null || current === null) return pending !== current;
  return pending !== current || draft.unitAbbr !== saved.unitAbbr;
}

/** Commit a pending draft to the tag at `index`; the same array when there is nothing to apply. */
export function applyAmountDraft<T extends FoodAmountDraft>(tags: T[], index: number | null, draft: FoodAmountDraft): T[] {
  if (index === null || !tags[index] || !isAmountDraftDirty(draft, tags[index])) return tags;
  return tags.map((tag, i) => (i === index ? { ...tag, ...normalizeDraft(draft) } : tag));
}

/**
 * Add a food to the meal. When a second food arrives, the first takes the meal
 * amount: with one food the stepper was that food's amount (the inverse of
 * folding the last food's amount back into the meal on removal).
 */
export function addFoodTagToMeal<T extends FoodAmountDraft>(tags: T[], tag: T, mealAmount: FoodAmountDraft): T[] {
  if (tags.length !== 1) return [...tags, tag];
  return [{ ...tags[0], ...normalizeDraft(mealAmount) }, tag];
}

/**
 * Which tag is selected after removing the one at `removed`, given how many
 * remain: none below two foods (the single-food path edits the meal amount),
 * the same food when another is removed, else its neighbour.
 */
export function selectionAfterRemove(selected: number | null, removed: number, remaining: number): number | null {
  if (remaining < 2) return null;
  if (selected === null) return 0;
  if (removed < selected) return selected - 1;
  return Math.min(selected, remaining - 1);
}

/** Meal total of a multi-food meal's per-food amounts ("25 g", "15 g, 3 tbsp"); '' for one food or none. */
export function formatMealTotal(tags: FoodAmountDraft[]): string {
  if (tags.length < 2) return '';
  return formatAmountsByUnit(sumAmountsByUnit(tags.map(tag => ({ amount: parseAmount(tag.amount), unitAbbr: tag.unitAbbr }))));
}
