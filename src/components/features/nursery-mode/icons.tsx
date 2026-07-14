/**
 * Stroke icon set for Nursery Mode. Ported exactly from the prototype
 * (documentation/temp-development-docs/sprout-track-nursery/nursery.jsx:9-16).
 */

import type { ReactElement } from 'react';

export type IconName = 'bottle' | 'pump' | 'diaper' | 'moon' | 'image' | 'star';

const ICONS: Record<IconName, ReactElement> = {
  bottle: <path d="M10 2.5h4V6l2 2.5V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V8.5L10 6z" />,
  pump: (
    <>
      <circle cx="12" cy="14" r="5" />
      <path d="M12 9V4M9 4h6" />
    </>
  ),
  diaper: <path d="M4 7h16v4a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" />,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 7 7 0 0 0 20 14.5z" />,
  image: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="M4 17.5l4.5-4.5 4 4 3-3 5 5" />
    </>
  ),
  star: <path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2-5.6-3-5.6 3 1.2-6.2L3 9.5l6.3-.8z" />,
};

export function Icon({ n, s = 24 }: { n: IconName; s?: number }): ReactElement {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[n]}
    </svg>
  );
}
