/**
 * Family Migration — Shared Types (Format Contract)
 *
 * The TypeScript contract every account-export-import feature imports: the manifest
 * shape, the parsed-migration shape, the id-map, the insert plan, and the report.
 *
 * This module is pure types + constants. It has no DB, React, or CSV dependencies.
 * See `documentation/temp-development-docs/account-export-import/01-migration-format.md`
 * (format) and `03-import-engine.md` (report) for the authoritative spec.
 */

import type {
  Baby,
  BabyAllergen,
  BabyEvent,
  BathLog,
  BreastMilkAdjustment,
  CalendarEvent,
  Caretaker,
  CaretakerEvent,
  Contact,
  ContactEvent,
  ContactMedicine,
  ContactVaccine,
  DiaperLog,
  FamilyMember,
  FeedLog,
  Food,
  FoodLog,
  Measurement,
  Medicine,
  MedicineLog,
  Milestone,
  MoodLog,
  Note,
  Photo,
  PhotoFavorite,
  PhotoLink,
  PhotoLog,
  PlayLog,
  PumpLog,
  Settings,
  SleepLog,
  Unit,
  VaccineDocument,
  VaccineLog,
} from '@prisma/client';

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

/** Interchange schema version. Bump when the on-disk format changes; import validates. */
export const MIGRATION_SCHEMA_VERSION = 1 as const;

/** Discriminator that identifies a Sprout Track family-migration archive. */
export const MIGRATION_KIND = 'family-migration' as const;

/** Application identifier stamped into every manifest. */
export const MIGRATION_APP = 'sprout-track' as const;

/** Source database provider — informational only, never used to gate import. */
export type SourceProvider = 'postgresql' | 'sqlite';

/** Row counts per exported table (keys are camelCase table names, e.g. `feedLogs`). */
export type MigrationCounts = Record<string, number>;

/** Deployment feature flags captured at export time (mirrors `AppConfig`). */
export interface MigrationFeatures {
  photos: boolean;
}

/** Minimal provenance describing the source family. */
export interface MigrationFamilyRef {
  slug: string;
  name: string;
}

/**
 * `manifest.json` — schema version, provenance, counts, and flags. Import rejects a
 * manifest whose `kind` is not `family-migration` or whose `schemaVersion` is
 * unknown/newer than the target supports (no partial import).
 */
export interface MigrationManifest {
  schemaVersion: number;
  app: string;
  kind: typeof MIGRATION_KIND;
  exportedAt: string;
  sourceProvider: SourceProvider;
  family: MigrationFamilyRef;
  features: MigrationFeatures;
  counts: MigrationCounts;
  files: string[];
}

// ---------------------------------------------------------------------------
// Parsed migration (reverse of export coercion; no DB access)
// ---------------------------------------------------------------------------

/**
 * Decrypted raw media bytes for a single photo, keyed elsewhere by source photo id.
 * `thumb` is absent when a photo has no stored thumbnail.
 */
export interface MediaBytes {
  display: Uint8Array;
  thumb?: Uint8Array;
}

/**
 * Typed row arrays for every included table, using the Prisma model types. Rows carry
 * their *source* ids and FK columns; the import engine remaps them (see `IdMap`).
 * Dates are `Date`, booleans are `boolean`, and empty CSV cells are `null` — the parse
 * step reverses the export coercion.
 */
export interface MigrationTables {
  caretakers: Caretaker[];
  babies: Baby[];
  settings: Settings[];
  contacts: Contact[];
  familyMembers: FamilyMember[];
  medicines: Medicine[];
  foods: Food[];
  units: Unit[];
  sleepLogs: SleepLog[];
  feedLogs: FeedLog[];
  diaperLogs: DiaperLog[];
  moodLogs: MoodLog[];
  notes: Note[];
  milestones: Milestone[];
  pumpLogs: PumpLog[];
  breastMilkAdjustments: BreastMilkAdjustment[];
  playLogs: PlayLog[];
  bathLogs: BathLog[];
  measurements: Measurement[];
  medicineLogs: MedicineLog[];
  foodLogs: FoodLog[];
  vaccineLogs: VaccineLog[];
  babyAllergens: BabyAllergen[];
  calendarEvents: CalendarEvent[];
  babyEvents: BabyEvent[];
  caretakerEvents: CaretakerEvent[];
  contactEvents: ContactEvent[];
  contactMedicines: ContactMedicine[];
  contactVaccines: ContactVaccine[];
  photos: Photo[];
  photoLogs: PhotoLog[];
  photoLinks: PhotoLink[];
  photoFavorites: PhotoFavorite[];
  vaccineDocuments: VaccineDocument[];
}

