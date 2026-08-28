import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import type { ParsedMigration } from '@/src/types/family-migration';
import { parseMigration, readManifest, emptyMigrationTables } from '@/src/utils/migration-parse';
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

  it('parseMigration validates the manifest then reports the F1 wiring is pending (stub)', async () => {
    // Bad manifest fails before the CSV seam.
    const bad = await zipWith({ 'manifest.json': JSON.stringify(validManifest({ kind: 'x' })) });
    await expect(parseMigration(bad)).rejects.toThrow(/unexpected kind/i);

    // Valid manifest reaches the (not-yet-wired) CSV step.
    const good = await zipWith({ 'manifest.json': JSON.stringify(validManifest()) });
    await expect(parseMigration(good)).rejects.toThrow(/not yet wired to F1/i);
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
