/**
 * The FDA "big 9" common food allergens (issue #203). Used to pre-suggest the
 * `commonAllergen` flag when a new food is added to the family catalog.
 * Rendering localizes these via t(), so they must never be reworded.
 */
export const COMMON_ALLERGENS = [
  'Milk',
  'Egg',
  'Peanut',
  'Tree Nuts',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
  'Sesame',
] as const;

export type CommonAllergen = (typeof COMMON_ALLERGENS)[number];

/**
 * Lowercase keywords that indicate a food likely belongs to one of the big-9
 * allergen groups. Matched as substrings of the normalized food name by
 * `isLikelyCommonAllergen()` in `src/utils/foodLogUtils.ts`.
 */
export const COMMON_ALLERGEN_KEYWORDS = [
  // Milk
  'milk',
  'dairy',
  'cheese',
  'yogurt',
  'butter',
  // Egg
  'egg',
  // Peanut
  'peanut',
  // Tree nuts
  'tree nut',
  'almond',
  'cashew',
  'walnut',
  'pecan',
  'pistachio',
  'hazelnut',
  'macadamia',
  // Soy
  'soy',
  'tofu',
  'edamame',
  // Wheat
  'wheat',
  // Fish
  'fish',
  'salmon',
  'tuna',
  'cod',
  // Shellfish (also matched by 'fish')
  'shrimp',
  'prawn',
  'crab',
  'lobster',
  'clam',
  'mussel',
  'oyster',
  'scallop',
  // Sesame
  'sesame',
  'tahini',
] as const;
