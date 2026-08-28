import { describe, it, expect } from 'vitest';
import {
  humanizeKey,
  labelForKey,
  previewCountRows,
  totalPreviewCount,
  entityRows,
  logRows,
  logTotals,
  mediaRows,
  droppedRows,
  hasIssues,
} from '@/src/utils/migration-display';
import type { MigrationReport } from '@/src/types/family-migration';

/**
 * Unit tests for the pure display helpers that shape a migration preview/report
 * into render-ready rows for the shared MigrationImport component.
 */

function makeReport(overrides: Partial<MigrationReport> = {}): MigrationReport {
  const zeroLog = { inserted: 0, skippedDuplicate: 0 };
  const zeroMedia = { migrated: 0, skippedOverQuota: 0, skippedDecryptError: 0 };
  const zeroEntity = { matched: 0, created: 0 };
  return {
    mode: 'append',
    dedup: true,
    entities: {
      babies: { ...zeroEntity },
      caretakers: { ...zeroEntity },
      contacts: { ...zeroEntity },
      medicines: { ...zeroEntity },
      foods: { ...zeroEntity },
    },
    logs: {
      feedLogs: { ...zeroLog },
      sleepLogs: { ...zeroLog },
      diaperLogs: { ...zeroLog },
      moodLogs: { ...zeroLog },
      notes: { ...zeroLog },
      milestones: { ...zeroLog },
      pumpLogs: { ...zeroLog },
      breastMilkAdjustments: { ...zeroLog },
      playLogs: { ...zeroLog },
      bathLogs: { ...zeroLog },
      measurements: { ...zeroLog },
      medicineLogs: { ...zeroLog },
      foodLogs: { ...zeroLog },
      vaccineLogs: { ...zeroLog },
    },
    media: { photos: { ...zeroMedia }, vaccineDocs: { ...zeroMedia } },
    dropped: { photoFavoritesWithAccountOwner: 0, junctionsWithMissingSide: 0 },
    warnings: [],
    ...overrides,
  };
}

describe('humanizeKey / labelForKey', () => {
  it('humanizes camelCase unknown keys', () => {
    expect(humanizeKey('breastMilkAdjustments')).toBe('Breast Milk Adjustments');
    expect(humanizeKey('some_snake-case')).toBe('Some snake case');
  });

  it('prefers the known label map', () => {
    expect(labelForKey('feedLogs')).toBe('Feeds');
    expect(labelForKey('vaccineDocuments')).toBe('Vaccine Documents');
  });

  it('falls back to humanized label for unknown keys', () => {
    expect(labelForKey('weirdNewTable')).toBe('Weird New Table');
  });
});

describe('previewCountRows / totalPreviewCount', () => {
  it('drops zero, negative and non-numeric counts and sorts by count desc then label', () => {
    const rows = previewCountRows({
      feedLogs: 10,
      sleepLogs: 10,
      diaperLogs: 0,
      notes: -3,
      // @ts-expect-error simulate malformed input
      moodLogs: 'x',
      babies: 2,
    });
    expect(rows.map((r) => r.key)).toEqual(['feedLogs', 'sleepLogs', 'babies']);
    // equal counts (feeds/sleep = 10) break tie alphabetically by label
    expect(rows[0].label).toBe('Feeds');
    expect(rows[1].label).toBe('Sleep');
  });

  it('totals only positive numeric counts', () => {
    // @ts-expect-error malformed value ignored
    expect(totalPreviewCount({ a: 5, b: 0, c: -1, d: 'x', e: 3 })).toBe(8);
  });

  it('handles empty/undefined input safely', () => {
    expect(previewCountRows({})).toEqual([]);
    expect(totalPreviewCount(undefined as any)).toBe(0);
  });
});

describe('entityRows', () => {
  it('returns fixed entity order with matched/created', () => {
    const report = makeReport({
      entities: {
        babies: { matched: 1, created: 2 },
        caretakers: { matched: 0, created: 3 },
        contacts: { matched: 0, created: 0 },
        medicines: { matched: 4, created: 0 },
        foods: { matched: 0, created: 0 },
      },
    });
    const rows = entityRows(report);
    expect(rows.map((r) => r.key)).toEqual(['babies', 'caretakers', 'contacts', 'medicines', 'foods']);
    expect(rows[0]).toMatchObject({ label: 'Babies', matched: 1, created: 2 });
  });
});

describe('logRows / logTotals', () => {
  it('omits log tables with no activity and sorts by label', () => {
    const report = makeReport();
    report.logs.feedLogs = { inserted: 5, skippedDuplicate: 2 };
    report.logs.bathLogs = { inserted: 1, skippedDuplicate: 0 };
    const rows = logRows(report);
    expect(rows.map((r) => r.key)).toEqual(['bathLogs', 'feedLogs']); // Baths < Feeds
    expect(rows.find((r) => r.key === 'feedLogs')).toMatchObject({ inserted: 5, skippedDuplicate: 2 });
  });

  it('totals inserted and skipped across all logs', () => {
    const report = makeReport();
    report.logs.feedLogs = { inserted: 5, skippedDuplicate: 2 };
    report.logs.sleepLogs = { inserted: 3, skippedDuplicate: 1 };
    expect(logTotals(report)).toEqual({ inserted: 8, skippedDuplicate: 3 });
  });
});

describe('mediaRows', () => {
  it('includes only media kinds with activity', () => {
    const report = makeReport();
    report.media.photos = { migrated: 4, skippedOverQuota: 1, skippedDecryptError: 0 };
    const rows = mediaRows(report);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'photos', label: 'Photos', migrated: 4, skippedOverQuota: 1 });
  });
});

describe('droppedRows / hasIssues', () => {
  it('surfaces non-zero dropped rows with friendly labels', () => {
    const report = makeReport({ dropped: { photoFavoritesWithAccountOwner: 2, junctionsWithMissingSide: 0 } });
    const rows = droppedRows(report);
    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe('Photo favorites tied to an account owner');
  });

  it('hasIssues is true with warnings or dropped rows, false otherwise', () => {
    expect(hasIssues(makeReport())).toBe(false);
    expect(hasIssues(makeReport({ warnings: ['heads up'] }))).toBe(true);
    expect(hasIssues(makeReport({ dropped: { photoFavoritesWithAccountOwner: 1, junctionsWithMissingSide: 0 } }))).toBe(true);
  });
});
