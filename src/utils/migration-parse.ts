/**
 * Family Migration — archive parse (Stage 1, pure/DB-free).
 *
 * `parseMigration(zipBuffer)` loads the archive, reads and **validates**
 * `manifest.json` (F0 `validateManifest` — wrong `kind` or unknown/newer
 * `schemaVersion` rejects with no partial import), then parses every CSV into
 * typed rows and keeps the decrypted media bytes addressable by source id. No DB.
 *
 * ## F1 wiring status (W2 TODO)
 * The CSV → typed-row step consumes **F1** (`src/utils/migration-csv.ts`:
 * `parseTable` + the per-table column/coercer registry), which is not committed
 * yet. This module validates the manifest today; the CSV/media materialization is
 * stubbed behind the clearly-marked TODO below and must be completed when F1 lands
 * (see `implementation-plan/03-plan-core.md` — "Wire `parseMigration` (F1→F2) at
 * the start of W2"). `planMigration` (this feature, F2) is fully implemented and
 * operates on any `ParsedMigration`, however produced.
 */

import JSZip from 'jszip';
import type { MediaBytes, MigrationTables, ParsedMigration } from '@/src/types/family-migration';
import { validateManifest } from '@/src/utils/migration-manifest';

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
 * Read + validate the archive's manifest without materializing table rows. Pure.
 * Throws a clear error when the zip has no `manifest.json`, the manifest JSON is
 * malformed, or `validateManifest` rejects it.
 */
export async function readManifest(zipBuffer: Uint8Array | ArrayBuffer): Promise<ParsedMigration['manifest']> {
  const zip = await JSZip.loadAsync(zipBuffer);
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
 * Parse a family-migration archive into a `ParsedMigration`. Validates the
 * manifest first (rejecting outright on any failure), then materializes every
 * table's rows and the media byte maps.
 *
 * NOTE: the CSV/media materialization is the F1 seam and is not wired yet — see
 * the module header. Until W2 completes the wiring this throws after a successful
 * manifest validation. Callers that already hold a `ParsedMigration` should use
 * `planMigration` directly.
 */
export async function parseMigration(zipBuffer: Uint8Array | ArrayBuffer): Promise<ParsedMigration> {
  const manifest = await readManifest(zipBuffer);

  // TODO(W2 / F1): wire `parseTable(csv, coercers)` + the per-table column/coercer
  // registry from `src/utils/migration-csv.ts` to fill `tables`, and read the
  // encrypted media entries into `photoBytes` / `vaccineDocBytes` keyed by source
  // id. Delete this throw once wired. See implementation-plan/03-plan-core.md.
  void manifest;
  const _tables: MigrationTables = emptyMigrationTables();
  const _photoBytes = new Map<string, MediaBytes>();
  const _vaccineDocBytes = new Map<string, Uint8Array>();
  void _tables; void _photoBytes; void _vaccineDocBytes;

  throw new Error(
    'parseMigration: CSV/media parsing is not yet wired to F1 (src/utils/migration-csv.ts). ' +
    'The manifest validated successfully; complete the F1→F2 wiring in W2.',
  );
}
