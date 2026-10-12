import { formatAmountsByUnit, sumAmountsByUnit, normalizeFoodName, foodNameKey, type FoodEnjoymentValue } from './foodLogUtils';

/**
 * Pure state helpers for the Food Tracker's meal composer (#271). One food is
 * composed at a time in the entry box (name, amount, unit); Save turns it into
 * a tag. Tapping a tag loads it back into the box, and Save writes it back in
 * place.
 */

/** A food's amount as edited in the form: raw input ('' = not recorded) + unit. */
export interface FoodAmountDraft {
  amount: string;
  unitAbbr: string;
}

/** The entry box: the food being composed or edited. */
export interface FoodEntry extends FoodAmountDraft {
  name: string;
  /** Allergen flag for a new food (catalog foods use the catalog's). */
  commonAllergen: boolean;
}

/** One food tag in the meal. */
export interface MealFood extends FoodAmountDraft {
  /** Catalog id when known; undefined for a new name not yet created. */
  foodId?: string;
  name: string;
  commonAllergen: boolean;
  isNew: boolean;
  hadReaction: boolean;
  reactionDescription: string;
  enjoyment: FoodEnjoymentValue | null;
}

interface CatalogFood {
  id: string;
  name: string;
  commonAllergen: boolean;
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

/** Meal total of a multi-food meal's per-food amounts ("25 g", "15 g, 3 tbsp"); '' for one food or none. */
export function formatMealTotal(meal: FoodAmountDraft[]): string {
  if (meal.length < 2) return '';
  return formatAmountsByUnit(sumAmountsByUnit(meal.map(tag => ({ amount: parseAmount(tag.amount), unitAbbr: tag.unitAbbr }))));
}

/** The box can be saved once it names a food. */
export function canSaveEntry(entry: Pick<FoodEntry, 'name'>): boolean {
  return normalizeFoodName(entry.name) !== '';
}

/** An empty box after Save / cancel; the unit sticks for the next food. */
export function clearEntry(entry: FoodEntry): FoodEntry {
  return { name: '', amount: '', unitAbbr: entry.unitAbbr, commonAllergen: false };
}

/** The box contents for editing the tag at `index`. */
export function loadEntry(meal: MealFood[], index: number): FoodEntry {
  const { name, amount, unitAbbr, commonAllergen } = meal[index];
  return { name, amount, unitAbbr, commonAllergen };
}

/**
 * Save the box into the meal. Editing (`editingIndex`) replaces that tag in
 * place, keeping its reaction and enjoyment; adding appends a tag. A name
 * already in the meal merges into that tag instead of duplicating it (an
 * entry without an amount then keeps the tag's). The same meal when the box
 * names no food.
 */
export function commitEntry(meal: MealFood[], entry: FoodEntry, editingIndex: number | null, catalog: CatalogFood[]): MealFood[] {
  if (!canSaveEntry(entry)) return meal;
  const name = normalizeFoodName(entry.name);
  const known = catalog.find(food => foodNameKey(food.name) === foodNameKey(name));
  const identity = known
    ? { foodId: known.id, name: known.name, commonAllergen: known.commonAllergen, isNew: false }
    : { foodId: undefined, name, commonAllergen: entry.commonAllergen, isNew: true };
  const editing = editingIndex !== null && editingIndex < meal.length ? editingIndex : null;
  const duplicate = meal.findIndex((tag, i) => i !== editing && foodNameKey(tag.name) === foodNameKey(identity.name));
  const amount = normalizeDraft(entry);

  if (duplicate < 0 && editing === null) {
    return [...meal, { ...identity, ...amount, hadReaction: false, reactionDescription: '', enjoyment: null }];
  }
  const target = duplicate >= 0 ? duplicate : (editing as number);
  const update = duplicate >= 0 && !amount.amount ? identity : { ...identity, ...amount };
  return meal
    .map((tag, i) => (i === target ? { ...tag, ...update } : tag))
    .filter((_, i) => i === target || i !== editing);
}

/**
 * Remove the tag at `index`. `shared` is a pre-#271 meal amount (a multi-food
 * entry saved with one amount for the whole meal): it folds onto the last food
 * left, and is dropped once any food had its own amount.
 */
export function removeFood(
  meal: MealFood[],
  index: number,
  shared: FoodAmountDraft | null
): { meal: MealFood[]; shared: FoodAmountDraft | null } {
  const next = meal.filter((_, i) => i !== index);
  if (next.length > 1 || !shared) return { meal: next, shared: next.length > 1 ? shared : null };
  const fold = next.length === 1 && !meal.some(tag => parseAmount(tag.amount) !== null);
  return { meal: fold ? [{ ...next[0], ...normalizeDraft(shared) }] : next, shared: null };
}

/** The tag being edited after removing the one at `removed` (null when it was the one removed). */
export function editingAfterRemove(editing: number | null, removed: number): number | null {
  if (editing === null || editing === removed) return null;
  return removed < editing ? editing - 1 : editing;
}

/**
 * Amounts for a saved entry's tags: a single-food entry's row amount belongs
 * to its food; a pre-#271 multi-food entry with only a row amount keeps it as
 * the shared amount.
 */
export function seedMealAmounts(meal: MealFood[], row: FoodAmountDraft): { meal: MealFood[]; shared: FoodAmountDraft | null } {
  const rowAmount = parseAmount(row.amount) === null ? null : normalizeDraft(row);
  const ownAmounts = meal.some(tag => parseAmount(tag.amount) !== null);
  if (meal.length === 1) return { meal: ownAmounts || !rowAmount ? meal : [{ ...meal[0], ...rowAmount }], shared: null };
  return { meal, shared: ownAmounts ? null : rowAmount };
}

/**
 * The row amount to save: a single food's own amount; for several foods none
 * (the server derives it from the per-food amounts), unless only a pre-#271
 * shared amount exists.
 */
export function mealRowAmount(meal: MealFood[], shared: FoodAmountDraft | null): { amount: number; unitAbbr: string } | null {
  const source = meal.length === 1 ? meal[0] : meal.some(tag => parseAmount(tag.amount) !== null) ? null : shared;
  const amount = source ? parseAmount(source.amount) : null;
  return source && amount !== null ? { amount, unitAbbr: source.unitAbbr } : null;
}

/** With one food the meal's Reaction switch is that food's reaction. */
export function withSingleFoodReaction(meal: MealFood[], hadReaction: boolean): MealFood[] {
  return meal.length === 1 && hadReaction && !meal[0].hadReaction ? [{ ...meal[0], hadReaction: true }] : meal;
}
