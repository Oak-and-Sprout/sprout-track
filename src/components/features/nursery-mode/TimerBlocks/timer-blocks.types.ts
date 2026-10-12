import type { LatestStatusData } from '@/src/components/Timeline/types';
import type { FeedTimerBaby } from '@/src/utils/nursery/timerBlocks';
import type { IconName } from '../icons';

export type TimerTone = 'normal' | 'sleeping' | 'warning' | 'empty';

export interface TimerBlocksProps {
  /** Latest feed/sleep status from computeLatestStatus; null while the first poll is in flight. */
  readonly status: LatestStatusData | null;
  /** The selected baby's feed timer settings (feedTimerFrom, feedWarningTime). */
  readonly baby: FeedTimerBaby;
  /** A breastfeed session is running (shows "Feeding" instead of a duration). */
  readonly feeding: boolean;
  readonly showWake: boolean;
  readonly showFeed: boolean;
  readonly iconColor: string;
  readonly iconShape: 'circle' | 'square';
}

export interface TimerBlockProps {
  readonly icon: IconName;
  readonly label: string;
  readonly tone: TimerTone;
  /** Elapsed minutes; null renders `text` (or a dash) instead of a duration. */
  readonly minutes: number | null;
  /** Shown in place of a duration (e.g. "Feeding"). */
  readonly text?: string;
  /** Small secondary line (e.g. "No recent sleep"). */
  readonly note?: string;
  /** Visible pill for the warning state (e.g. "Overdue"). */
  readonly badge?: string;
  /** Full sentence for assistive tech; the visual parts are aria-hidden. */
  readonly ariaLabel: string;
  readonly iconColor: string;
  readonly iconShape: 'circle' | 'square';
}
