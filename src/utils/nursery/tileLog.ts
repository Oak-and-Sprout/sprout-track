import { TileLog } from '@/src/components/features/nursery-mode/activities/types';
import { TimeFormatSetting } from '@/src/utils/dateFormat';
import { localizeSleepLocation } from '@/src/utils/sleepLocationUtils';
import { isValidEnjoyment, FOOD_ENJOYMENT_LABELS } from '@/src/utils/foodLogUtils';
import { formatFeedNote, formatPumpNote, formatTileTime, FeedNoteData, PumpNoteData } from './activityDetail';
import { formatFoodLogNote } from './foodActivity';

/**
 * The nursery poller stores each tile's latest entry as raw data and localizes
 * it here, during render. Formatting inside the poller instead would freeze the
 * strings at whatever `t` held when that entry arrived — non-English bundles
 * lazy-load, so early polls (and everything the 10s interval reused afterwards)
 * rendered English on an otherwise translated screen.
 */

export type Translate = (key: string) => string;

/** Latest entry per tile, kept unlocalized so a language change re-renders it. */
export type TileEntry =
  | { kind: 'feed'; at: string; feed: FeedNoteData }
  | { kind: 'pump'; at: string; pump: PumpNoteData }
  | { kind: 'diaper'; at: string; diaperType: string }
  | { kind: 'sleep'; at: string; location: string | null; durationMinutes: number | null }
  | { kind: 'food'; at: string; foodName: string | null; enjoyment: unknown }
  /** Optimistic entry from a tap in this session — already-localized note text. */
  | { kind: 'note'; at: string; note: string };

const DIAPER_TYPE_KEYS: Record<string, string> = {
  WET: 'Wet',
  DIRTY: 'Dirty',
  BOTH: 'Both',
  DRY: 'Dry',
};

/** The tile meta line's second row — "Bottle: 4oz", "Crib — 1 min", … */
export function formatTileEntryNote(entry: TileEntry, t: Translate): string {
  switch (entry.kind) {
    case 'feed':
      return formatFeedNote(entry.feed, {
        breast: t('Breast'), bottle: t('Bottle'), formula: t('Formula'), pumpedBottle: t('Pumped Bottle'), food: t('Food'),
        left: t('Left'), right: t('Right'),
      });
    case 'pump':
      return formatPumpNote(entry.pump, {
        left: t('Left'), right: t('Right'), both: t('Both'),
        stored: t('Stored'), fed: t('Fed'), discarded: t('Discarded'),
      });
    case 'diaper': {
      const key = DIAPER_TYPE_KEYS[entry.diaperType];
      return key ? t(key) : entry.diaperType;
    }
    case 'sleep': {
      const location = entry.location ? localizeSleepLocation(entry.location, t) : t('Sleep');
      const duration = entry.durationMinutes ? `${entry.durationMinutes} min` : '';
      return [location, duration].filter(Boolean).join(' — ');
    }
    case 'food': {
      const enjoymentLabel = isValidEnjoyment(entry.enjoyment) ? t(FOOD_ENJOYMENT_LABELS[entry.enjoyment]) : null;
      return formatFoodLogNote({ foodName: entry.foodName || t('Food'), enjoymentLabel });
    }
    case 'note':
      return entry.note;
  }
}

/** Localizes every tile's stored entry against the current language. */
export function formatTileLogs(
  entries: Record<string, TileEntry>,
  timeFormat: TimeFormatSetting,
  t: Translate,
  now: Date = new Date()
): Record<string, TileLog> {
  const dayLabels = { today: t('Today'), yesterday: t('Yesterday') };
  const logs: Record<string, TileLog> = {};
  for (const [tileId, entry] of Object.entries(entries)) {
    logs[tileId] = {
      last: formatTileTime(new Date(entry.at), timeFormat, dayLabels, now),
      note: formatTileEntryNote(entry, t),
    };
  }
  return logs;
}
