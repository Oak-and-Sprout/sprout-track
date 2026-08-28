/**
 * Styles for the shared MigrationImport component.
 *
 * Light-mode Tailwind utilities live here; dark-mode overrides live in
 * `migration-import.css` under `html.dark` selectors keyed by the custom class
 * names below (never Tailwind `dark:` — see CLAUDE.md styling rules).
 */

export const migrationImportStyles = {
  container: 'space-y-5 migration-import',

  // Preview summary card
  card: 'rounded-lg border border-gray-200 p-4 space-y-3 migration-import-card',
  cardTitle: 'text-sm font-semibold text-gray-900 migration-import-card-title',
  meta: 'text-xs text-gray-500 migration-import-meta',

  // Count grid
  countGrid: 'grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3',
  countRow: 'flex items-center justify-between text-sm migration-import-count-row',
  countLabel: 'text-gray-600 migration-import-count-label',
  countValue: 'font-medium text-gray-900 tabular-nums migration-import-count-value',
  totalRow: 'flex items-center justify-between text-sm font-semibold pt-2 border-t border-gray-100 migration-import-total-row',

  // Section labels
  sectionLabel: 'text-sm font-semibold text-gray-900 migration-import-section-label',

  // Mode selector
  modeGroup: 'flex flex-col gap-2',
  modeOption: 'flex items-start gap-2 rounded-md border border-gray-200 p-3 cursor-pointer migration-import-mode-option',
  modeOptionActive: 'border-teal-500 bg-teal-50 migration-import-mode-option-active',
  modeOptionTitle: 'text-sm font-medium text-gray-900 migration-import-mode-title',
  modeOptionDesc: 'text-xs text-gray-500 migration-import-mode-desc',

  // Append warning + dedup toggle
  warning: 'flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 migration-import-warning',
  toggleRow: 'flex items-center justify-between gap-4 rounded-md border border-gray-200 p-3 migration-import-toggle-row',
  toggleText: 'flex-1',
  toggleTitle: 'text-sm font-medium text-gray-900 migration-import-toggle-title',
  toggleDesc: 'text-xs text-gray-500 migration-import-toggle-desc',

  // Report
  reportHeader: 'flex items-center gap-2 text-sm font-semibold text-gray-900 migration-import-report-header',
  reportTable: 'w-full text-sm migration-import-report-table',
  reportRow: 'flex items-center justify-between py-1 border-b border-gray-100 migration-import-report-row',
  reportRowLabel: 'text-gray-600 migration-import-report-label',
  reportRowValue: 'font-medium text-gray-900 tabular-nums migration-import-report-value',
  reportSubtle: 'text-xs text-gray-500 migration-import-report-subtle',
  warnings: 'rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1 migration-import-warnings',
  warningItem: 'text-xs text-amber-800 migration-import-warning-item',

  // Confirm button
  confirmButton: 'w-full',
} as const;
