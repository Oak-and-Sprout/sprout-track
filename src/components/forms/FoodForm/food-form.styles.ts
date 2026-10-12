import { cva } from 'class-variance-authority';

/**
 * Light-mode styles for the FoodForm (dark mode: `html.dark` rules in food-form.css).
 */

/** A selected food's tag: a small bordered box; the food being edited is highlighted. */
export const foodTagVariants = cva(
  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm food-selected-tag',
  {
    variants: {
      selected: {
        true: 'border-teal-500 bg-teal-100 text-teal-900 ring-1 ring-teal-500 food-selected-tag-active',
        false: 'border-teal-200 bg-teal-50 text-teal-800',
      },
    },
    defaultVariants: { selected: false },
  }
);

/** The tag's name + amount button that selects the food for editing. */
export const foodTagEditButton =
  'inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

/** The meal total shown next to the Foods label. */
export const foodMealTotal = 'font-normal text-gray-500 food-form-meal-total';
