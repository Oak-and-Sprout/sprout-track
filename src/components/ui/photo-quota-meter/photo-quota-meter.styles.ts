import { cva } from 'class-variance-authority';

export const quotaMeterStyles = {
  container: cva('flex items-center gap-2.5 text-xs', {
    variants: {
      variant: {
        light: 'text-gray-500',
        dark: 'text-white/90',
      },
    },
    defaultVariants: { variant: 'light' },
  }),
  bar: cva('h-1.5 w-36 shrink-0 overflow-hidden rounded-full', {
    variants: {
      variant: {
        light: 'bg-gray-200',
        dark: 'bg-white/25',
      },
    },
    defaultVariants: { variant: 'light' },
  }),
  fill: cva('block h-full rounded-full', {
    variants: {
      level: {
        normal: 'bg-gradient-to-r from-teal-600 to-emerald-500',
        warning: 'bg-amber-500',
      },
    },
    defaultVariants: { level: 'normal' },
  }),
};
