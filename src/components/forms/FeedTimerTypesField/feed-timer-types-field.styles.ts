import { cn } from '@/src/lib/utils';

/**
 * Styles for the FeedTimerTypesField component (light mode)
 *
 * Dark mode overrides live in feed-timer-types-field.css using the
 * feed-timer-types-* class names applied alongside these styles.
 */

export const fieldDescription = () => {
  return cn('text-sm text-gray-500 mb-2');
};

export const optionList = () => {
  return cn('space-y-2');
};

export const optionRow = () => {
  return cn('flex items-center gap-2 cursor-pointer');
};

export const optionLabel = () => {
  return cn('text-sm text-slate-700');
};
