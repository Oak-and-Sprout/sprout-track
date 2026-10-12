// `food` activity type for the hooks API (issue #284). Webhook food logs are
// written exactly the way the app's own meal form + /api/food-log write them:
// catalog foods are found case-insensitively by name within the family (or
// created), and FoodLog.foodId/foods/hadReaction/reactionDescription come from
// buildFoodLogFoodFields. The pure pieces are unit tested in tests/hooksFood.test.ts.
import prisma from '../../db';
import {
  FOOD_ENJOYMENT_VALUES,
  expandFoodItems,
  foodNameKey,
  normalizeFoodName,
  type FoodEnjoymentValue,
  type FoodLogItem,
  type FoodLogLike,
} from '@/src/utils/foodLogUtils';
import { normalizeEnumValue } from './field-values';

/** One requested food: an existing catalog id, or a name to find-or-create. */
export interface FoodItemInput {
  foodId?: string;
  name?: string;
  hadReaction: boolean;
  reactionDescription: string | null;
}

type CatalogFood = { id: string; name: string; commonAllergen: boolean };

/** Body fields the food type accepts besides the shared type/time/caretakerName. */
export const FOOD_FIELDS = ['foods', 'foodName', 'foodId', 'amount', 'unitAbbr', 'enjoyment', 'hadReaction', 'reactionDescription', 'notes'] as const;

const FOOD_ITEM_FIELDS = ['foodId', 'name', 'hadReaction', 'reactionDescription'];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseItem(foodId: unknown, name: unknown, hadReaction: unknown, reactionDescription: unknown, where: string, nameField: string): { item?: FoodItemInput; error?: string } {
  if ((foodId === undefined) === (name === undefined)) return { error: `${where}: send exactly one of foodId or ${nameField}` };
  if (foodId !== undefined && (typeof foodId !== 'string' || !foodId.trim())) return { error: `${where}: foodId must be a non-empty string` };
  const normalizedName = typeof name === 'string' ? normalizeFoodName(name) : '';
  if (name !== undefined && !normalizedName) return { error: `${where}: ${nameField} must be a non-empty string` };
  if (hadReaction !== undefined && typeof hadReaction !== 'boolean') return { error: `${where}: hadReaction must be a boolean` };
  if (reactionDescription != null && typeof reactionDescription !== 'string') return { error: `${where}: reactionDescription must be a string` };
  const description = typeof reactionDescription === 'string' && reactionDescription.trim() ? reactionDescription.trim() : null;
  // The app's meal form only keeps a description on a food that reacted (buildMealItems).
  if (description && hadReaction !== true) return { error: `${where}: reactionDescription requires hadReaction: true` };
  return {
    item: { ...(typeof foodId === 'string' ? { foodId: foodId.trim() } : { name: normalizedName }), hadReaction: hadReaction === true, reactionDescription: description },
  };
}

/**
 * Parse the food(s) of a request: either `foods[]` (each a name string or
 * `{ foodId | name, hadReaction?, reactionDescription? }`) or the single-food
 * shorthand `foodName | foodId` with top-level hadReaction/reactionDescription.
 * Returns `{}` when no food field was sent.
 */
export function parseFoodItemInputs(body: Record<string, unknown>): { items?: FoodItemInput[]; error?: string } {
  const single = body.foodId !== undefined || body.foodName !== undefined;
  const reaction = body.hadReaction !== undefined || body.reactionDescription !== undefined;
  if (body.foods !== undefined) {
    if (single || reaction) return { error: 'Send either foods[] (with per-food hadReaction/reactionDescription) or foodName/foodId, not both' };
    if (!Array.isArray(body.foods) || body.foods.length === 0) return { error: 'foods must be a non-empty array' };
    const items: FoodItemInput[] = [];
    for (const [index, raw] of body.foods.entries()) {
      const entry = typeof raw === 'string' ? { name: raw } : raw;
      const where = `foods[${index}]`;
      if (!isObject(entry)) return { error: `${where} must be a food name or an object` };
      const unknown = Object.keys(entry).filter((key) => !FOOD_ITEM_FIELDS.includes(key));
      if (unknown.length) return { error: `Unsupported field(s) in ${where}: ${unknown.join(', ')}` };
      const parsed = parseItem(entry.foodId, entry.name, entry.hadReaction, entry.reactionDescription, where, 'name');
      if (parsed.error) return { error: parsed.error };
      items.push(parsed.item!);
    }
    return { items };
  }
  if (!single) return reaction ? { error: 'hadReaction/reactionDescription require foodName or foodId (or set them per foods[] entry)' } : {};
  const parsed = parseItem(body.foodId, body.foodName, body.hadReaction, body.reactionDescription, 'food', 'foodName');
  return parsed.error ? { error: parsed.error } : { items: [parsed.item!] };
}

/**
 * Resolve requested foods against the family's (non-deleted) catalog, the way
 * the meal form does: names match case-insensitively, unknown names are listed
 * in `newNames` for creation, and a food requested twice is merged into one
 * item (reacting if either request reacted). An id outside the catalog is an error.
 */
