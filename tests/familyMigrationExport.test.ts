/**
 * F4 — Export builder (`buildFamilyMigration`) structure tests.
 *
 * Asserts the produced zip's STRUCTURE (manifest keys, expected CSV presence,
 * row counts, media presence) against a small in-memory fixture family with the
 * Prisma reads mocked. Media is asserted via the F3 delegates
 * (`exportPhoto`/`exportVaccineDoc`), which are mocked. The whole zip is never
 * snapshotted (spec 06).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';

const FAMILY_ID = 'fam-1';

// ---------------------------------------------------------------------------
// Fixture family (source rows keyed by Prisma model accessor)
// ---------------------------------------------------------------------------

const fixture = {
  family: { id: FAMILY_ID, slug: 'smith-family', name: 'Smith Family' },
  caretaker: [
    { id: 'ct-1', loginId: '01', name: 'Alice', type: 'PARENT', role: 'ADMIN', inactive: false,
      securityPin: '123456', language: 'en', badgeColor: '#fff', lastSeenVersion: null,
      createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null, familyId: FAMILY_ID, accountId: null },
  ],
  baby: [
    { id: 'baby-1', firstName: 'Bob', lastName: 'Smith', birthDate: new Date('2025-06-01T00:00:00Z'),
      gender: 'MALE', inactive: false, feedWarningTime: '03:00', diaperWarningTime: '02:00',
      feedTimerFrom: 'startTime', feedTimerTypes: null, createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'), deletedAt: null, familyId: FAMILY_ID },
  ],
  feedLog: [
    { id: 'feed-1', time: new Date('2026-02-01T10:00:00Z'), startTime: null, endTime: null,
      feedDuration: null, pauseDuration: null, type: 'BOTTLE', amount: 120, unitAbbr: 'ml',
      side: null, food: null, notes: null, hadReaction: false, reactionDescription: null,
      reactionCause: null, bottleType: null, breastMilkAmount: null, sessionId: null,
      sourcePumpId: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      familyId: FAMILY_ID, babyId: 'baby-1', caretakerId: 'ct-1' },
    { id: 'feed-2', time: new Date('2026-02-01T14:00:00Z'), startTime: null, endTime: null,
      feedDuration: null, pauseDuration: null, type: 'BOTTLE', amount: 4, unitAbbr: 'oz',
      side: null, food: null, notes: null, hadReaction: false, reactionDescription: null,
      reactionCause: null, bottleType: null, breastMilkAmount: null, sessionId: null,
      sourcePumpId: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      familyId: FAMILY_ID, babyId: 'baby-1', caretakerId: 'ct-1' },
  ],
  vaccineLog: [
    { id: 'vl-1', time: new Date('2026-03-01T09:00:00Z'), vaccineName: 'MMR', doseNumber: 1,
      notes: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      familyId: FAMILY_ID, babyId: 'baby-1', caretakerId: 'ct-1' },
  ],
  photo: [
    { id: 'photo-1', originalName: 'a.jpg', storedName: 'stored-a.enc', thumbStoredName: 'stored-a.thumb.enc',
      mimeType: 'image/jpeg', fileSize: 1000, thumbSize: 100, takenAt: new Date('2026-02-10T00:00:00Z'),
      caption: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      babyId: 'baby-1', caretakerId: 'ct-1', milestoneId: null, familyId: FAMILY_ID },
  ],
  vaccineDocument: [
    { id: 'vdoc-1', originalName: 'card.pdf', storedName: 'stored-doc.enc', mimeType: 'application/pdf',
      fileSize: 2000, createdAt: new Date(), updatedAt: new Date(), vaccineLogId: 'vl-1' },
  ],
  unit: [
    { id: 'u-1', unitAbbr: 'ml', unitName: 'Milliliters', activityTypes: null, createdAt: new Date(), updatedAt: new Date() },
    { id: 'u-2', unitAbbr: 'oz', unitName: 'Ounces', activityTypes: null, createdAt: new Date(), updatedAt: new Date() },
  ],
};

// Prisma model accessors the builder touches; default to [] for the unlisted ones.
const emptyModels = [
  'settings', 'contact', 'familyMember', 'medicine', 'food', 'sleepLog', 'diaperLog',
  'moodLog', 'note', 'milestone', 'pumpLog', 'breastMilkAdjustment', 'playLog', 'bathLog',
  'measurement', 'medicineLog', 'foodLog', 'babyAllergen', 'calendarEvent', 'babyEvent',
  'caretakerEvent', 'contactEvent', 'contactMedicine', 'contactVaccine', 'photoLog',
  'photoLink', 'photoFavorite',
] as const;

function buildPrismaMock() {
  const model = (rows: any[]) => ({ findMany: vi.fn(async () => rows) });
  const p: any = {
    family: { findUnique: vi.fn(async () => fixture.family) },
    caretaker: model(fixture.caretaker),
    baby: model(fixture.baby),
    feedLog: model(fixture.feedLog),
    vaccineLog: model(fixture.vaccineLog),
    photo: model(fixture.photo),
    vaccineDocument: model(fixture.vaccineDocument),
    unit: model(fixture.unit),
  };
  for (const name of emptyModels) p[name] = model([]);
  return p;
}

let prismaMock: any;

vi.mock('@/app/api/db', () => ({
  get default() {
    return prismaMock;
  },
}));

vi.mock('@/app/api/photos/photo-service', () => ({
  isPhotosEnabled: vi.fn(async () => true),
  photoSubdir: (familyId: string) => `photos/${familyId}`,
}));

const exportPhoto = vi.fn((_photo: any, _familyId: string) => ({ display: new Uint8Array([1, 2, 3]), thumb: new Uint8Array([4, 5]) }));
const exportVaccineDoc = vi.fn((_doc: any) => new Uint8Array([9, 9, 9]));

vi.mock('@/app/api/utils/family-migration-media', () => ({
  exportPhoto: (photo: any, familyId: string) => exportPhoto(photo, familyId),
  exportVaccineDoc: (doc: any) => exportVaccineDoc(doc),
}));

vi.mock('@/app/api/utils/db-provider', () => ({
  getDatabaseProvider: () => 'sqlite',
  isPostgreSQL: () => false,
  isSQLite: () => true,
}));

// Import under test AFTER mocks are registered.
import { buildFamilyMigration } from '@/app/api/utils/family-migration-export';

function csvRowCount(csv: string): number {
  const lines = csv.split(/\r\n|\n/).filter((l) => l.length > 0);
  return Math.max(0, lines.length - 1); // minus header
}

describe('buildFamilyMigration', () => {
  beforeEach(() => {
    prismaMock = buildPrismaMock();
    exportPhoto.mockClear();
    exportVaccineDoc.mockClear();
  });

  it('produces a zip with a valid manifest and expected counts', async () => {
    const buffer = await buildFamilyMigration(FAMILY_ID);
    const zip = await JSZip.loadAsync(buffer);

    const manifestFile = zip.file('manifest.json');
    expect(manifestFile).toBeTruthy();
    const manifest = JSON.parse(await manifestFile!.async('string'));

    expect(manifest.kind).toBe('family-migration');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.app).toBe('sprout-track');
    expect(manifest.family).toEqual({ slug: 'smith-family', name: 'Smith Family' });
    expect(manifest.features.photos).toBe(true);
    expect(manifest.sourceProvider).toBe('sqlite');
    expect(manifest.counts.babies).toBe(1);
    expect(manifest.counts.caretakers).toBe(1);
    expect(manifest.counts.feedLogs).toBe(2);
    expect(manifest.counts.photos).toBe(1);
    expect(manifest.counts.units).toBe(2);
    expect(Array.isArray(manifest.files)).toBe(true);
    expect(manifest.files).toContain('caretakers.csv');
    expect(manifest.files).toContain('feed-logs.csv');
    expect(manifest.files).toContain('units.csv');
  });

  it('scopes every table read to the requested familyId (golden rule)', async () => {
    await buildFamilyMigration(FAMILY_ID);
    // Direct-familyId table
    expect(prismaMock.feedLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ familyId: FAMILY_ID }) }),
    );
    expect(prismaMock.baby.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ familyId: FAMILY_ID }) }),
    );
  });

  it('emits the expected CSVs with correct row counts', async () => {
    const zip = await JSZip.loadAsync(await buildFamilyMigration(FAMILY_ID));

    const feed = zip.file('feed-logs.csv');
    expect(feed).toBeTruthy();
    expect(csvRowCount(await feed!.async('string'))).toBe(2);

    const babies = zip.file('babies.csv');
    expect(babies).toBeTruthy();
    expect(csvRowCount(await babies!.async('string'))).toBe(1);

    const units = zip.file('units.csv');
    expect(units).toBeTruthy();
    expect(csvRowCount(await units!.async('string'))).toBe(2);

    // Empty table still emits a header-only, well-formed CSV.
    const contacts = zip.file('contacts.csv');
    expect(contacts).toBeTruthy();
    expect(csvRowCount(await contacts!.async('string'))).toBe(0);
  });

  it('exports media bytes via the F3 delegates', async () => {
    const zip = await JSZip.loadAsync(await buildFamilyMigration(FAMILY_ID));

    expect(exportPhoto).toHaveBeenCalledTimes(1);
    expect(exportPhoto).toHaveBeenCalledWith(expect.objectContaining({ storedName: 'stored-a.enc' }), FAMILY_ID);
    expect(exportVaccineDoc).toHaveBeenCalledTimes(1);

    expect(zip.file('photos/photo-1')).toBeTruthy();
    expect(zip.file('photos/photo-1.thumb')).toBeTruthy();
    expect(zip.file('vaccine-docs/vdoc-1')).toBeTruthy();

    // Metadata CSVs carry the rows.
    expect(zip.file('photos.csv')).toBeTruthy();
    expect(zip.file('vaccine-docs.csv')).toBeTruthy();
  });

  it('skips a photo whose decrypt fails without aborting the export', async () => {
    exportPhoto.mockReturnValueOnce(null as any);
    const zip = await JSZip.loadAsync(await buildFamilyMigration(FAMILY_ID));
    expect(zip.file('photos/photo-1')).toBeNull();
    // The rest of the archive still builds.
    expect(zip.file('manifest.json')).toBeTruthy();
  });
});
