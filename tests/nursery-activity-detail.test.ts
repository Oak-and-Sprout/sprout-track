import { describe, it, expect } from 'vitest';
import { formatFeedNote, formatPumpNote, formatTileTime, FeedNoteLabels, PumpNoteLabels } from '@/src/utils/nursery/activityDetail';

const feedLabels: FeedNoteLabels = {
  breast: 'Breast', bottle: 'Bottle', formula: 'Formula', pumpedBottle: 'Pumped Bottle', food: 'Food',
  left: 'Left', right: 'Right',
};

const pumpLabels: PumpNoteLabels = {
  left: 'Left', right: 'Right', both: 'Both', stored: 'Stored', fed: 'Fed', discarded: 'Discarded',
};

describe('formatFeedNote', () => {
  it('formats bottle with amount', () => {
    expect(formatFeedNote({ type: 'BOTTLE', amount: 4, unitAbbr: 'OZ' }, feedLabels)).toBe('Bottle: 4oz');
  });

  it('formats bottle without amount', () => {
    expect(formatFeedNote({ type: 'BOTTLE' }, feedLabels)).toBe('Bottle');
  });

  it('formats breast with both sides', () => {
    expect(formatFeedNote({
      type: 'BREAST',
      breastSides: [{ side: 'LEFT', seconds: 252 }, { side: 'RIGHT', seconds: 185 }],
    }, feedLabels)).toBe('Breast: Left (4:12) / Right (3:05)');
  });

  it('formats breast with only one side fed', () => {
    expect(formatFeedNote({
      type: 'BREAST',
      breastSides: [{ side: 'LEFT', seconds: 252 }, { side: 'RIGHT', seconds: 0 }],
    }, feedLabels)).toBe('Breast: Left (4:12)');
  });

  it('formats breast with no side data', () => {
    expect(formatFeedNote({ type: 'BREAST' }, feedLabels)).toBe('Breast');
  });

  it('formats food with description', () => {
    expect(formatFeedNote({ type: 'FOOD', food: 'Peas' }, feedLabels)).toBe('Food: Peas');
  });

  it('formats formula and pumped bottle like bottle', () => {
    expect(formatFeedNote({ type: 'FORMULA', amount: 3, unitAbbr: 'OZ' }, feedLabels)).toBe('Formula: 3oz');
    expect(formatFeedNote({ type: 'PUMPED_BOTTLE', amount: 2, unitAbbr: 'OZ' }, feedLabels)).toBe('Pumped Bottle: 2oz');
  });
});

describe('formatPumpNote', () => {
  it('formats both-side amounts with action', () => {
    expect(formatPumpNote({ leftAmount: 4, rightAmount: 3, unitAbbr: 'OZ', action: 'STORED' }, pumpLabels))
      .toBe('Left: 4oz / Right: 3oz — Stored');
  });

  it('formats single-side amount', () => {
    expect(formatPumpNote({ leftAmount: 4, unitAbbr: 'OZ', action: 'FED' }, pumpLabels))
      .toBe('Left: 4oz — Fed');
  });

  it('formats total amount with side when no per-side split exists', () => {
    expect(formatPumpNote({ side: 'both', totalAmount: 7, unitAbbr: 'OZ', action: 'DISCARDED' }, pumpLabels))
      .toBe('Both: 7oz — Discarded');
  });

  it('formats total amount without a known side', () => {
    expect(formatPumpNote({ totalAmount: 7, unitAbbr: 'OZ', action: 'STORED' }, pumpLabels))
      .toBe('7oz — Stored');
  });

  it('falls back to side + duration when no amount was entered', () => {
    expect(formatPumpNote({ side: 'left', durationSeconds: 252, action: 'STORED' }, pumpLabels))
      .toBe('Left — 4:12 — Stored');
  });

  it('falls back to duration in minutes when only persisted duration is known', () => {
    expect(formatPumpNote({ durationMinutes: 12, action: 'STORED' }, pumpLabels))
      .toBe('12 min — Stored');
  });

  it('omits action when not provided', () => {
    expect(formatPumpNote({ side: 'right', durationSeconds: 60 }, pumpLabels)).toBe('Right — 1:00');
  });
});

describe('formatTileTime', () => {
  // Intl may use a narrow no-break space before am/pm depending on ICU version.
  const normalize = (s: string) => s.replace(/\u202f/g, ' ');
  const labels = { today: 'Today', yesterday: 'Yesterday' };
  const now = new Date(2026, 6, 31, 21, 0);
  const evening = new Date(2026, 6, 31, 19, 5);
  const morning = new Date(2026, 6, 31, 7, 5);

  it('formats lowercase 12h time when timeFormat is 12h', () => {
    expect(normalize(formatTileTime(evening, '12h', labels, now))).toBe('Today, 7:05 pm');
    expect(normalize(formatTileTime(morning, '12h', labels, now))).toBe('Today, 7:05 am');
  });

  it('formats 24h time when timeFormat is 24h', () => {
    expect(formatTileTime(evening, '24h', labels, now)).toBe('Today, 19:05');
    expect(formatTileTime(morning, '24h', labels, now)).toBe('Today, 07:05');
  });

  it('prefixes Yesterday for the previous calendar day', () => {
    const lateYesterday = new Date(2026, 6, 30, 23, 30);
    expect(formatTileTime(lateYesterday, '24h', labels, now)).toBe('Yesterday, 23:30');
    expect(normalize(formatTileTime(lateYesterday, '12h', labels, now))).toBe('Yesterday, 11:30 pm');
  });

  it('crosses month boundaries when computing Yesterday', () => {
    const firstOfMonth = new Date(2026, 7, 1, 0, 10);
    expect(formatTileTime(new Date(2026, 6, 31, 23, 50), '24h', labels, firstOfMonth)).toBe('Yesterday, 23:50');
  });

  it('uses localized labels', () => {
    expect(formatTileTime(evening, '24h', { today: 'Hoy', yesterday: 'Ayer' }, now)).toBe('Hoy, 19:05');
  });

  it('omits the prefix for future-dated entries', () => {
    const tomorrow = new Date(2026, 7, 1, 9, 0);
    expect(formatTileTime(tomorrow, '24h', labels, now)).toBe('09:00');
  });
});
