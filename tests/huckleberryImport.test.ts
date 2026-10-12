import { describe, expect, it } from 'vitest';
import {
  buildHuckleberryImportRecords,
  collectHuckleberryWarnings,
  huckleberryDetector,
  huckleberryPreviewer,
  huckleberryImportProvider,
} from '@/src/lib/importers/huckleberry';

const header = [
  'Type',
  'Start',
  'End',
  'Duration',
  'Start Condition',
  'Start Location',
  'End Condition',
  'Notes',
  'Logged By',
].join(',');

function careLog(...rows: string[]) {
  return {
    name: 'care-log.csv',
    content: [header, ...rows].join('\n'),
  };
}

describe('Huckleberry care log detection and preview', () => {
  it('registers as a single-file CSV provider', () => {
    expect(huckleberryImportProvider).toEqual({
      id: 'huckleberry',
      name: 'Huckleberry',
      description: 'Import a Huckleberry care log CSV export',
      acceptedExtensions: ['.csv'],
      supportsMultipleFiles: false,
    });
  });

  it('detects a care log and counts only supported activities', () => {
    const file = careLog(
      'Feed,2026-01-02 08:00,,,Formula,Bottle,120ml,,Parent',
      'Sleep,2026-01-02 09:00,2026-01-02 10:00,01:00,,,,,Parent',
    );

    expect(huckleberryDetector.detectFiles([file])[0]).toMatchObject({
      status: 'detected',
      entityType: 'care-log',
    });
    expect(huckleberryPreviewer.previewFiles([file])).toMatchObject({
      providerId: 'huckleberry',
      totalRows: 1,
      ready: true,
    });
    expect(collectHuckleberryWarnings([file])).toContainEqual({
      code: 'unsupported-activity-type',
      entityType: 'care-log',
      affectedRows: 1,
    });
  });

  it('rejects unrelated CSV headers and multiple exports', () => {
    expect(
      huckleberryDetector.detectFiles([{ name: 'other.csv', content: 'a,b\n1,2' }])[0].status,
    ).toBe('unsupported');
    expect(
      huckleberryPreviewer.previewFiles([
        careLog('Pump,2026-01-02 08:00,,,90ml,,,,Parent'),
        careLog('Pump,2026-01-02 12:00,,,95ml,,,,Parent'),
      ]).ready,
    ).toBe(false);
  });
});

describe('Huckleberry record mapping', () => {
  it('maps bottle, breast, diaper, and pump rows while preserving source units', () => {
    const records = buildHuckleberryImportRecords([
      careLog(
        'Feed,2026-01-02 08:00,,,Formula,Bottle,4oz,Morning bottle,Parent',
        'Feed,2026-01-02 09:00,2026-01-02 09:18,00:18,00:10R,Breast,00:08L,Nursing,Parent',
        'Diaper,2026-01-02 10:00,,brown,Solid,,"Both, poo:large",Changed,Parent',
        'Pump,2026-01-02 11:00,,,120ml,,,Stored,Parent',
      ),
    ]);

    expect(records).toHaveLength(4);
    expect(records[0]).toMatchObject({
      targetType: 'feed',
      type: 'BOTTLE',
      amount: 4,
      unitAbbr: 'OZ',
      bottleType: 'Formula',
    });
    expect(records[1]).toMatchObject({
      targetType: 'feed',
      type: 'BREAST',
      feedDuration: 1080,
      side: undefined,
    });
    expect(records[2]).toMatchObject({
      targetType: 'diaper',
      type: 'BOTH',
      color: 'BROWN',
    });
    expect(records[3]).toMatchObject({
      targetType: 'pump',
      startTime: '2026-01-02T11:00:00',
      endTime: '2026-01-02T11:00:00',
      duration: 0,
      totalAmount: 120,
      unitAbbr: 'ML',
    });
  });

  it('creates stable, distinct IDs for exact duplicate rows', () => {
    const row = 'Pump,2026-01-02 11:00,,,120ml,,,Stored,Parent';
    const first = buildHuckleberryImportRecords([careLog(row, row)]);
    const second = buildHuckleberryImportRecords([careLog(row, row)]);

    expect(first[0].source.recordId).toBe(second[0].source.recordId);
    expect(first[1].source.recordId).toBe(second[1].source.recordId);
    expect(first[0].source.recordId).not.toBe(first[1].source.recordId);
  });

  it('preserves existing IDs when a cumulative export adds newer rows', () => {
    const older = 'Pump,2026-01-02 11:00,,,120ml,,,Stored,Parent';
    const later = 'Pump,2026-01-02 14:00,,,95ml,,,Stored,Parent';
    const newer = 'Pump,2026-01-02 17:00,,,100ml,,,Stored,Parent';
    const original = buildHuckleberryImportRecords([careLog(later, older)]);
    const cumulative = buildHuckleberryImportRecords([
      careLog(newer, later, older),
    ]);

    expect(cumulative.map(record => record.source.recordId)).toEqual(
      expect.arrayContaining(original.map(record => record.source.recordId)),
    );
  });

  it('requires mapping all records to the synthetic activity-only child', () => {
    const [record] = buildHuckleberryImportRecords([
      careLog('Feed,2026-01-02 08:00,,,Breast Milk,Bottle,120ml,,Parent'),
    ]);

    expect(record).toMatchObject({
      sourceChildId: 'huckleberry-care-log',
    });
    expect(record.source).toMatchObject({
      providerId: 'huckleberry',
      childId: 'huckleberry-care-log',
    });
  });
});
