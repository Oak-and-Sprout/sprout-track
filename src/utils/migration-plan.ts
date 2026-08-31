/**
 * Family Migration — plan core (pure, DB-free).
 *
 * `planMigration` turns a `ParsedMigration` + `ImportOptions` into an ordered
 * `InsertPlan`: every row remapped to fresh target ids, `familyId` forced to the
 * target family, append-mode entities reconciled, and logs deduped. It writes
 * nothing — `applyMigration` (the DB/filesystem shell) executes the plan.
 *
 * The three concerns (spec 03):
 *   2a. id remap      — always; see `migration-idmap.ts`.
 *   2b. reconcile     — append only; see `migration-reconcile.ts`.
 *   2c. log dedup     — append + `dedup: true`; see `migration-dedup.ts`.
 *
 * Because it must stay pure, the existing target state (for reconcile + dedup) is
 * passed in via `ExistingTargetData` — the shell pre-loads it. `new-family` mode
 * needs none (empty target → everything is new).
 *
 * ## Golden rule
 * Every planned row carries `familyId = target`; the archive's `familyId` is never
 * trusted (see `remapRow` + the per-table `hasFamilyId` flag).
 *
 * ## Ordering
 * Rows are emitted in `MIGRATION_TABLE_ORDER`, which extends the shared
 * `TABLE_IMPORT_ORDER` (`app/api/utils/db-backup.ts`) with the migration-only
 * tables (Food, FoodLog, the Photo tables, BabyAllergen) that predate that
 * constant. The base
 * tables keep their `TABLE_IMPORT_ORDER` relative order — `migrationIdmap.test.ts`
 * guards that so "parents before children" still holds.
 */

import { randomUUID } from 'crypto';
import type {
  IdMap,
  ImportOptions,
  InsertBatch,
  InsertPlan,
  MigrationReport,
  ParsedMigration,
} from '@/src/types/family-migration';
import { createIdMap, remapRow, TABLE_SPECS } from '@/src/utils/migration-idmap';
import { naturalKey, reconcileEntities, type EntityKind, type Keyed } from '@/src/utils/migration-reconcile';
import { dedupKey, isDedupTable } from '@/src/utils/migration-dedup';

/**
 * Existing target-family state the shell pre-loads so the pure planner can
 * reconcile entities and dedup logs without a DB. All optional; append mode
 * supplies what it has, `new-family` supplies nothing.
 */
export interface ExistingTargetData {
  babies?: Keyed[];
  caretakers?: Keyed[];
  contacts?: Keyed[];
  medicines?: Keyed[];
  foods?: Keyed[];
  /** Abbreviations of units already present (global upsert key). */
  unitAbbrs?: Set<string>;
  /** Pre-built dedup key sets per PascalCase log table (see `dedupKey`). */
  logKeys?: Record<string, Set<string>>;
}

/** The five reconciled entity tables, in id-minting order. */
const ENTITY_TABLES: Array<{ table: string; key: string; kind: EntityKind; reportKey: keyof MigrationReport['entities'] }> = [
  { table: 'Caretaker', key: 'caretakers', kind: 'caretaker', reportKey: 'caretakers' },
  { table: 'Baby', key: 'babies', kind: 'baby', reportKey: 'babies' },
  { table: 'Contact', key: 'contacts', kind: 'contact', reportKey: 'contacts' },
  { table: 'Medicine', key: 'medicines', kind: 'medicine', reportKey: 'medicines' },
  { table: 'Food', key: 'foods', kind: 'food', reportKey: 'foods' },
];

/**
 * Emit order for the plan. Base tables preserve `TABLE_IMPORT_ORDER`'s relative
 * order; migration-only tables are spliced in at dependency-correct positions.
 */
export const MIGRATION_TABLE_ORDER: string[] = [
  'Unit',
  'Caretaker', 'Baby', 'Settings', 'Contact', 'FamilyMember',
  'SleepLog', 'FeedLog', 'DiaperLog', 'MoodLog', 'Note', 'Milestone',
  'PumpLog', 'BreastMilkAdjustment', 'PlayLog', 'BathLog', 'Measurement',
  'Medicine', 'Food', 'MedicineLog', 'FoodLog', 'BabyAllergen',
  'CalendarEvent', 'VaccineLog', 'VaccineDocument',
  'Photo', 'PhotoLog', 'PhotoLink', 'PhotoFavorite',
  'BabyEvent', 'CaretakerEvent', 'ContactEvent', 'ContactMedicine', 'ContactVaccine',
];

