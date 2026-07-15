/**
 * Icon set for Nursery Mode. Activity icons (bottle/pump/diaper/moon/food) use
 * the same lucide icons as the timeline (src/components/Timeline/utils.tsx
 * getActivityIcon) so activities look identical across the app — food uses
 * Apple, matching the timeline's food-log icon; image/star are the matching
 * lucide equivalents used only inside Nursery Mode chrome.
 */

import type { ReactElement } from 'react';
import { Moon, LampWallDown, Image, Star, Pause, Play, Square, ArrowLeftRight, ArrowLeft, ArrowRight, Apple, Icon as LucideLabIcon } from 'lucide-react';
import { diaper, bottleBaby } from '@lucide/lab';

export type IconName =
  | 'bottle' | 'pump' | 'diaper' | 'moon' | 'image' | 'star' | 'food'
  | 'switch' | 'pause' | 'resume' | 'stop' | 'resumeLeft' | 'resumeRight';

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
    case 'food':
      return <Apple {...shared} />;
    case 'switch':
      return <ArrowLeftRight {...shared} />;
    case 'pause':
      return <Pause {...shared} />;
    case 'resume':
      return <Play {...shared} />;
    case 'stop':
      return <Square {...shared} />;
    case 'resumeLeft':
      return <ArrowLeft {...shared} />;
    case 'resumeRight':
      return <ArrowRight {...shared} />;
  }
}
