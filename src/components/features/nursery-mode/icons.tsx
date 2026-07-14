/**
 * Icon set for Nursery Mode. Activity icons (bottle/pump/diaper/moon) use the
 * same lucide icons as the timeline (src/components/Timeline/utils.tsx
 * getActivityIcon) so activities look identical across the app; image/star are
 * the matching lucide equivalents used only inside Nursery Mode chrome.
 */

import type { ReactElement } from 'react';
import { Moon, LampWallDown, Image, Star, Icon as LucideLabIcon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';

export type IconName = 'bottle' | 'pump' | 'diaper' | 'moon' | 'image' | 'star';

export function Icon({ n, s = 24 }: { n: IconName; s?: number }): ReactElement {
  const shared = { size: s, strokeWidth: 1.8, 'aria-hidden': true } as const;
  switch (n) {
    case 'bottle':
      return <LucideLabIcon iconNode={bottleBaby} {...shared} />;
    case 'pump':
      return <LampWallDown {...shared} />;
    case 'diaper':
      return <LucideLabIcon iconNode={diaper} {...shared} />;
    case 'moon':
      return <Moon {...shared} />;
    case 'image':
      return <Image {...shared} />;
    case 'star':
      return <Star {...shared} />;
  }
}