export function planFoodItems(
  inputs: FoodItemInput[],
  catalog: { id: string; name: string }[]
): { items?: FoodItemInput[]; newNames?: string[]; error?: string } {
  const byKey = new Map(catalog.map((food) => [foodNameKey(food.name), food.id]));
  const ids = new Set(catalog.map((food) => food.id));
  const merged = new Map<string, FoodItemInput>();
  const newNames: string[] = [];
  for (const input of inputs) {
    if (input.foodId && !ids.has(input.foodId)) return { error: `Food '${input.foodId}' not found in this family` };
    const foodId = input.foodId ?? byKey.get(foodNameKey(input.name!));
    const key = foodId ?? `new:${foodNameKey(input.name!)}`;
    const existing = merged.get(key);
    if (existing) {
      existing.hadReaction = existing.hadReaction || input.hadReaction;
      existing.reactionDescription = existing.reactionDescription ?? input.reactionDescription;
      continue;
    }
    if (!foodId) newNames.push(input.name!);
    merged.set(key, { ...(foodId ? { foodId } : { name: input.name }), hadReaction: input.hadReaction, reactionDescription: input.reactionDescription });
  }
  return { items: Array.from(merged.values()), newNames };
}

/** Find-or-create the requested foods in the family catalog (golden rule: familyId from the API key only). */
export async function resolveFoodItems(inputs: FoodItemInput[], familyId: string): Promise<{ items?: FoodLogItem[]; error?: string }> {
  const catalog = await prisma.food.findMany({ where: { familyId, deletedAt: null }, select: { id: true, name: true } });
  const plan = planFoodItems(inputs, catalog);
  if (plan.error) return { error: plan.error };
  const created = new Map<string, string>();
  for (const name of plan.newNames!) {
    // Same shape as POST /api/food, which the meal form calls for new names
    const food = await prisma.food.create({ data: { name, commonAllergen: false, notes: null, familyId } });
    created.set(foodNameKey(name), food.id);
  }
  return {
    items: plan.items!.map((item) => ({
      foodId: item.foodId ?? created.get(foodNameKey(item.name!))!,
      hadReaction: item.hadReaction,
      reactionDescription: item.reactionDescription,
    })),
  };
}

/** FoodLog.amount: a positive number, or null to clear; omitted stays `{}`. */
export function parseFoodAmount(value: unknown): { value?: number | null; error?: string } {
  if (value === undefined) return {};
  if (value === null) return { value: null };
  const num = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(num) && num > 0 ? { value: num } : { error: 'amount must be a positive number' };
}

/** FoodLog.enjoyment, matched case-insensitively; null clears, omitted stays `{}`. */
export function parseEnjoyment(value: unknown): { value?: FoodEnjoymentValue | null; error?: string } {
  if (value === undefined) return {};
  if (value === null || value === '') return { value: null };
  const normalized = typeof value === 'string' ? normalizeEnumValue(value, FOOD_ENJOYMENT_VALUES) : null;
  return normalized ? { value: normalized as FoodEnjoymentValue } : { error: `enjoyment must be one of: ${FOOD_ENJOYMENT_VALUES.join(', ')}` };
}

/**
 * Decide FoodLog.unitAbbr the way the meal form does: a unit only accompanies
 * an amount, and an amount always carries one. `unitAbbr` is the already
 * resolved unit (null when not sent); `existing` is the row being updated.
 * Result: `unitAbbr` to write, `useDefault` for the family's default solids
 * unit, or neither to keep the existing unit.
 */
export function planFoodUnit(
  amount: number | null | undefined,
  unitAbbr: string | null,
  existing?: { amount: number | null; unitAbbr: string | null }
): { unitAbbr?: string | null; useDefault?: boolean; error?: string } {
  const effectiveAmount = amount !== undefined ? amount : existing?.amount ?? null;
  if (effectiveAmount == null) return unitAbbr ? { error: 'unitAbbr requires an amount' } : { unitAbbr: null };
  if (unitAbbr) return { unitAbbr };
  return existing?.unitAbbr ? {} : { useDefault: true };
}

/** The family's default solids unit (Settings.defaultSolidsUnit), as the meal form preselects it. */
export async function getDefaultSolidsUnit(familyId: string): Promise<string> {
  const settings = await prisma.settings.findFirst({ where: { familyId }, select: { defaultSolidsUnit: true } });
  return settings?.defaultSolidsUnit || 'TBSP';
}

/** Catalog names for the foods referenced by `logs` (deleted foods included, as in /api/food-log). */
export async function loadFoodCatalog(familyId: string, logs: FoodLogLike[]): Promise<Map<string, CatalogFood>> {
  const ids = Array.from(new Set(logs.flatMap((log) => expandFoodItems(log).map((item) => item.foodId))));
  if (!ids.length) return new Map();
  const foods = await prisma.food.findMany({ where: { id: { in: ids }, familyId }, select: { id: true, name: true, commonAllergen: true } });
  return new Map(foods.map((food) => [food.id, food]));
}

/** `details` of a food activity in hooks responses. */
export function formatFoodDetails(log: FoodLogLike & { notes?: string | null }, catalog: Map<string, CatalogFood>) {
  return {
    foods: expandFoodItems(log).map((item) => ({
      foodId: item.foodId,
      name: catalog.get(item.foodId)?.name ?? null,
      commonAllergen: catalog.get(item.foodId)?.commonAllergen === true,
      hadReaction: item.hadReaction === true,
      reactionDescription: item.reactionDescription ?? null,
    })),
    amount: log.amount ?? null,
    unitAbbr: log.unitAbbr ?? null,
    enjoyment: log.enjoyment ?? null,
    hadReaction: log.hadReaction === true,
    reactionDescription: log.reactionDescription ?? null,
    notes: log.notes ?? null,
  };
}
