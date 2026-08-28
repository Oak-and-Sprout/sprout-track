import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { ParsedMigration } from '@/src/types/family-migration';
import {
  parseMigration,
  readManifest,
  emptyMigrationTables,
  MIGRATION_TABLE_FILES,
} from '@/src/utils/migration-parse';
import { serializeTable, MIGRATION_TABLE_COLUMNS } from '@/src/utils/migration-csv';
import { planMigration } from '@/src/utils/migration-plan';

function validManifest(overrides: Record<string, any> = {}) {
  return {
    schemaVersion: 1, app: 'sprout-track', kind: 'family-migration',
    exportedAt: '2024-01-01T00:00:00.000Z', sourceProvider: 'sqlite',
    family: { slug: 's', name: 'n' }, features: { photos: false }, counts: {}, files: [],
    ...overrides,
  };
}

async function zipWith(entries: Record<string, string | null>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    if (content !== null) zip.file(name, content);
  }
  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('readManifest / parseMigration — manifest validation reject paths', () => {
  it('rejects an archive with no manifest.json', async () => {
    const buf = await zipWith({ 'tables/baby.csv': 'id\n' });
    await expect(readManifest(buf)).rejects.toThrow(/missing manifest\.json/i);
  });

  it('rejects a manifest that is not valid JSON', async () => {
    const buf = await zipWith({ 'manifest.json': '{not json' });
    await expect(readManifest(buf)).rejects.toThrow(/not valid JSON/i);
  });

  it('rejects a wrong kind', async () => {
    const buf = await zipWith({ 'manifest.json': JSON.stringify(validManifest({ kind: 'something-else' })) });
    await expect(readManifest(buf)).rejects.toThrow(/unexpected kind/i);
  });

  it('rejects a newer/unknown schemaVersion', async () => {
    const buf = await zipWith({ 'manifest.json': JSON.stringify(validManifest({ schemaVersion: 999 })) });
    await expect(readManifest(buf)).rejects.toThrow(/Unsupported migration schemaVersion/i);
  });

  it('accepts a valid manifest', async () => {
    const buf = await zipWith({ 'manifest.json': JSON.stringify(validManifest()) });
    const manifest = await readManifest(buf);
    expect(manifest.kind).toBe('family-migration');
    expect(manifest.schemaVersion).toBe(1);
  });

  it('parseMigration validates the manifest before touching CSVs', async () => {
    const bad = await zipWith({ 'manifest.json': JSON.stringify(validManifest({ kind: 'x' })) });
    await expect(parseMigration(bad)).rejects.toThrow(/unexpected kind/i);
  });

  it('parseMigration on a manifest-only archive yields empty tables and no media', async () => {
    const buf = await zipWith({ 'manifest.json': JSON.stringify(validManifest()) });
    const parsed = await parseMigration(buf);
    expect(parsed.manifest.kind).toBe('family-migration');
    expect(parsed.tables.caretakers).toEqual([]);
    expect(parsed.tables.feedLogs).toEqual([]);
    expect(parsed.photoBytes.size).toBe(0);
    expect(parsed.vaccineDocBytes.size).toBe(0);
  });
});

// --- End-to-end: real CSV + media → populated ParsedMigration (F1→F2 seam) ---

