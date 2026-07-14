import { formatMMSS } from '@/src/components/features/nursery-mode/activities/types';

/**
 * Pure note-formatting for the feed/pump "last activity" line shown on nursery
 * cards/tiles. Kept free of i18n/React so it's testable without mocking
 * localization — callers pass already-localized label strings.
 */

export interface FeedNoteLabels {
  breast: string;
  bottle: string;
  formula: string;
  pumpedBottle: string;
  food: string;
  left: string;
  right: string;
}

export interface BreastFeedSide {
  side: 'LEFT' | 'RIGHT';
  seconds: number;
}

export interface FeedNoteData {
  type: string;
  amount?: number | null;
  unitAbbr?: string | null;
  food?: string | null;
  breastSides?: BreastFeedSide[] | null;
}

const FEED_TYPE_LABEL_KEYS: Record<string, keyof FeedNoteLabels> = {
  BREAST: 'breast',
  BOTTLE: 'bottle',
  FORMULA: 'formula',
  PUMPED_BOTTLE: 'pumpedBottle',
  FOOD: 'food',
};

export function formatFeedNote(data: FeedNoteData, labels: FeedNoteLabels): string {
  const typeLabel = labels[FEED_TYPE_LABEL_KEYS[data.type]] ?? data.type;

  if (data.type === 'BREAST') {
    const sides = (data.breastSides || []).filter(s => s.seconds > 0);
    if (sides.length === 0) return typeLabel;
    const detail = sides
      .map(s => `${s.side === 'LEFT' ? labels.left : labels.right} (${formatMMSS(s.seconds)})`)
      .join(' / ');
    return `${typeLabel}: ${detail}`;
  }

  if (data.type === 'FOOD') {
    return data.food ? `${typeLabel}: ${data.food}` : typeLabel;
  }

  if (data.amount != null) {
    const unit = (data.unitAbbr || '').toLowerCase();
    return `${typeLabel}: ${data.amount}${unit}`;
  }

  return typeLabel;
}

export interface PumpNoteLabels {
  left: string;
  right: string;
  both: string;
  stored: string;
  fed: string;
  discarded: string;
}

const PUMP_SIDE_LABEL_KEYS: Record<string, keyof PumpNoteLabels> = {
  left: 'left',
  right: 'right',
  both: 'both',
};

const PUMP_ACTION_LABEL_KEYS: Record<string, keyof PumpNoteLabels> = {
  STORED: 'stored',
  FED: 'fed',
  DISCARDED: 'discarded',
};

export interface PumpNoteData {
  side?: 'left' | 'right' | 'both' | null;
  leftAmount?: number | null;
  rightAmount?: number | null;
  totalAmount?: number | null;
  unitAbbr?: string | null;
  durationSeconds?: number | null;
  durationMinutes?: number | null;
  action?: string | null;
}

export function formatPumpNote(data: PumpNoteData, labels: PumpNoteLabels): string {
  const unit = (data.unitAbbr || '').toLowerCase();
  const sideLabel = data.side ? labels[PUMP_SIDE_LABEL_KEYS[data.side]] : null;
  const actionLabel = data.action ? (labels[PUMP_ACTION_LABEL_KEYS[data.action]] ?? data.action) : null;

  let detail: string;
  if (data.leftAmount != null && data.rightAmount != null) {
    detail = `${labels.left}: ${data.leftAmount}${unit} / ${labels.right}: ${data.rightAmount}${unit}`;
  } else if (data.leftAmount != null) {
    detail = `${labels.left}: ${data.leftAmount}${unit}`;
  } else if (data.rightAmount != null) {
    detail = `${labels.right}: ${data.rightAmount}${unit}`;
  } else if (data.totalAmount != null) {
    const amountText = `${data.totalAmount}${unit}`;
    detail = sideLabel ? `${sideLabel}: ${amountText}` : amountText;
  } else {
    const durationText = data.durationSeconds != null
      ? formatMMSS(data.durationSeconds)
      : data.durationMinutes != null
        ? `${data.durationMinutes} min`
        : '';
    detail = [sideLabel, durationText].filter(Boolean).join(' — ');
  }

  return [detail, actionLabel].filter(Boolean).join(' — ');
}
