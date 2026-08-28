/**
 * Family Migration — import apply (Stage 3, DB + filesystem shell).
 *
 * `importMigration(zipBuffer, opts)` runs the full pipeline:
 *   parseMigration (F2, pure)  →  preload existing target data (append only)  →
 *   planMigration (F2, pure)   →  applyMigration (this file — DB + media).
 *
 * `applyMigration` is the only stage that touches Prisma and the filesystem. It
 * inserts the planned rows in `MIGRATION_TABLE_ORDER` with batched `createMany`
 * (BATCH_SIZE = 100, mirroring `importFromSQLiteFile`), then re-encrypts media via
 * F3 (`family-migration-media.ts`) after the owning rows exist.
 *
 * ## Golden rule
 * Every inserted row already carries `familyId = target` — `planMigration` forces
 * it through `remapRow`; the archive's own `familyId` is never trusted. The target
 * family is chosen by the caller (a new family, or an existing family the endpoint
 * authorized), never read from the file.
 *
 * ## Consistency
 * - `new-family`: the Family row + every table insert run inside a single
 *   `prisma.$transaction`; any failure rolls the whole thing back, so a failed
 *   import leaves no partial family behind. Media runs after commit (filesystem,
 *   per-item skip+report — never fatal).
 * - `append`: inserts run per-table with a `createMany`→per-row fallback so a
 *   duplicate junction (both sides reconciled to existing rows) is tolerated
 *   rather than aborting the merge.
 *
 * Prisma 7: the client is the shared adapter-backed singleton from `app/api/db.ts`
 * — never `new PrismaClient()`. Dual-DB safe (plain inserts, no provider-specific
 * flags; `skipDuplicates` is avoided because SQLite rejects it).
 */

import prisma from '../db';
import { getQuotaInfo } from '../photos/photo-service';
import {
  importPhoto as defaultImportPhoto,
  importVaccineDoc as defaultImportVaccineDoc,
} from './family-migration-media';
import { parseMigration } from '@/src/utils/migration-parse';
import { planMigration, type ExistingTargetData } from '@/src/utils/migration-plan';
import { planPhotoQuota } from '@/src/utils/migration-quota';
import { dedupKey, DEDUP_KEY_FIELDS } from '@/src/utils/migration-dedup';
import type {
  ImportOptions,
  InsertPlan,
  MediaBytes,
  MigrationManifest,
  MigrationReport,
  ParsedMigration,
} from '@/src/types/family-migration';

/** Rows per `createMany`, mirroring `importFromSQLiteFile`. */
const BATCH_SIZE = 100;

/**
 * The Prisma surface `applyMigration` needs. Kept minimal and injectable so the
 * apply logic is unit-testable without a live database (tests pass a fake).
 */
export interface ImportClient {
  $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
  [model: string]: any;
}

/**
 * Injectable dependencies. Production wiring uses the shared Prisma singleton, the
 * F3 media re-encryptors, and `getQuotaInfo`; tests substitute fakes.
 */
export interface ApplyDeps {
  client: ImportClient;
  importPhoto: typeof defaultImportPhoto;
  importVaccineDoc: typeof defaultImportVaccineDoc;
  /** Remaining photo-byte budget on the target *before* this import's photos. */
  getRemainingPhotoBytes: (familyId: string) => Promise<number>;
}

/** Default production dependencies. */
export function defaultDeps(): ApplyDeps {
  return {
    client: prisma as unknown as ImportClient,
    importPhoto: defaultImportPhoto,
    importVaccineDoc: defaultImportVaccineDoc,
    getRemainingPhotoBytes: async (familyId: string) => {
      const { usedBytes, totalBytes } = await getQuotaInfo(familyId);
      return Math.max(0, totalBytes - usedBytes);
    },
  };
}

/** PascalCase table name → Prisma model delegate (camelCase). */
function delegateFor(client: ImportClient, table: string): any {
  const model = table.charAt(0).toLowerCase() + table.slice(1);
  return client[model];
}

/**
 * Insert every planned batch. `tolerateErrors` (append) falls back to per-row
 * inserts when a batch `createMany` throws, so a duplicate junction between two
 * reconciled entities is skipped instead of aborting. In `new-family` mode
 * (`tolerateErrors = false`) any error propagates so the transaction rolls back.
 */
async function insertBatches(
  client: ImportClient,
  batches: InsertPlan['batches'],
  tolerateErrors: boolean,
): Promise<void> {
  for (const { table, rows } of batches) {
    if (rows.length === 0) continue;
    const delegate = delegateFor(client, table);
    if (!delegate) throw new Error(`No Prisma model for table "${table}"`);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const slice = rows.slice(i, i + BATCH_SIZE);
      try {
        await delegate.createMany({ data: slice });
      } catch (error) {
        if (!tolerateErrors) throw error;
        for (const row of slice) {
          try {
            await delegate.create({ data: row });
          } catch {
            // append: likely a duplicate junction — skip and continue.
          }
        }
      }
    }
  }
}

