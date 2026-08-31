/**
 * import-file-detect — decide which import path a user-picked file belongs to so a
 * single "Import" button can route it. Two on-disk formats reach the same button:
 *
 *   - `backup`    — a full database backup: a bare `.db` file, or a zip containing
 *                   `baby-tracker.db` (SQLite) or `data.json` (Postgres). Restored
 *                   via the BackupRestore flow (`/api/database` / `restore-initial`).
 *   - `migration` — a single-family export: a zip whose `manifest.json` has
 *                   `kind === 'family-migration'`. Imported via the migration flow
 *                   (`/api/database/import-family` / `import-family-initial`).
 *
 * `classifyZipEntries` is a pure function (zip entry names + optional manifest kind)
 * so it can be unit-tested without a real archive; `detectImportFileKind` is the thin
 * browser wrapper that reads the file with JSZip and calls it.
 */
import { MIGRATION_KIND } from '@/src/types/family-migration';

export type ImportFileKind = 'migration' | 'backup' | 'unknown';

/**
 * Pure classifier. Given the entry names inside a zip and the `kind` field parsed
 * from its `manifest.json` (when one exists), decide the import path. A zip carrying
 * a `manifest.json` is only a migration when its kind matches — a manifest of any
 * other kind is `unknown` rather than silently treated as a backup.
 */
export function classifyZipEntries(entryNames: string[], manifestKind?: string | null): ImportFileKind {
  const names = new Set(entryNames.map((n) => n.replace(/^\.?\//, '')));
  if (names.has('manifest.json')) {
    return manifestKind === MIGRATION_KIND ? 'migration' : 'unknown';
  }
  if (names.has('baby-tracker.db') || names.has('data.json')) return 'backup';
  return 'unknown';
}

/**
 * Browser entry point: inspect a picked File and resolve its import kind. A bare
 * `.db` is a backup with no need to unzip; anything else is read as a zip and
 * classified. Any read/parse failure resolves to `unknown` so the caller can show
 * one "unrecognized file" message rather than crash.
 */
export async function detectImportFileKind(file: File): Promise<ImportFileKind> {
  if (file.name.toLowerCase().endsWith('.db')) return 'backup';
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entryNames = Object.keys(zip.files);
    let manifestKind: string | null = null;
    const manifestFile = zip.file('manifest.json');
    if (manifestFile) {
      try {
        manifestKind = JSON.parse(await manifestFile.async('string'))?.kind ?? null;
      } catch {
        manifestKind = null;
      }
    }
    return classifyZipEntries(entryNames, manifestKind);
  } catch {
    return 'unknown';
  }
}
