import { describe, expect, it } from 'vitest';
import {
  autoPumpFeedNotes,
  calculateBreastMilkBalance,
  isAutoCreatedPumpFeed,
} from '@/src/utils/breastMilkInventory';

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
          bottleType: 'Formula\\Breast',
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
