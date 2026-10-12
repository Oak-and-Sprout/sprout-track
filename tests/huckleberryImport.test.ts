import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { executeExternalImport } from '@/src/lib/importers/execute';
import { getExternalImportRuntimeProvider } from '@/src/lib/importers/runtime-registry';
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
    ], 'baby-1');

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
    const first = buildHuckleberryImportRecords([careLog(row, row)], 'baby-1');
    const second = buildHuckleberryImportRecords([careLog(row, row)], 'baby-1');

    expect(first[0].source.recordId).toBe(second[0].source.recordId);
    expect(first[1].source.recordId).toBe(second[1].source.recordId);
    expect(first[0].source.recordId).not.toBe(first[1].source.recordId);
  });

  it('preserves existing IDs when a cumulative export adds newer rows', () => {
    const older = 'Pump,2026-01-02 11:00,,,120ml,,,Stored,Parent';
    const later = 'Pump,2026-01-02 14:00,,,95ml,,,Stored,Parent';
    const newer = 'Pump,2026-01-02 17:00,,,100ml,,,Stored,Parent';
    const original = buildHuckleberryImportRecords([careLog(later, older)], 'baby-1');
    const cumulative = buildHuckleberryImportRecords([
      careLog(newer, later, older),
    ], 'baby-1');

    expect(cumulative.map(record => record.source.recordId)).toEqual(
      expect.arrayContaining(original.map(record => record.source.recordId)),
    );
  });

  it('requires mapping all records to the synthetic activity-only child', () => {
    const [record] = buildHuckleberryImportRecords([
      careLog('Feed,2026-01-02 08:00,,,Breast Milk,Bottle,120ml,,Parent'),
    ], 'baby-1');

    expect(record).toMatchObject({
      sourceChildId: 'huckleberry-care-log',
    });
    expect(record.source).toMatchObject({
      providerId: 'huckleberry',
      childId: 'huckleberry-care-log',
    });
  });
});

describe('Huckleberry rows that cannot be mapped', () => {
  const valid = 'Feed,2026-01-02 08:00,,,Formula,Bottle,120ml,,Parent';
  const unmappable = [
    'Diaper,2026-01-02 09:00,,,,,Dry,,Parent',
    'Feed,2026-01-02 10:00,,,,Solids,,,Parent',
    'Feed,2026-01-02 11:00,,,00:05L,Breast,,,Parent',
    'Pump,2026-01-02 8:00 PM,,,90ml,,,,Parent',
  ];

  it('previews only mappable rows and reports the rest as a warning', () => {
    const file = careLog(valid, ...unmappable);

    expect(huckleberryPreviewer.previewFiles([file])).toMatchObject({
      totalRows: 1,
      ready: true,
    });
    expect(collectHuckleberryWarnings([file])).toContainEqual({
      code: 'unmappable-row',
      entityType: 'care-log',
      affectedRows: unmappable.length,
    });
  });

  it('skips unmappable rows at execute instead of rejecting the file', () => {
    const records = buildHuckleberryImportRecords(
      [careLog(valid, ...unmappable)],
      'baby-1',
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ targetType: 'feed', type: 'BOTTLE' });
  });

  it('is not ready when no row can be mapped', () => {
    expect(
      huckleberryPreviewer.previewFiles([careLog(...unmappable)]),
    ).toMatchObject({ totalRows: 0, ready: false });
  });
});

describe('Huckleberry imports into more than one baby', () => {
  const sharedRow = 'Feed,2026-01-02 08:00,,,Formula,Bottle,120ml,,Parent';
  const destinations = (targetBabyId: string) => ({
    sourceTimezone: 'UTC',
    childDestinations: {
      'huckleberry-care-log': { mode: 'existing' as const, targetBabyId },
    },
  });

  it('scopes record IDs to the target baby', () => {
    const [a] = buildHuckleberryImportRecords([careLog(sharedRow)], 'baby-a');
    const [b] = buildHuckleberryImportRecords([careLog(sharedRow)], 'baby-b');
    const [aAgain] = buildHuckleberryImportRecords([careLog(sharedRow)], 'baby-a');

    expect(a.source.recordId).not.toBe(b.source.recordId);
    expect(a.source.recordId).toBe(aAgain.source.recordId);
  });

  it('passes the destination baby from the execution configuration', () => {
    const provider = getExternalImportRuntimeProvider('huckleberry')!;
    const [record] = provider.buildRecords(
      [careLog(sharedRow)],
      undefined,
      destinations('baby-a'),
    );

    expect(record.source.recordId).toBe(
      buildHuckleberryImportRecords([careLog(sharedRow)], 'baby-a')[0].source.recordId,
    );
    expect(() => provider.buildRecords([careLog(sharedRow)], undefined, {
      sourceTimezone: 'UTC',
      childDestinations: {},
    })).toThrow();
  });

  it('creates an identical row for each twin instead of skipping it as a duplicate', async () => {
    // In-memory provenance table keyed like the real @@unique constraint.
    const provenance = new Map<string, { targetRecordId: string }>();
    const keyOf = (k: Record<string, string>) =>
      [k.familyId, k.providerId, k.sourceEntityType, k.sourceRecordId].join('|');
    let feedId = 0;
    const tx = {
      baby: {
        findMany: vi.fn(async ({ where }) => where.id.in.map((id: string) => ({ id }))),
      },
      externalImportRecord: {
        findUnique: vi.fn(async ({ where }) =>
          provenance.get(keyOf(where.familyId_providerId_sourceEntityType_sourceRecordId)) ?? null),
        create: vi.fn(async ({ data }) => {
          provenance.set(keyOf(data), { targetRecordId: data.targetRecordId });
          return data;
        }),
      },
      feedLog: {
        create: vi.fn(async (_args: { data: { babyId: string } }) => ({ id: `feed-${++feedId}` })),
      },
    };
    const provider = getExternalImportRuntimeProvider('huckleberry')!;
    const run = (targetBabyId: string) =>
      executeExternalImport(tx as unknown as Prisma.TransactionClient, {
        familyId: 'family-1',
        records: provider.buildRecords([careLog(sharedRow)], undefined, destinations(targetBabyId)),
        configuration: destinations(targetBabyId),
      });

    expect(await run('baby-a')).toMatchObject({ created: 1, duplicates: 0 });
    expect(await run('baby-b')).toMatchObject({ created: 1, duplicates: 0 });
    expect(await run('baby-a')).toMatchObject({ created: 0, duplicates: 1 });
    expect(tx.feedLog.create).toHaveBeenCalledTimes(2);
    expect(tx.feedLog.create.mock.calls.map(([args]) => args.data.babyId)).toEqual([
      'baby-a',
      'baby-b',
    ]);
  });
});