/** Target ids of the rows actually emitted for one table. */
function insertedIds(plan: InsertPlan, table: string): Set<string> {
  const rows = (plan.batches.find((b) => b.table === table)?.rows ?? []) as Array<{ id?: string }>;
  return new Set(rows.map((r) => r.id).filter((v): v is string => typeof v === 'string'));
}

/**
 * Re-encrypt and attach photo bytes for every inserted Photo, oldest-first within
 * the remaining quota. Runs after the Photo rows are committed (they carry the
 * source `storedName`; each selected photo's row is updated with fresh stored
 * names). Skips + reports over-quota and missing/failed bytes — never fatal.
 */
async function migratePhotos(
  plan: InsertPlan,
  parsed: ParsedMigration,
  report: MigrationReport,
  deps: ApplyDeps,
  remainingBytes: number,
): Promise<void> {
  const inserted = insertedIds(plan, 'Photo');
  if (inserted.size === 0) return;

  interface Candidate { targetId: string; fileSize: number; thumbSize: number; takenAt: Date; bytes: MediaBytes }
  const withBytes: Candidate[] = [];
  let missing = 0;

  for (const raw of parsed.tables.photos as Array<Record<string, any>>) {
    const targetId = plan.idMap.get('Photo', raw.id);
    if (!targetId || !inserted.has(targetId)) continue;
    const bytes = parsed.photoBytes.get(raw.id);
    if (!bytes) { missing += 1; continue; }
    const takenAt = raw.takenAt instanceof Date ? raw.takenAt : new Date(raw.takenAt ?? 0);
    withBytes.push({
      targetId,
      fileSize: Number(raw.fileSize) || 0,
      thumbSize: Number(raw.thumbSize) || 0,
      takenAt,
      bytes,
    });
  }
  report.media.photos.skippedDecryptError += missing;

  const { selected, skippedOverQuota } = planPhotoQuota(withBytes, remainingBytes);
  report.media.photos.skippedOverQuota += skippedOverQuota.length;

  const delegate = delegateFor(deps.client, 'Photo');
  for (const c of selected) {
    try {
      const stored = deps.importPhoto(c.bytes.display, c.bytes.thumb, plan.targetFamilyId);
      await delegate.update({
        where: { id: c.targetId },
        data: { storedName: stored.storedName, thumbStoredName: stored.thumbStoredName },
      });
      report.media.photos.migrated += 1;
    } catch (error) {
      console.error(`Migration import: failed to re-encrypt photo ${c.targetId}:`, error);
      report.media.photos.skippedDecryptError += 1;
    }
  }
}

/**
 * Re-encrypt and attach vaccine-document bytes for every inserted VaccineDocument
 * (no quota). Missing/failed bytes are skipped + reported.
 */
async function migrateVaccineDocs(
  plan: InsertPlan,
  parsed: ParsedMigration,
  report: MigrationReport,
  deps: ApplyDeps,
): Promise<void> {
  const inserted = insertedIds(plan, 'VaccineDocument');
  if (inserted.size === 0) return;

  const delegate = delegateFor(deps.client, 'VaccineDocument');
  for (const raw of parsed.tables.vaccineDocuments as Array<Record<string, any>>) {
    const targetId = plan.idMap.get('VaccineDocument', raw.id);
    if (!targetId || !inserted.has(targetId)) continue;
    const bytes = parsed.vaccineDocBytes.get(raw.id);
    if (!bytes) { report.media.vaccineDocs.skippedDecryptError += 1; continue; }
    try {
      const storedName = deps.importVaccineDoc(bytes);
      await delegate.update({ where: { id: targetId }, data: { storedName } });
      report.media.vaccineDocs.migrated += 1;
    } catch (error) {
      console.error(`Migration import: failed to re-encrypt vaccine document ${targetId}:`, error);
      report.media.vaccineDocs.skippedDecryptError += 1;
    }
  }
}

/**
 * Execute an `InsertPlan` against the database + filesystem and return the
 * finalized `MigrationReport`. See the module header for the transaction/rollback
 * model and the golden rule.
 */
