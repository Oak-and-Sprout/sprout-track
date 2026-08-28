/**
 * Family Migration — archive parse (Stage 1, pure/DB-free).
 *
 * `parseMigration(zipBuffer)` loads the archive, reads and **validates**
 * `manifest.json` (F0 `validateManifest` — wrong `kind` or unknown/newer
 * `schemaVersion` rejects with no partial import), then parses every CSV into
 * typed rows and keeps the decrypted media bytes addressable by source id. No DB.
 *
 * The CSV → typed-row step consumes **F1** (`src/utils/migration-csv.ts`:
 * `parseTable` + the `MIGRATION_TABLE_COLUMNS` per-table column/coercer registry).
 * Filenames follow `MIGRATION_TABLE_FILES` below — the single source of truth for
 * the archive layout in `01-migration-format.md`, shared with the export writer
 * (F4). Media entries live under `photos/<id>`, `photos/<id>.thumb`, and
 * `vaccine-docs/<id>`; their decrypted bytes are keyed by source record id.
 * `planMigration` (F2) consumes the resulting `ParsedMigration`.
 */

import JSZip from 'jszip';
import type {
  MediaBytes,
  MigrationTableKey,
  MigrationTables,
  ParsedMigration,
} from '@/src/types/family-migration';
import { validateManifest } from '@/src/utils/migration-manifest';
import { MIGRATION_TABLE_COLUMNS, parseTable } from '@/src/utils/migration-csv';

/**
 * Canonical archive filename for every table, keyed by the camelCase table name.
 * The single source of truth for the zip layout (`01-migration-format.md`), shared
 * by the export writer (F4) and this parser (F5). Names match the spec diagram;
 * the split photo/junction files use the kebab-case forms named there.
 */
export const MIGRATION_TABLE_FILES: Record<MigrationTableKey, string> = {
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

/** Media directories inside the archive (decrypted raw bytes). */
export const MIGRATION_MEDIA_DIRS = {
  photos: 'photos',
  vaccineDocs: 'vaccine-docs',
} as const;

/** Every `MigrationTables` key initialized to an empty array. */
export function emptyMigrationTables(): MigrationTables {
  return {
    caretakers: [], babies: [], settings: [], contacts: [], familyMembers: [],
    medicines: [], foods: [], units: [], sleepLogs: [], feedLogs: [], diaperLogs: [],
    moodLogs: [], notes: [], milestones: [], pumpLogs: [], breastMilkAdjustments: [],
    playLogs: [], bathLogs: [], measurements: [], medicineLogs: [], foodLogs: [],
    vaccineLogs: [], babyAllergens: [], calendarEvents: [], babyEvents: [],
    caretakerEvents: [], contactEvents: [], contactMedicines: [], contactVaccines: [],
    photos: [], photoLogs: [], photoLinks: [], photoFavorites: [], vaccineDocuments: [],
  };
}

/**
 * Read + validate a manifest already loaded from the archive. Pure.
 * Throws a clear error when the zip has no `manifest.json`, the manifest JSON is
 * malformed, or `validateManifest` rejects it.
 */
async function manifestFromZip(zip: JSZip): Promise<ParsedMigration['manifest']> {
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid migration archive: missing manifest.json.');
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await manifestFile.async('string'));
  } catch {
    throw new Error('Invalid migration archive: manifest.json is not valid JSON.');
  }

  const result = validateManifest(raw);
  if (!result.ok) throw new Error(result.error);
  return result.manifest;
}

/**
 * Read + validate the archive's manifest without materializing table rows. Pure.
 * Throws a clear error when the zip has no `manifest.json`, the manifest JSON is
 * malformed, or `validateManifest` rejects it.
 */
export async function readManifest(zipBuffer: Uint8Array | ArrayBuffer): Promise<ParsedMigration['manifest']> {
  const zip = await JSZip.loadAsync(zipBuffer);
  return manifestFromZip(zip);
}

/**
 * Parse a family-migration archive into a `ParsedMigration`. Validates the
 * manifest first (rejecting outright on any failure), then materializes every
 * table's rows (via F1 `parseTable` + `MIGRATION_TABLE_COLUMNS`) and the decrypted
 * media byte maps. Tables/media absent from the archive parse to empty. No DB.
 */
export async function parseMigration(zipBuffer: Uint8Array | ArrayBuffer): Promise<ParsedMigration> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const manifest = await manifestFromZip(zip);

  const tables = emptyMigrationTables();
  for (const key of Object.keys(MIGRATION_TABLE_FILES) as MigrationTableKey[]) {
    const file = zip.file(MIGRATION_TABLE_FILES[key]);
    if (!file) continue; // table absent from the archive → stays empty
    const csv = await file.async('string');
    const rows = parseTable(csv, MIGRATION_TABLE_COLUMNS[key]);
    (tables as unknown as Record<string, unknown[]>)[key] = rows;
  }

  // Decrypted media bytes, keyed by *source* record id. Read only the entries that
  // correspond to a parsed row so keys line up with the id remap at plan time.
  const photoBytes = new Map<string, MediaBytes>();
  for (const photo of tables.photos as Array<{ id?: unknown }>) {
    const id = photo?.id;
    if (typeof id !== 'string' || id === '') continue;
    const displayFile = zip.file(`${MIGRATION_MEDIA_DIRS.photos}/${id}`);
    if (!displayFile) continue; // no bytes exported for this photo (skipped/disabled)
    const display = await displayFile.async('uint8array');
    const thumbFile = zip.file(`${MIGRATION_MEDIA_DIRS.photos}/${id}.thumb`);
    const thumb = thumbFile ? await thumbFile.async('uint8array') : undefined;
    photoBytes.set(id, thumb ? { display, thumb } : { display });
  }

  const vaccineDocBytes = new Map<string, Uint8Array>();
  for (const doc of tables.vaccineDocuments as Array<{ id?: unknown }>) {
    const id = doc?.id;
    if (typeof id !== 'string' || id === '') continue;
    const docFile = zip.file(`${MIGRATION_MEDIA_DIRS.vaccineDocs}/${id}`);
    if (!docFile) continue;
    vaccineDocBytes.set(id, await docFile.async('uint8array'));
  }

  return { manifest, tables, photoBytes, vaccineDocBytes };
}