describe('parseMigration — CSV + media materialization (F1 seam)', () => {
  function csvFor(key: keyof typeof MIGRATION_TABLE_FILES, rows: Record<string, unknown>[]): [string, string] {
    return [MIGRATION_TABLE_FILES[key], serializeTable(rows, MIGRATION_TABLE_COLUMNS[key])];
  }

  it('parses typed rows (Date/boolean/null) and keys decrypted media by source id', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(validManifest({ features: { photos: true } })));

    const [ctFile, ctCsv] = csvFor('caretakers', [
      { id: 'c1', loginId: '01', name: 'Cara', type: null, role: 'ADMIN', inactive: false,
        securityPin: '1234', language: null, badgeColor: null, lastSeenVersion: null,
        createdAt: new Date('2024-01-02T03:04:05.000Z'), updatedAt: new Date('2024-01-02T03:04:05.000Z'),
        deletedAt: null, familyId: 'src-fam', accountId: null },
    ]);
    zip.file(ctFile, ctCsv);

    const [babyFile, babyCsv] = csvFor('babies', [
      { id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01T00:00:00.000Z'),
        gender: null, inactive: false, feedWarningTime: null, diaperWarningTime: null,
        feedTimerFrom: null, feedTimerTypes: null, createdAt: new Date('2024-01-02T03:04:05.000Z'),
        updatedAt: new Date('2024-01-02T03:04:05.000Z'), deletedAt: null, familyId: 'src-fam' },
    ]);
    zip.file(babyFile, babyCsv);

    const [feedFile, feedCsv] = csvFor('feedLogs', [
      { id: 'f1', time: new Date('2024-03-01T10:00:00.000Z'), startTime: null, endTime: null,
        feedDuration: null, pauseDuration: null, type: 'BOTTLE', amount: 4.5, unitAbbr: 'OZ',
        side: null, food: null, notes: '', hadReaction: false, reactionDescription: null,
        reactionCause: null, bottleType: null, breastMilkAmount: null, sessionId: null,
        sourcePumpId: null, createdAt: new Date('2024-03-01T10:00:00.000Z'),
        updatedAt: new Date('2024-03-01T10:00:00.000Z'), deletedAt: null, familyId: 'src-fam',
        babyId: 'b1', caretakerId: 'c1' },
    ]);
    zip.file(feedFile, feedCsv);

    const [photoFile, photoCsv] = csvFor('photos', [
      { id: 'ph1', originalName: 'p.jpg', storedName: 'SOURCE.enc', thumbStoredName: 'SOURCE.thumb.enc',
        mimeType: 'image/jpeg', fileSize: 5, thumbSize: 3, takenAt: new Date('2024-02-01T00:00:00.000Z'),
        caption: null, createdAt: new Date('2024-02-01T00:00:00.000Z'),
        updatedAt: new Date('2024-02-01T00:00:00.000Z'), deletedAt: null, babyId: 'b1',
        caretakerId: 'c1', milestoneId: null, familyId: 'src-fam' },
    ]);
    zip.file(photoFile, photoCsv);

    const displayBytes = new Uint8Array([1, 2, 3, 4, 5]);
    const thumbBytes = new Uint8Array([9, 8, 7]);
    zip.file('photos/ph1', displayBytes);
    zip.file('photos/ph1.thumb', thumbBytes);

    const [vlFile, vlCsv] = csvFor('vaccineLogs', [
      { id: 'vl1', time: new Date('2024-04-01T00:00:00.000Z'), vaccineName: 'DTaP', doseNumber: 1,
        notes: null, createdAt: new Date('2024-04-01T00:00:00.000Z'),
        updatedAt: new Date('2024-04-01T00:00:00.000Z'), deletedAt: null, familyId: 'src-fam',
        babyId: 'b1', caretakerId: 'c1' },
    ]);
    zip.file(vlFile, vlCsv);

    const [vdFile, vdCsv] = csvFor('vaccineDocuments', [
      { id: 'vd1', originalName: 'card.pdf', storedName: 'SRC.enc', mimeType: 'application/pdf',
        fileSize: 2, createdAt: new Date('2024-04-01T00:00:00.000Z'),
        updatedAt: new Date('2024-04-01T00:00:00.000Z'), vaccineLogId: 'vl1' },
    ]);
    zip.file(vdFile, vdCsv);
    const docBytes = new Uint8Array([42, 42]);
    zip.file('vaccine-docs/vd1', docBytes);

    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const parsed = await parseMigration(buf);

    // Typed coercion reversed.
    expect(parsed.tables.caretakers).toHaveLength(1);
    const ct = parsed.tables.caretakers[0] as any;
    expect(ct.id).toBe('c1');
    expect(ct.inactive).toBe(false);
    expect(ct.type).toBeNull();
    expect(ct.createdAt).toBeInstanceOf(Date);

    const feed = parsed.tables.feedLogs[0] as any;
    expect(feed.amount).toBe(4.5);
    expect(feed.time).toBeInstanceOf(Date);
    expect(feed.notes).toBeNull(); // empty cell → null

    // Media keyed by source id, display + thumb bytes preserved.
    expect(parsed.photoBytes.get('ph1')?.display).toEqual(displayBytes);
    expect(parsed.photoBytes.get('ph1')?.thumb).toEqual(thumbBytes);
    expect(parsed.vaccineDocBytes.get('vd1')).toEqual(docBytes);

    // Round-trips into a plan without error (F2 consumes the parsed shape).
    const plan = planMigration(parsed, { mode: 'new-family', newFamily: { name: 'N', slug: 's' }, dedup: false });
    expect(plan.batches.find((b) => b.table === 'Caretaker')?.rows).toHaveLength(1);
  });

  it('omits media bytes when a photo has no exported file (decrypt-skipped at source)', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(validManifest({ features: { photos: true } })));
    const [photoFile, photoCsv] = csvFor('photos', [
      { id: 'ph-missing', originalName: 'p.jpg', storedName: 'S.enc', thumbStoredName: 'S.t.enc',
        mimeType: 'image/jpeg', fileSize: 5, thumbSize: 3, takenAt: new Date('2024-02-01T00:00:00.000Z'),
        caption: null, createdAt: new Date('2024-02-01T00:00:00.000Z'),
        updatedAt: new Date('2024-02-01T00:00:00.000Z'), deletedAt: null, babyId: null,
        caretakerId: null, milestoneId: null, familyId: 'src-fam' },
    ]);
    zip.file(photoFile, photoCsv);
    // no photos/ph-missing entry
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const parsed = await parseMigration(buf);
    expect(parsed.tables.photos).toHaveLength(1);
    expect(parsed.photoBytes.has('ph-missing')).toBe(false);
  });
});

