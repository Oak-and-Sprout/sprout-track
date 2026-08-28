/**
 * Family-migration display helpers (pure, no React/DB).
 *
 * Shapes a `MigrationPreview`'s counts and a `MigrationReport`'s nested tallies
 * into flat, render-ready rows for the shared `MigrationImport` component. Label
 * strings are English keys — the component passes each through `t()` for i18n, so
 * every label returned here must exist in `en.json`.
 *
 * Kept as pure functions so the display logic is unit-testable without a renderer
 * (see `tests/migration-display.test.ts`).
 */

import type { MigrationReport } from '@/src/types/family-migration';

/** Human labels (English, = translation keys) for every migration table key. */
const TABLE_LABELS: Record<string, string> = {
  caretakers: 'Caretakers',
  babies: 'Babies',
  settings: 'Settings',
  contacts: 'Contacts',
  familyMembers: 'Family Members',
  medicines: 'Medicines',
  foods: 'Foods',
  units: 'Units',
  sleepLogs: 'Sleep',
  feedLogs: 'Feeds',
  diaperLogs: 'Diapers',
  moodLogs: 'Moods',
  notes: 'Notes',
  milestones: 'Milestones',
  pumpLogs: 'Pumping',
  breastMilkAdjustments: 'Breast Milk Adjustments',
  playLogs: 'Play',
  bathLogs: 'Baths',
  measurements: 'Measurements',
  medicineLogs: 'Medicine Logs',
  foodLogs: 'Food Logs',
  vaccineLogs: 'Vaccine Logs',
  babyAllergens: 'Allergens',
  calendarEvents: 'Calendar Events',
  babyEvents: 'Baby Events',
  caretakerEvents: 'Caretaker Events',
  contactEvents: 'Contact Events',
  contactMedicines: 'Contact Medicines',
  contactVaccines: 'Contact Vaccines',
  photos: 'Photos',
  photoLogs: 'Photo Logs',
  photoLinks: 'Photo Links',
  photoFavorites: 'Photo Favorites',
  vaccineDocuments: 'Vaccine Documents',
};

/** Convert an unknown camelCase key to a spaced, capitalized fallback label. */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Look up a display label for a table/entity key, humanizing unknown keys. */
export function labelForKey(key: string): string {
  return TABLE_LABELS[key] ?? humanizeKey(key);
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

/**
 * Preview count rows for display: non-zero entries only, ordered by descending
 * count then label. Non-numeric or negative values are treated as zero (skipped).
 */
export function previewCountRows(counts: Record<string, number>): CountRow[] {
  return Object.entries(counts ?? {})
    .map(([key, raw]) => ({
      key,
      label: labelForKey(key),
      count: typeof raw === 'number' && raw > 0 ? raw : 0,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Sum of all non-negative numeric counts in a preview. */
export function totalPreviewCount(counts: Record<string, number>): number {
  return Object.values(counts ?? {}).reduce(
    (sum, raw) => sum + (typeof raw === 'number' && raw > 0 ? raw : 0),
    0,
  );
}

export interface EntityRow {
  key: string;
  label: string;
  matched: number;
  created: number;
}

/** Flatten `report.entities` into ordered rows (fixed entity order). */
export function entityRows(report: MigrationReport): EntityRow[] {
  const order: (keyof MigrationReport['entities'])[] = [
    'babies',
    'caretakers',
    'contacts',
    'medicines',
    'foods',
  ];
  return order.map((key) => ({
    key,
    label: labelForKey(key),
    matched: report.entities[key]?.matched ?? 0,
    created: report.entities[key]?.created ?? 0,
  }));
}

export interface LogRow {
  key: string;
  label: string;
  inserted: number;
  skippedDuplicate: number;
}

/** Flatten `report.logs` into rows, omitting log tables with no activity. */
export function logRows(report: MigrationReport): LogRow[] {
  return Object.entries(report.logs ?? {})
    .map(([key, value]) => ({
      key,
      label: labelForKey(key),
      inserted: value?.inserted ?? 0,
      skippedDuplicate: value?.skippedDuplicate ?? 0,
    }))
    .filter((row) => row.inserted > 0 || row.skippedDuplicate > 0)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Totals across all log tables. */
export function logTotals(report: MigrationReport): { inserted: number; skippedDuplicate: number } {
  return Object.values(report.logs ?? {}).reduce(
    (acc, value) => ({
      inserted: acc.inserted + (value?.inserted ?? 0),
      skippedDuplicate: acc.skippedDuplicate + (value?.skippedDuplicate ?? 0),
    }),
    { inserted: 0, skippedDuplicate: 0 },
  );
}

export interface MediaRow {
  key: string;
  label: string;
  migrated: number;
  skippedOverQuota: number;
  skippedDecryptError: number;
}

/** Flatten `report.media` into rows (photos + vaccine docs), skipping empty kinds. */
export function mediaRows(report: MigrationReport): MediaRow[] {
  const order: (keyof MigrationReport['media'])[] = ['photos', 'vaccineDocs'];
  const labels: Record<string, string> = { photos: 'Photos', vaccineDocs: 'Vaccine Documents' };
  return order
    .map((key) => {
      const value = report.media[key];
      return {
        key,
        label: labels[key] ?? labelForKey(key),
        migrated: value?.migrated ?? 0,
        skippedOverQuota: value?.skippedOverQuota ?? 0,
        skippedDecryptError: value?.skippedDecryptError ?? 0,
      };
    })
    .filter((row) => row.migrated > 0 || row.skippedOverQuota > 0 || row.skippedDecryptError > 0);
}

export interface DroppedRow {
  key: string;
  label: string;
  count: number;
}

/** Non-zero `report.dropped` entries as labeled rows. */
export function droppedRows(report: MigrationReport): DroppedRow[] {
  const labels: Record<string, string> = {
    photoFavoritesWithAccountOwner: 'Photo favorites tied to an account owner',
    junctionsWithMissingSide: 'Links with a missing related record',
  };
  return Object.entries(report.dropped ?? {})
    .map(([key, raw]) => ({
      key,
      label: labels[key] ?? humanizeKey(key),
      count: typeof raw === 'number' && raw > 0 ? raw : 0,
    }))
    .filter((row) => row.count > 0);
}

/** True when a report carries any warnings or dropped rows worth surfacing. */
export function hasIssues(report: MigrationReport): boolean {
  return (report.warnings?.length ?? 0) > 0 || droppedRows(report).length > 0;
}
