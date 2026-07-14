import { convertVolume } from './unit-conversion';

export const AUTO_PUMP_FEED_PREFIX = 'Auto-created from pump';

export interface BreastMilkPumpInventoryRow {
  totalAmount: number | null;
  unitAbbr: string | null;
  pumpAction: string;
}

export interface BreastMilkAdjustmentInventoryRow {
  amount: number;
  unitAbbr: string | null;
}

export interface BreastMilkFeedInventoryRow {
  amount: number | null;
  unitAbbr: string | null;
  bottleType: string | null;
  breastMilkAmount: number | null;
  sourcePumpId?: string | null;
  notes?: string | null;
}

export function autoPumpFeedNotes(notes?: string | null): string {
  return notes ? `${AUTO_PUMP_FEED_PREFIX}: ${notes}` : `${AUTO_PUMP_FEED_PREFIX} session`;
}

export function isAutoCreatedPumpFeed(feed: Pick<BreastMilkFeedInventoryRow, 'sourcePumpId' | 'notes'>): boolean {
  return Boolean(
    feed.sourcePumpId ||
      (typeof feed.notes === 'string' && feed.notes.startsWith(AUTO_PUMP_FEED_PREFIX))
  );
}

export function calculateBreastMilkBalance({
  pumpLogs,
  adjustments,
  feedLogs,
  targetUnit,
}: {
  pumpLogs: BreastMilkPumpInventoryRow[];
  adjustments: BreastMilkAdjustmentInventoryRow[];
  feedLogs: BreastMilkFeedInventoryRow[];
  targetUnit: string;
}): number {
  const storedTotal = pumpLogs.reduce((total, log) => {
    if (log.pumpAction !== 'STORED' || log.totalAmount == null) return total;
    return total + convertVolume(log.totalAmount, log.unitAbbr || 'OZ', targetUnit);
  }, 0);

  const adjustmentTotal = adjustments.reduce(
    (total, adjustment) => total + convertVolume(adjustment.amount, adjustment.unitAbbr || 'OZ', targetUnit),
    0
  );

  const consumedTotal = feedLogs.reduce((total, log) => {
    if (isAutoCreatedPumpFeed(log)) return total;

    if (log.bottleType === 'Breast Milk' && log.amount != null) {
      return total + convertVolume(log.amount, log.unitAbbr || 'OZ', targetUnit);
    }

    if (log.bottleType === 'Formula\\Breast' && log.breastMilkAmount != null) {
      return total + convertVolume(log.breastMilkAmount, log.unitAbbr || 'OZ', targetUnit);
    }

    return total;
  }, 0);

  return Math.round((storedTotal + adjustmentTotal - consumedTotal) * 100) / 100;
}
