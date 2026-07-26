import { describe, it, expect } from 'vitest';
import { formatFeedNote, formatPumpNote, FeedNoteLabels, PumpNoteLabels } from '@/src/utils/nursery/activityDetail';

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