const LOG_REPORT_KEYS: Record<string, keyof MigrationReport['logs']> = {
  SleepLog: 'sleepLogs', FeedLog: 'feedLogs', DiaperLog: 'diaperLogs', MoodLog: 'moodLogs',
  Note: 'notes', Milestone: 'milestones', PumpLog: 'pumpLogs', BreastMilkAdjustment: 'breastMilkAdjustments',
  PlayLog: 'playLogs', BathLog: 'bathLogs', Measurement: 'measurements', MedicineLog: 'medicineLogs',
  FoodLog: 'foodLogs', VaccineLog: 'vaccineLogs',
};

function emptyReport(mode: ImportOptions['mode'], dedup: boolean): MigrationReport {
  const entity = () => ({ matched: 0, created: 0 });
  const log = () => ({ inserted: 0, skippedDuplicate: 0 });
  const media = () => ({ migrated: 0, skippedOverQuota: 0, skippedDecryptError: 0 });
  return {
    mode,
    dedup,
    entities: { babies: entity(), caretakers: entity(), contacts: entity(), medicines: entity(), foods: entity() },
    logs: {
      feedLogs: log(), sleepLogs: log(), diaperLogs: log(), moodLogs: log(), notes: log(),
      milestones: log(), pumpLogs: log(), breastMilkAdjustments: log(), playLogs: log(),
      bathLogs: log(), measurements: log(), medicineLogs: log(), foodLogs: log(), vaccineLogs: log(),
    },
    media: { photos: media(), vaccineDocs: media() },
    dropped: { photoFavoritesWithAccountOwner: 0, junctionsWithMissingSide: 0 },
    warnings: [],
  };
}

function rowsOf(parsed: ParsedMigration, key: string): Record<string, any>[] {
  return ((parsed.tables as any)[key] as Record<string, any>[]) ?? [];
}

/**
 * Build the ordered `InsertPlan`. Pure: no DB, no filesystem, no mutation of
 * `parsed`. See the module header for the golden rule and ordering guarantees.
 */
