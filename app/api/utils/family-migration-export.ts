/**
 * Family Migration — Export Builder (F4).
 *
 * `buildFamilyMigration(familyId)` reads every in-scope row for a single family,
 * serializes each table to CSV (F1), decrypts referenced media to raw bytes (F3),
 * and packs everything plus a `manifest.json` (F0) into a DEFLATE-compressed zip.
 *
 * Golden rule: every read is scoped to the requested `familyId` (or, for the
 * junction/child tables without their own `familyId` column, to a parent that is).
 * Never a client-supplied family value — the caller passes `authContext.familyId`.
 *
 * Provider-agnostic: works whether the source family lives on Postgres or SQLite.
 * The file carries plaintext caretaker PINs and decrypted media bytes by design
 * (accepted — see spec 02). Media byte export is skipped cleanly when photos are
 * disabled at the source or none are present; a decrypt failure skips that single
 * file rather than aborting the archive.
 *
 * See `documentation/temp-development-docs/account-export-import/02-export-builder.md`
 * and `01-migration-format.md`.
 */

import JSZip from 'jszip';
import prisma from '@/app/api/db';
import { isPhotosEnabled } from '@/app/api/photos/photo-service';
import { getDatabaseProvider } from '@/app/api/utils/db-provider';
import { exportPhoto, exportVaccineDoc } from '@/app/api/utils/family-migration-media';
import { serializeTable, MIGRATION_TABLE_COLUMNS } from '@/src/utils/migration-csv';
import { buildManifest } from '@/src/utils/migration-manifest';
import type { MigrationCounts, MigrationTableKey } from '@/src/types/family-migration';

/**
 * CSV file name per migration table (kebab-case), matching the archive layout in
 * spec 01. The single source of truth for export file naming.
 */
const TABLE_FILE_NAMES: Record<MigrationTableKey, string> = {
  caretakers: 'caretakers.csv',
  babies: 'babies.csv',
  settings: 'settings.csv',
  contacts: 'contacts.csv',
  familyMembers: 'family-members.csv',
  medicines: 'medicines.csv',
  foods: 'foods.csv',
  units: 'units.csv',
  sleepLogs: 'sleep-logs.csv',
  feedLogs: 'feed-logs.csv',
  diaperLogs: 'diaper-logs.csv',
  moodLogs: 'mood-logs.csv',
  notes: 'notes.csv',
  milestones: 'milestones.csv',
  pumpLogs: 'pump-logs.csv',
  breastMilkAdjustments: 'breast-milk-adjustments.csv',
  playLogs: 'play-logs.csv',
  bathLogs: 'bath-logs.csv',
  measurements: 'measurements.csv',
  medicineLogs: 'medicine-logs.csv',
  foodLogs: 'food-logs.csv',
  vaccineLogs: 'vaccine-logs.csv',
  babyAllergens: 'baby-allergens.csv',
  calendarEvents: 'calendar-events.csv',
  babyEvents: 'calendar-baby.csv',
  caretakerEvents: 'calendar-caretaker.csv',
  contactEvents: 'calendar-contact.csv',
  contactMedicines: 'contact-medicines.csv',
  contactVaccines: 'contact-vaccines.csv',
  photos: 'photos.csv',
  photoLogs: 'photo-logs.csv',
  photoLinks: 'photo-links.csv',
  photoFavorites: 'photo-favorites.csv',
  vaccineDocuments: 'vaccine-docs.csv',
};