// --- Drop counting (produced by planMigration on a parsed fixture) ----------

function makeParsed(overrides: Partial<ParsedMigration['tables']>): ParsedMigration {
  return {
    manifest: validManifest() as any,
    tables: { ...emptyMigrationTables(), ...overrides } as ParsedMigration['tables'],
    photoBytes: new Map(),
    vaccineDocBytes: new Map(),
  };
}

describe('planMigration drop counts', () => {
  const base = () => makeParsed({
    caretakers: [{ id: 'c-src', loginId: '01', name: 'Cara' }] as any,
    babies: [{ id: 'b-src', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
    calendarEvents: [{ id: 'e1', title: 'Checkup', startTime: new Date('2024-01-01'), type: 'APPOINTMENT' }] as any,
  });

  it('drops PhotoFavorites owned by an account (no caretaker owner in this family)', () => {
    const parsed = base();
    (parsed.tables as any).photos = [{ id: 'ph1', babyId: 'b-src', caretakerId: 'c-src', originalName: 'p.jpg', storedName: 'p.enc', thumbStoredName: 't.enc', mimeType: 'image/jpeg', fileSize: 1, thumbSize: 1, takenAt: new Date('2024-01-01') }];
    (parsed.tables as any).photoFavorites = [
      { id: 'fav1', photoId: 'ph1', caretakerId: 'c-src', accountId: null },
      { id: 'fav2', photoId: 'ph1', caretakerId: null, accountId: 'acct-9' },
    ];

    const plan = planMigration(parsed, { mode: 'new-family', newFamily: { name: 'N', slug: 's' }, dedup: false });
    expect(plan.report.dropped.photoFavoritesWithAccountOwner).toBe(1);
    const favRows = plan.batches.find((b) => b.table === 'PhotoFavorite')?.rows ?? [];
    expect(favRows).toHaveLength(1);
  });

  it('drops junction rows whose other side is missing from the import', () => {
    const parsed = base();
    (parsed.tables as any).babyEvents = [
      { babyId: 'b-src', eventId: 'e1' },        // both sides present
      { babyId: 'b-src', eventId: 'missing-evt' }, // event not in the archive
    ];

    const plan = planMigration(parsed, { mode: 'new-family', newFamily: { name: 'N', slug: 's' }, dedup: false });
    expect(plan.report.dropped.junctionsWithMissingSide).toBe(1);
    const beRows = plan.batches.find((b) => b.table === 'BabyEvent')?.rows ?? [];
    expect(beRows).toHaveLength(1);
    expect((beRows[0] as any).eventId).toBe(plan.idMap.get('CalendarEvent', 'e1'));
  });
});