/** Union of the table keys carried by a parsed migration. */
export type MigrationTableKey = keyof MigrationTables;

/**
 * The full parsed archive: the validated manifest, every table's typed rows, and the
 * decrypted media bytes addressable by source record id. No DB access has occurred.
 */
export interface ParsedMigration {
  manifest: MigrationManifest;
  tables: MigrationTables;
  /** Decrypted photo bytes keyed by source `Photo.id`. */
  photoBytes: Map<string, MediaBytes>;
  /** Decrypted document bytes keyed by source `VaccineDocument.id`. */
  vaccineDocBytes: Map<string, Uint8Array>;
}

// ---------------------------------------------------------------------------
// ID remapping
// ---------------------------------------------------------------------------

/**
 * Resolves a source id to its freshly-minted (or reconciled) target id. Every FK column
 * is rewritten through this at plan time. Throws when the pair is unknown.
 */
export type IdResolver = (table: string, sourceId: string) => string;

/**
 * Bidirectional-lookup map from `(table, sourceId)` to the target id used on import.
 * Source ids are join keys only; target ids match each model's `@default` id generator.
 */
export interface IdMap {
  get(table: string, sourceId: string): string | undefined;
  set(table: string, sourceId: string, targetId: string): void;
  has(table: string, sourceId: string): boolean;
  /** Like `get`, but throws when the pair is unknown. */
  resolve: IdResolver;
}

// ---------------------------------------------------------------------------
// Import options
// ---------------------------------------------------------------------------

/**
 * `new-family` creates a fresh family (empty target — everything is new).
 * `append` merges into an existing target family (reconciliation + optional dedup).
 */
export type ImportMode = 'new-family' | 'append';

export interface ImportOptions {
  mode: ImportMode;
  /** Required when `mode === 'append'`. */
  targetFamilyId?: string;
  /** Required when `mode === 'new-family'`. */
  newFamily?: { name: string; slug: string };
  /** Append only; ignored for new-family. When true, logs matching a natural key are skipped. */
  dedup: boolean;
}

// ---------------------------------------------------------------------------
// Insert plan
// ---------------------------------------------------------------------------

/**
 * One ordered batch of rows to insert for a single table. Rows already have their ids
 * and FK columns remapped and `familyId` set to the resolved target family id.
 */
export interface InsertBatch {
  /** Table name as used in `TABLE_IMPORT_ORDER` (PascalCase, e.g. `FeedLog`). */
  table: string;
  rows: unknown[];
}

/**
 * The output of the pure planning stage: an ordered list of insert batches plus the
 * id-map used to produce them and a provisional report of reconciliation/dedup decisions.
 * `applyMigration` executes this against the DB and finalizes the report.
 */
export interface InsertPlan {
  targetFamilyId: string;
  mode: ImportMode;
  dedup: boolean;
  idMap: IdMap;
  /** Ordered by `TABLE_IMPORT_ORDER` so parents insert before children. */
  batches: InsertBatch[];
  report: MigrationReport;
}

// ---------------------------------------------------------------------------
// Report (mirrors the report block in spec 03)
// ---------------------------------------------------------------------------

/** Top-level entity reconciliation outcome (append mode reuses matches). */
export interface EntityReconcileCount {
  matched: number;
  created: number;
}

/** Per-log-table insert/skip outcome. */
export interface LogDedupCount {
  inserted: number;
  skippedDuplicate: number;
}

/** Per-media-kind migration outcome. */
export interface MediaMigrateCount {
  migrated: number;
  skippedOverQuota: number;
  skippedDecryptError: number;
}

/** Structured result rendered by the import UI. */
export interface MigrationReport {
  mode: ImportMode;
  dedup: boolean;
  entities: {
    babies: EntityReconcileCount;
    caretakers: EntityReconcileCount;
    contacts: EntityReconcileCount;
    medicines: EntityReconcileCount;
    foods: EntityReconcileCount;
  };
  logs: {
    feedLogs: LogDedupCount;
    sleepLogs: LogDedupCount;
    diaperLogs: LogDedupCount;
    moodLogs: LogDedupCount;
    notes: LogDedupCount;
    milestones: LogDedupCount;
    pumpLogs: LogDedupCount;
    breastMilkAdjustments: LogDedupCount;
    playLogs: LogDedupCount;
    bathLogs: LogDedupCount;
    measurements: LogDedupCount;
    medicineLogs: LogDedupCount;
    foodLogs: LogDedupCount;
    vaccineLogs: LogDedupCount;
  };
  media: {
    photos: MediaMigrateCount;
    vaccineDocs: MediaMigrateCount;
  };
  dropped: {
    photoFavoritesWithAccountOwner: number;
    junctionsWithMissingSide: number;
  };
  warnings: string[];
}
