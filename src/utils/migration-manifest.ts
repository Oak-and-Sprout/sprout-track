/**
 * Family Migration — Manifest builder + validator (pure).
 *
 * `buildManifest` stamps a fresh `manifest.json` payload at export time.
 * `validateManifest` guards import: it rejects a wrong `kind` and any
 * unknown/newer `schemaVersion` with a clear error, so a malformed or
 * forward-versioned archive never triggers a partial import.
 *
 * No DB, React, or CSV dependencies. See
 * `documentation/temp-development-docs/account-export-import/01-migration-format.md`.
 */

import {
  MIGRATION_APP,
  MIGRATION_KIND,
  MIGRATION_SCHEMA_VERSION,
  type MigrationCounts,
  type MigrationFamilyRef,
  type MigrationFeatures,
  type MigrationManifest,
  type SourceProvider,
} from '@/src/types/family-migration';

/** Inputs to `buildManifest`. `exportedAt` and `app` default when omitted. */
export interface BuildManifestInput {
  family: MigrationFamilyRef;
  sourceProvider: SourceProvider;
  features: MigrationFeatures;
  counts: MigrationCounts;
  files: string[];
  /** ISO-8601 timestamp; defaults to `new Date().toISOString()`. */
  exportedAt?: string;
  /** Application identifier; defaults to `sprout-track`. */
  app?: string;
}

/**
 * Build a manifest at export time. Always stamps the current
 * `MIGRATION_SCHEMA_VERSION` and `MIGRATION_KIND`.
 */
export function buildManifest(input: BuildManifestInput): MigrationManifest {
  return {
    schemaVersion: MIGRATION_SCHEMA_VERSION,
    app: input.app ?? MIGRATION_APP,
    kind: MIGRATION_KIND,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    sourceProvider: input.sourceProvider,
    family: { slug: input.family.slug, name: input.family.name },
    features: { photos: input.features.photos },
    counts: { ...input.counts },
    files: [...input.files],
  };
}

/** Discriminated result of `validateManifest`. */
export type ValidateManifestResult =
  | { ok: true; manifest: MigrationManifest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate an untrusted parsed `manifest.json`. Rejects (no partial import) when:
 * - the input is not an object;
 * - `kind` is not `family-migration`;
 * - `schemaVersion` is missing, non-numeric, or newer than the target supports;
 * - required provenance blocks are missing/mis-typed.
 */
export function validateManifest(raw: unknown): ValidateManifestResult {
  if (!isRecord(raw)) {
    return { ok: false, error: 'Invalid migration manifest: expected a JSON object.' };
  }

  if (raw.kind !== MIGRATION_KIND) {
    return {
      ok: false,
      error: `Invalid migration manifest: unexpected kind "${String(
        raw.kind,
      )}" (expected "${MIGRATION_KIND}").`,
    };
  }

  const version = raw.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return {
      ok: false,
      error: 'Invalid migration manifest: missing or non-numeric schemaVersion.',
    };
  }
  if (version > MIGRATION_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `Unsupported migration schemaVersion ${version}: this instance supports up to version ${MIGRATION_SCHEMA_VERSION}. Upgrade Sprout Track and try again.`,
    };
  }
  if (version < 1) {
    return {
      ok: false,
      error: `Unknown migration schemaVersion ${version}.`,
    };
  }

  if (!isRecord(raw.family) || typeof raw.family.slug !== 'string' || typeof raw.family.name !== 'string') {
    return { ok: false, error: 'Invalid migration manifest: missing family block.' };
  }

  if (raw.sourceProvider !== 'postgresql' && raw.sourceProvider !== 'sqlite') {
    return { ok: false, error: 'Invalid migration manifest: unknown sourceProvider.' };
  }

  if (!isRecord(raw.features) || typeof raw.features.photos !== 'boolean') {
    return { ok: false, error: 'Invalid migration manifest: missing features block.' };
  }

  if (!isRecord(raw.counts)) {
    return { ok: false, error: 'Invalid migration manifest: missing counts block.' };
  }

  if (!Array.isArray(raw.files) || !raw.files.every((f) => typeof f === 'string')) {
    return { ok: false, error: 'Invalid migration manifest: missing files list.' };
  }

  if (typeof raw.app !== 'string') {
    return { ok: false, error: 'Invalid migration manifest: missing app identifier.' };
  }

  if (typeof raw.exportedAt !== 'string') {
    return { ok: false, error: 'Invalid migration manifest: missing exportedAt timestamp.' };
  }

  return { ok: true, manifest: raw as unknown as MigrationManifest };
}
