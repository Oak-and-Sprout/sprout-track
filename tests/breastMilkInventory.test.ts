import { describe, expect, it } from 'vitest';
import {
  autoPumpFeedNotes,
  calculateBreastMilkBalance,
  isAutoCreatedPumpFeed,
  planAutoFeedSync,
  shouldHaveAutoPumpFeed,
} from '@/src/utils/breastMilkInventory';
import { normalizeVolumeUnit } from '@/src/utils/unit-conversion';

describe('breast milk inventory', () => {
  it('does not count a pump-created FED feed as consumption from stored inventory', () => {
    const balance = calculateBreastMilkBalance({
      pumpLogs: [],
      adjustments: [],
      feedLogs: [
        {
          amount: 4,
          unitAbbr: 'OZ',
          bottleType: 'Breast Milk',
          breastMilkAmount: null,
          sourcePumpId: 'pump-1',
          notes: autoPumpFeedNotes(),
        },
      ],
      targetUnit: 'OZ',
    });

    expect(balance).toBe(0);
  });

  it('keeps manual breast-milk consumption in the balance calculation', () => {
    const balance = calculateBreastMilkBalance({
      pumpLogs: [{ totalAmount: 8, unitAbbr: 'OZ', pumpAction: 'STORED' }],
      adjustments: [],
      feedLogs: [
        {
          amount: 3,
          unitAbbr: 'OZ',
          bottleType: 'Breast Milk',
          breastMilkAmount: null,
          sourcePumpId: null,
          notes: 'Manual feed',
        },
      ],
      targetUnit: 'OZ',
    });

    expect(balance).toBe(5);
  });

  it('uses only the breast-milk portion of a mixed bottle and converts units', () => {
    const balance = calculateBreastMilkBalance({
      pumpLogs: [{ totalAmount: 300, unitAbbr: 'ML', pumpAction: 'STORED' }],
      adjustments: [],
      feedLogs: [
        {
          amount: 6,
          unitAbbr: 'ML',
          bottleType: 'Formula/Breast',
          breastMilkAmount: 2,
          sourcePumpId: null,
          notes: null,
        },
      ],
      targetUnit: 'ML',
    });

    expect(balance).toBe(298);
  });

  it('recognizes legacy automatic feeds by their existing note prefix', () => {
    expect(isAutoCreatedPumpFeed({ sourcePumpId: null, notes: 'Auto-created from pump session' })).toBe(true);
    expect(isAutoCreatedPumpFeed({ sourcePumpId: null, notes: 'Manual feed' })).toBe(false);
  });

  it('does not count legacy pump-created feeds as consumption', () => {
    const balance = calculateBreastMilkBalance({
      pumpLogs: [{ totalAmount: 5, unitAbbr: 'OZ', pumpAction: 'STORED' }],
      adjustments: [],
      feedLogs: [
        {
          amount: 2,
          unitAbbr: 'OZ',
          bottleType: 'Breast Milk',
          breastMilkAmount: null,
          sourcePumpId: null,
          notes: 'Auto-created from pump: immediately consumed',
        },
      ],
      targetUnit: 'OZ',
    });

    expect(balance).toBe(5);
  });
});

describe('normalizeVolumeUnit', () => {
  it('normalizes supported units to canonical uppercase', () => {
    expect(normalizeVolumeUnit('oz')).toBe('OZ');
    expect(normalizeVolumeUnit('OZ')).toBe('OZ');
    expect(normalizeVolumeUnit('ml')).toBe('ML');
    expect(normalizeVolumeUnit(' ML ')).toBe('ML');
  });

  it('treats missing/blank units as the OZ default', () => {
    expect(normalizeVolumeUnit(undefined)).toBe('OZ');
    expect(normalizeVolumeUnit(null)).toBe('OZ');
    expect(normalizeVolumeUnit('')).toBe('OZ');
    expect(normalizeVolumeUnit('   ')).toBe('OZ');
  });

  it('returns null for unsupported units so callers can reject them', () => {
    expect(normalizeVolumeUnit('cups')).toBeNull();
    expect(normalizeVolumeUnit('L')).toBeNull();
    expect(normalizeVolumeUnit('grams')).toBeNull();
  });
});

describe('shouldHaveAutoPumpFeed', () => {
  it('is true only for a FED pump with a positive amount and tracking on', () => {
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'FED', totalAmount: 4 })).toBe(true);
  });

  it('is false when tracking is disabled', () => {
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: false, pumpAction: 'FED', totalAmount: 4 })).toBe(false);
  });

  it('is false for non-FED actions', () => {
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'STORED', totalAmount: 4 })).toBe(false);
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'DISCARDED', totalAmount: 4 })).toBe(false);
  });

  it('is false for missing or non-positive amounts', () => {
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'FED', totalAmount: 0 })).toBe(false);
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'FED', totalAmount: null })).toBe(false);
    expect(shouldHaveAutoPumpFeed({ trackingEnabled: true, pumpAction: 'FED', totalAmount: undefined })).toBe(false);
  });
});

describe('planAutoFeedSync', () => {
  it('creates a new feed when one should exist and none is present', () => {
    expect(planAutoFeedSync({ shouldHaveAutoFeed: true })).toEqual({ action: 'upsert', updateId: null });
  });

  it('updates the linked feed in place when it exists', () => {
    expect(planAutoFeedSync({ shouldHaveAutoFeed: true, linkedAutoFeedId: 'feed-1' })).toEqual({
      action: 'upsert',
      updateId: 'feed-1',
    });
  });

  it('adopts a legacy feed when there is no linked feed', () => {
    expect(planAutoFeedSync({ shouldHaveAutoFeed: true, legacyAutoFeedId: 'legacy-1' })).toEqual({
      action: 'upsert',
      updateId: 'legacy-1',
    });
  });

  it('prefers the linked feed over a legacy feed', () => {
    expect(
      planAutoFeedSync({ shouldHaveAutoFeed: true, linkedAutoFeedId: 'feed-1', legacyAutoFeedId: 'legacy-1' })
    ).toEqual({ action: 'upsert', updateId: 'feed-1' });
  });

  it('deletes existing feeds when one should no longer exist', () => {
    expect(planAutoFeedSync({ shouldHaveAutoFeed: false, linkedAutoFeedId: 'feed-1' })).toEqual({
      action: 'delete',
      deleteIds: ['feed-1'],
    });
    expect(planAutoFeedSync({ shouldHaveAutoFeed: false, legacyAutoFeedId: 'legacy-1' })).toEqual({
      action: 'delete',
      deleteIds: ['legacy-1'],
    });
  });

  it('is a no-op when nothing should exist and nothing is present', () => {
    expect(planAutoFeedSync({ shouldHaveAutoFeed: false })).toEqual({ action: 'noop' });
  });
});
