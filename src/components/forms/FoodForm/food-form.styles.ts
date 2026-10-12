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

/** The tag's name + amount button that loads the food into the entry box for editing. */
export const foodTagEditButton =
  'inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

/** The meal total shown next to the Foods label. */
export const foodMealTotal = 'font-normal text-gray-500 food-form-meal-total';

/** The bordered box where one food is composed or a tag is edited; outlined in teal while editing. */
export const foodEntryBox = cva('space-y-3 rounded-lg border p-3 food-entry-box', {
  variants: {
    editing: {
      true: 'border-teal-400 bg-teal-50/40 food-entry-box-editing',
      false: 'border-gray-200 bg-gray-50/60',
    },
  },
  defaultVariants: { editing: false },
});

/** Round +/- buttons of the amount stepper. */
export const foodStepperButton =
  'bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5';
