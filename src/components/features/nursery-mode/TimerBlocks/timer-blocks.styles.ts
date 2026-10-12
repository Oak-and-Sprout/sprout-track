import { cva } from 'class-variance-authority';

/**
 * Nursery Mode timer blocks. Layout comes from Tailwind utilities; the glass
 * card, low-light colors and viewport-capped type sizes live in
 * timer-blocks.css (`nursery-timer*` classes) alongside the rest of the
 * nursery stage styling, which is always dark regardless of the app theme.
 */
export const timerBlockVariants = cva(
  'nursery-timer flex min-w-0 flex-1 flex-col items-center text-center',
  {
    variants: {
      tone: {
        normal: '',
        sleeping: 'nursery-timer-sleeping',
        warning: 'nursery-timer-warning',
        empty: 'nursery-timer-empty',
      },
    },
    defaultVariants: { tone: 'normal' },
  }
);

export const timerBlocksStyles = {
  row: 'nursery-timers flex w-full flex-shrink-0 justify-center',
  head: 'nursery-timer-head flex max-w-full min-w-0 items-center justify-center',
  value: 'nursery-timer-value nursery-serif flex items-baseline justify-center',
  unit: 'nursery-timer-unit',
  text: 'nursery-timer-text',
  note: 'nursery-timer-note',
  badge: 'nursery-timer-badge',
} as const;
