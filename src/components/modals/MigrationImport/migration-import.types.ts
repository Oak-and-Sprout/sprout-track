import type React from 'react';
import type {
  MigrationFamilyRef,
  MigrationFeatures,
  MigrationCounts,
  SourceProvider,
  ImportMode,
  MigrationReport,
} from '@/src/types/family-migration';

/**
 * Client-safe mirror of the server's `MigrationPreview` (from
 * `app/api/utils/family-migration-import.ts`). Redeclared here so the client
 * bundle never pulls in the server import engine.
 */
export interface MigrationPreview {
  family: MigrationFamilyRef;
  counts: MigrationCounts;
  features: MigrationFeatures;
  exportedAt: string;
  sourceProvider: SourceProvider;
}

export type { ImportMode, MigrationReport };

export interface MigrationImportProps {
  /** Parsed manifest preview (step 1 result). Null until a file has been previewed. */
  manifestPreview: MigrationPreview | null;
  /** Selected import mode. */
  mode: ImportMode;
  /** Called when the user picks a different mode (only when `allowModeSelect`). */
  onModeChange: (mode: ImportMode) => void;
  /** Append-only dedup toggle: true = skip duplicates by natural key (default). */
  dedup: boolean;
  /** Called when the dedup toggle changes. */
  onDedupChange: (dedup: boolean) => void;
  /** Called when the user confirms the import (step 2). */
  onConfirm: () => void;
  /** Final import report (step 2 result). Null until the import has run. */
  report: MigrationReport | null;

  // --- Optional presentational controls (wrappers configure these) ----------
  /** Show the new-family / append mode selector. Setup-wizard passes false. */
  allowModeSelect?: boolean;
  /** Import in progress — disables and relabels the confirm button. */
  confirming?: boolean;
  /** Wrapper-driven gate on the confirm button (e.g. missing target family/slug). */
  confirmDisabled?: boolean;
  /** Mode-specific fields injected by the wrapper (new-family name/slug or a family picker). */
  children?: React.ReactNode;
}