export function planMigration(
  parsed: ParsedMigration,
  opts: ImportOptions,
  existing: ExistingTargetData = {},
): InsertPlan {
  const isAppend = opts.mode === 'append';
  const target = isAppend
    ? (opts.targetFamilyId ?? (() => { throw new Error('planMigration: append mode requires targetFamilyId'); })())
    : randomUUID();

  const idMap = createIdMap();
  const report = emptyReport(opts.mode, opts.dedup);
  // Target ids that will exist after import: reused-existing ∪ emitted-this-plan.
  // Junctions/child media drop when a referenced id is not live.
  const liveTargetIds = new Set<string>();
  // Source ids of entities reused from the target (matched) — never re-inserted.
  const reusedSources = new Set<string>();

  // --- Stage A: reconcile entities + mint ids (spec 2a/2b) -----------------
  for (const ent of ENTITY_TABLES) {
    const imported = rowsOf(parsed, ent.key) as Keyed[];
    const keyOf = naturalKey[ent.kind];
    const existingRows = (existing as any)[ent.key] as Keyed[] | undefined;

    if (isAppend && existingRows && existingRows.length > 0) {
      const result = reconcileEntities(imported, existingRows, keyOf);
      for (const [sourceId, existingId] of result.reuse) {
        idMap.set(ent.table, sourceId, existingId);
        reusedSources.add(`${ent.table} ${sourceId}`);
        liveTargetIds.add(existingId);
      }
      for (const row of result.create) idMap.set(ent.table, row.id, randomUUID());
      report.entities[ent.reportKey] = { matched: result.matched, created: result.created };
    } else {
      for (const row of imported) idMap.set(ent.table, row.id, randomUUID());
      report.entities[ent.reportKey] = { matched: 0, created: imported.length };
    }
  }

  // --- Stage B: mint ids for every other id-bearing table ------------------
  for (const table of MIGRATION_TABLE_ORDER) {
    if (table === 'Unit') continue; // exempt: upserts by unitAbbr, never remapped
    const spec = TABLE_SPECS[table];
    if (!spec || !spec.idField) continue; // junctions have no own id
    if (ENTITY_TABLES.some((e) => e.table === table)) continue; // already minted
    for (const row of rowsOf(parsed, spec.key)) {
      idMap.set(table, row[spec.idField], randomUUID());
    }
  }

  // --- Stage C: remap, reconcile-skip, dedup, drop, and emit ---------------
  const batches = new Map<string, Record<string, any>[]>();
  const emit = (table: string, row: Record<string, any>) => {
    const list = batches.get(table) ?? [];
    list.push(row);
    batches.set(table, list);
  };
  // Working copy of existing dedup keys, extended as rows are accepted.
  const seenLogKeys = new Map<string, Set<string>>();
  const logKeySet = (table: string): Set<string> => {
    let s = seenLogKeys.get(table);
    if (!s) {
      s = new Set<string>(existing.logKeys?.[table] ?? []);
      seenLogKeys.set(table, s);
    }
    return s;
  };

  for (const table of MIGRATION_TABLE_ORDER) {
    if (table === 'Unit') {
      // Units are GLOBAL reference data keyed by a unique `unitAbbr`, always
      // pre-seeded on any target instance. Dedup against the existing global set
      // in BOTH modes — a new-family import into a populated instance would
      // otherwise collide on the unique unitAbbr and roll the whole import back.
      const already = existing.unitAbbrs ?? new Set<string>();
      for (const row of rowsOf(parsed, 'units')) {
        if (!already.has(row.unitAbbr)) emit('Unit', { ...row });
      }
      continue;
    }

    const spec = TABLE_SPECS[table];
    if (!spec) continue;
    const rows = rowsOf(parsed, spec.key);
    if (rows.length === 0) continue;

    // Settings belong to the family, not the merge: skip on append.
    if (table === 'Settings') {
      if (isAppend) continue;
      for (const row of rows) emit(table, finalizeRow(spec, row, idMap, target, liveTargetIds));
      continue;
    }

    const isEntity = ENTITY_TABLES.some((e) => e.table === table);
    const isJunction = !spec.idField;

    for (const row of rows) {
      // Reconciled entities are reused, never re-inserted.
      if (isEntity && reusedSources.has(`${table} ${row.id}`)) continue;

      // Junctions: drop when either side is missing or not live.
      if (isJunction) {
        if (!junctionSidesLive(spec, row, idMap, liveTargetIds)) {
          report.dropped.junctionsWithMissingSide += 1;
          continue;
        }
        emit(table, remapRow(spec, row, idMap, target));
        continue;
      }

      // PhotoFavorite owned by an account (not a caretaker) has no owner here.
      if (table === 'PhotoFavorite' && row.accountId != null) {
        report.dropped.photoFavoritesWithAccountOwner += 1;
        continue;
      }

      // VaccineDocument is orphaned when its VaccineLog was deduped away.
      if (table === 'VaccineDocument') {
        const parentLive = liveTargetIds.has(idMap.resolve('VaccineLog', row.vaccineLogId));
        if (!parentLive) continue;
      }

      const remapped = remapRow(spec, row, idMap, target);

      // Log dedup (append + dedup:true only).
      if (isDedupTable(table)) {
        const reportKey = LOG_REPORT_KEYS[table];
        if (isAppend && opts.dedup) {
          const keys = logKeySet(table);
          const key = dedupKey(table, remapped)!;
          if (keys.has(key)) {
            report.logs[reportKey].skippedDuplicate += 1;
            continue;
          }
          keys.add(key);
        }
        report.logs[reportKey].inserted += 1;
      }

      liveTargetIds.add(remapped[spec.idField!]);
      emit(table, remapped);
    }
  }

  const orderedBatches: InsertBatch[] = MIGRATION_TABLE_ORDER
    .filter((t) => batches.has(t))
    .map((t) => ({ table: t, rows: batches.get(t)! }));

  return { targetFamilyId: target, mode: opts.mode, dedup: opts.dedup, idMap, batches: orderedBatches, report };
}

/** Remap a row and record its target id as live. */
function finalizeRow(
  spec: (typeof TABLE_SPECS)[string],
  row: Record<string, any>,
  idMap: IdMap,
  target: string,
  liveTargetIds: Set<string>,
): Record<string, any> {
  const remapped = remapRow(spec, row, idMap, target);
  if (spec.idField) liveTargetIds.add(remapped[spec.idField]);
  return remapped;
}

/** True when both FK sides of a junction row resolve to a live target id. */
function junctionSidesLive(
  spec: (typeof TABLE_SPECS)[string],
  row: Record<string, any>,
  idMap: IdMap,
  liveTargetIds: Set<string>,
): boolean {
  for (const [col, refTable] of Object.entries(spec.fks)) {
    const sourceId = row[col];
    if (sourceId == null || !idMap.has(refTable, sourceId)) return false;
    if (!liveTargetIds.has(idMap.resolve(refTable, sourceId))) return false;
  }
  return true;
}