/** Read every in-scope table for `familyId`, table by table (golden rule). */
async function readTables(familyId: string): Promise<Record<MigrationTableKey, any[]>> {
  const byFamily = { where: { familyId } };
  // Junction/child tables have no own familyId — scope through a parent that does.
  const viaEvent = { where: { event: { familyId } } };

  const [
    caretakers, babies, settings, contacts, familyMembers, medicines, foods,
    sleepLogs, feedLogs, diaperLogs, moodLogs, notes, milestones, pumpLogs,
    breastMilkAdjustments, playLogs, bathLogs, measurements, medicineLogs, foodLogs,
    vaccineLogs, babyAllergens, calendarEvents, babyEvents, caretakerEvents, contactEvents,
    contactMedicines, contactVaccines, photos, photoLogs, photoLinks, photoFavorites,
    vaccineDocuments,
  ] = await Promise.all([
    prisma.caretaker.findMany(byFamily),
    prisma.baby.findMany(byFamily),
    prisma.settings.findMany(byFamily),
    prisma.contact.findMany(byFamily),
    prisma.familyMember.findMany(byFamily),
    prisma.medicine.findMany(byFamily),
    prisma.food.findMany(byFamily),
    prisma.sleepLog.findMany(byFamily),
    prisma.feedLog.findMany(byFamily),
    prisma.diaperLog.findMany(byFamily),
    prisma.moodLog.findMany(byFamily),
    prisma.note.findMany(byFamily),
    prisma.milestone.findMany(byFamily),
    prisma.pumpLog.findMany(byFamily),
    prisma.breastMilkAdjustment.findMany(byFamily),
    prisma.playLog.findMany(byFamily),
    prisma.bathLog.findMany(byFamily),
    prisma.measurement.findMany(byFamily),
    prisma.medicineLog.findMany(byFamily),
    prisma.foodLog.findMany(byFamily),
    prisma.vaccineLog.findMany(byFamily),
    prisma.babyAllergen.findMany(byFamily),
    prisma.calendarEvent.findMany(byFamily),
    prisma.babyEvent.findMany(viaEvent),
    prisma.caretakerEvent.findMany(viaEvent),
    prisma.contactEvent.findMany(viaEvent),
    prisma.contactMedicine.findMany({ where: { medicine: { familyId } } }),
    prisma.contactVaccine.findMany({ where: { contact: { familyId } } }),
    prisma.photo.findMany(byFamily),
    prisma.photoLog.findMany(byFamily),
    prisma.photoLink.findMany({ where: { photo: { familyId } } }),
    prisma.photoFavorite.findMany({ where: { photo: { familyId } } }),
    prisma.vaccineDocument.findMany({ where: { vaccineLog: { familyId } } }),
  ]);

  return {
    caretakers, babies, settings, contacts, familyMembers, medicines, foods,
    units: [], // filled after we know which units are referenced
    sleepLogs, feedLogs, diaperLogs, moodLogs, notes, milestones, pumpLogs,
    breastMilkAdjustments, playLogs, bathLogs, measurements, medicineLogs, foodLogs,
    vaccineLogs, babyAllergens, calendarEvents, babyEvents, caretakerEvents, contactEvents,
    contactMedicines, contactVaccines, photos, photoLogs, photoLinks, photoFavorites,
    vaccineDocuments,
  };
}

/** Distinct non-null `unitAbbr` referenced across the unit-bearing tables. */
function referencedUnitAbbrs(tables: Record<MigrationTableKey, any[]>): string[] {
  const abbrs = new Set<string>();
  const collect = (rows: any[]) => {
    for (const row of rows) {
      if (row.unitAbbr) abbrs.add(row.unitAbbr as string);
    }
  };
  // Measurement.unit is a plain string, not a FK — deliberately excluded.
  collect(tables.feedLogs);
  collect(tables.pumpLogs);
  collect(tables.medicines);
  collect(tables.medicineLogs);
  collect(tables.foodLogs);
  return [...abbrs];
}

/**
 * Build the migration `.zip` for a single family and return its bytes.
 * Reads are scoped to `familyId` throughout (golden rule).
 */
export async function buildFamilyMigration(familyId: string): Promise<Buffer> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { slug: true, name: true },
  });
  if (!family) {
    throw new Error(`Family ${familyId} not found`);
  }

  const tables = await readTables(familyId);

  // Referenced Units → units.csv (global table, keyed by the @unique unitAbbr).
  const abbrs = referencedUnitAbbrs(tables);
  tables.units = abbrs.length
    ? await prisma.unit.findMany({ where: { unitAbbr: { in: abbrs } } })
    : [];

  const photosEnabled = await isPhotosEnabled();

  const zip = new JSZip();
  const files: string[] = [];
  const counts: MigrationCounts = {};

  // Serialize every table via F1 in the registry's column order.
  for (const key of Object.keys(MIGRATION_TABLE_COLUMNS) as MigrationTableKey[]) {
    const rows = tables[key];
    const fileName = TABLE_FILE_NAMES[key];
    zip.file(fileName, serializeTable(rows, MIGRATION_TABLE_COLUMNS[key]));
    files.push(fileName);
    counts[key] = rows.length;
  }

  // Media bytes (F3). Photo bytes are gated on the source photos feature flag;
  // a decrypt failure skips that single file (F3 returns null) and is reported.
  if (photosEnabled) {
    for (const photo of tables.photos) {
      const media = exportPhoto(photo, familyId);
      if (!media) continue; // decrypt failed — skip this photo
      zip.file(`photos/${photo.id}`, media.display);
      if (media.thumb) {
        zip.file(`photos/${photo.id}.thumb`, media.thumb);
      }
    }
  }

  for (const doc of tables.vaccineDocuments) {
    const bytes = exportVaccineDoc(doc);
    if (!bytes) continue; // decrypt failed — skip this document
    zip.file(`vaccine-docs/${doc.id}`, bytes);
  }

  const manifest = buildManifest({
    family: { slug: family.slug, name: family.name },
    sourceProvider: getDatabaseProvider(),
    features: { photos: photosEnabled },
    counts,
    files,
  });
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
