# MigrationImport

Shared, presentational component that drives the **family-migration import** flow for
both entry points:

- **Sysadmin family-manager** import (`ImportFamilyModal`, per-family) — calls
  `POST /api/database/import-family`.
- **First-run setup wizard** import (`SetupImportPanel`) — always new-family, calls
  `POST /api/database/import-family-initial`.

It is deliberately "dumb": the wrapper owns file upload, network calls, and the
mode-specific fields (new-family name/slug inputs or the append family picker), which
are injected via `children`. This component only renders the shared UI and reports
user intent through callbacks.

## Flow it renders

1. **Manifest preview** — source family name/slug, export date, photo flag, per-table
   record counts + total (from the step-1 preview response).
2. **Mode select** (when `allowModeSelect`) — *Create a new family* vs *Append to an
   existing family*.
3. `children` — wrapper-injected fields for the chosen mode.
4. **Append warning + dedup toggle** (append mode only) — On = skip duplicates by
   natural key (default); Off = insert everything.
5. **Confirm** button.
6. **Report** — entity matched/created, per-log inserted/skipped with totals, media
   migrated/skipped, dropped rows, and warnings (from the step-2 confirm response).

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| `manifestPreview` | `MigrationPreview \| null` | Step-1 result; null hides the preview. |
| `mode` | `'new-family' \| 'append'` | Selected mode. |
| `onModeChange` | `(mode) => void` | Fired by the mode selector. |
| `dedup` | `boolean` | Append-only; true = skip duplicates (default). |
| `onDedupChange` | `(dedup) => void` | Fired by the toggle. |
| `onConfirm` | `() => void` | Runs the import (step 2). |
| `report` | `MigrationReport \| null` | Step-2 result; when set, only the report renders. |
| `allowModeSelect` | `boolean` (default `true`) | Setup wizard passes `false`. |
| `confirming` | `boolean` | Import in progress. |
| `confirmDisabled` | `boolean` | Wrapper gate (missing target family/slug, etc.). |
| `children` | `ReactNode` | Mode-specific fields. |

## Styling

Follows the project convention: light-mode Tailwind utilities in
`migration-import.styles.ts`; dark-mode overrides in `migration-import.css` under
`html.dark` selectors (never Tailwind `dark:`). All user-facing strings go through
`useLocalization().t()`.

## Display helpers

Row/label shaping lives in `src/utils/migration-display.ts` (pure, unit-tested in
`tests/migrationDisplay.test.ts`) so the component stays thin.