export async function applyMigration(
  plan: InsertPlan,
  parsed: ParsedMigration,
  opts: ImportOptions,
  deps: ApplyDeps = defaultDeps(),
): Promise<MigrationReport> {
  const report = plan.report;
  const target = plan.targetFamilyId;

  // Capture the pre-import photo budget BEFORE inserting Photo rows (they would
  // otherwise count against the target's own usage and double-charge the import).
  const remainingPhotoBytes = await deps.getRemainingPhotoBytes(target).catch(() => 0);

  if (plan.mode === 'new-family') {
    if (!opts.newFamily) throw new Error('applyMigration: new-family mode requires newFamily name/slug');
    const { name, slug } = opts.newFamily;
    try {
      await deps.client.$transaction(async (tx) => {
        await tx.family.create({
          data: { id: target, name, slug, isActive: true, setupStage: 3 },
        });
        await insertBatches(tx as ImportClient, plan.batches, false);
      });
    } catch (error) {
      // Transaction rolled back — no partial family remains.
      throw new Error(
        `Family import failed and was rolled back: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    await insertBatches(deps.client, plan.batches, true);
  }

  // Media after the owning rows exist (filesystem; per-item skip+report).
  await migratePhotos(plan, parsed, report, deps, remainingPhotoBytes);
  await migrateVaccineDocs(plan, parsed, report, deps);

  return report;
}

/**
 * Load the existing target-family state the pure planner needs to reconcile
 * entities and (when `dedup`) skip duplicate logs. Only queried in append mode.
 */
export async function preloadExisting(
  client: ImportClient,
  targetFamilyId: string,
  dedup: boolean,
): Promise<ExistingTargetData> {
  const [babies, caretakers, contacts, medicines, foods, units] = await Promise.all([
    client.baby.findMany({ where: { familyId: targetFamilyId }, select: { id: true, firstName: true, lastName: true, birthDate: true } }),
    client.caretaker.findMany({ where: { familyId: targetFamilyId }, select: { id: true, loginId: true } }),
    client.contact.findMany({ where: { familyId: targetFamilyId }, select: { id: true, name: true, role: true } }),
    client.medicine.findMany({ where: { familyId: targetFamilyId }, select: { id: true, name: true } }),
    client.food.findMany({ where: { familyId: targetFamilyId }, select: { id: true, name: true } }),
    client.unit.findMany({ select: { unitAbbr: true } }),
  ]);

  const existing: ExistingTargetData = {
    babies,
    caretakers,
    contacts,
    medicines,
    foods,
    unitAbbrs: new Set((units as Array<{ unitAbbr: string }>).map((u) => u.unitAbbr)),
  };

  if (dedup) {
    const logKeys: Record<string, Set<string>> = {};
    for (const table of Object.keys(DEDUP_KEY_FIELDS)) {
      const delegate = delegateFor(client, table);
      if (!delegate) continue;
      const rows = (await delegate.findMany({ where: { familyId: targetFamilyId } })) as Array<Record<string, any>>;
      const set = new Set<string>();
      for (const row of rows) {
        const key = dedupKey(table, row);
        if (key) set.add(key);
      }
      logKeys[table] = set;
    }
    existing.logKeys = logKeys;
  }

  return existing;
}

/** The result of a full import: the finalized report and the family it landed in. */
export interface ImportMigrationResult {
  report: MigrationReport;
  targetFamilyId: string;
}

/**
 * Full import pipeline: parse → (preload for append) → plan → apply. See the
 * module header. The target family is `opts.newFamily` (created here) or the
 * existing `opts.targetFamilyId` (verified to exist) — never the archive's.
 */
export async function importMigration(
  zipBuffer: Uint8Array | ArrayBuffer,
  opts: ImportOptions,
  deps: ApplyDeps = defaultDeps(),
): Promise<ImportMigrationResult> {
  const parsed = await parseMigration(zipBuffer);

  let existing: ExistingTargetData = {};
  if (opts.mode === 'append') {
    if (!opts.targetFamilyId) throw new Error('importMigration: append mode requires targetFamilyId');
    const family = await deps.client.family.findUnique({ where: { id: opts.targetFamilyId }, select: { id: true } });
    if (!family) throw new Error('importMigration: target family not found');
    existing = await preloadExisting(deps.client, opts.targetFamilyId, opts.dedup);
  }

  const plan = planMigration(parsed, opts, existing);
  const report = await applyMigration(plan, parsed, opts, deps);
  return { report, targetFamilyId: plan.targetFamilyId };
}

/** The parse-only preview returned by the import endpoint's first step. */
export interface MigrationPreview {
  family: MigrationManifest['family'];
  counts: MigrationManifest['counts'];
  features: MigrationManifest['features'];
  exportedAt: string;
  sourceProvider: MigrationManifest['sourceProvider'];
}

/** Build the two-step preview payload from a validated manifest. */
export function toPreview(manifest: MigrationManifest): MigrationPreview {
  return {
    family: manifest.family,
    counts: manifest.counts,
    features: manifest.features,
    exportedAt: manifest.exportedAt,
    sourceProvider: manifest.sourceProvider,
  };
}
