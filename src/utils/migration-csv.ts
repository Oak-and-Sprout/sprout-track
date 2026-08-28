/**
 * Family Migration — CSV (De)serialization Core (pure)
 *
 * Serializes typed row arrays to CSV and parses CSV back to typed row arrays for
 * the family export/import feature. This is the shared seam consumed by the export
 * writer (F4) and the import parser (F2's `parseMigration`).
 *
 * Design notes:
 * - Rows keep their real `id` and FK columns (source ids); the import engine remaps
 *   them. `familyId` is carried in the file for completeness but ignored on import.
 * - Serialization reuses `objectArrayToCsv` (`app/api/utils/csv-export.ts`) — the same
 *   quoting/escaping used elsewhere — after coercing each cell to a CSV-safe scalar.
 * - Coercion is symmetric and column-typed:
 *     date    → ISO-8601 string  ⇄  `Date`
 *     boolean → "true"/"false"   ⇄  `boolean`
 *     int     → decimal string   ⇄  `number`
 *     float   → decimal string   ⇄  `number`
 *     json    → verbatim string  ⇄  string   (never re-parsed — the stored text is kept)
 *     string  → verbatim string  ⇄  string
 *   `null`/`undefined` serialize to an empty cell; an empty cell parses back to `null`.
 *
 * This module is pure: no DB, React, or filesystem access.
 * See `documentation/temp-development-docs/account-export-import/01-migration-format.md`.
 */

import { objectArrayToCsv } from '@/app/api/utils/csv-export';
import type { MigrationTableKey } from '@/src/types/family-migration';

// ---------------------------------------------------------------------------
// Column registry
// ---------------------------------------------------------------------------

/**
 * How a column's stored value maps to/from its CSV cell. `json` is behaviorally a
 * verbatim string (the stored JSON text is never parsed), kept as a distinct type so
 * the registry documents which columns hold JSON blobs.
 */
export type MigrationColumnType = 'string' | 'date' | 'boolean' | 'int' | 'float' | 'json';

/** A single column's name and coercion type. */
export interface MigrationColumn {
  name: string;
  type: MigrationColumnType;
}

/** Ordered, immutable column set for one table (matches exact schema column order). */
export type MigrationTableColumns = readonly MigrationColumn[];

// Compact column constructors keep the registry readable.
const s = (name: string): MigrationColumn => ({ name, type: 'string' });
const d = (name: string): MigrationColumn => ({ name, type: 'date' });
const b = (name: string): MigrationColumn => ({ name, type: 'boolean' });
const i = (name: string): MigrationColumn => ({ name, type: 'int' });
const f = (name: string): MigrationColumn => ({ name, type: 'float' });
const j = (name: string): MigrationColumn => ({ name, type: 'json' });

/**
 * Per-table column/coercer registry — the single source of truth for both export and
 * import. Keys are the camelCase table names from `MigrationTables`; each value lists
 * the scalar columns in schema order. Enum columns are plain strings. Relation
 * (non-scalar) fields are omitted; scalar FK columns are included as strings.
 */
export const MIGRATION_TABLE_COLUMNS: Record<MigrationTableKey, MigrationTableColumns> = {
  caretakers: [
    s('id'), s('loginId'), s('name'), s('type'), s('role'), b('inactive'), s('securityPin'),
    s('language'), s('badgeColor'), s('lastSeenVersion'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'), s('accountId'),
  ],
  babies: [
    s('id'), s('firstName'), s('lastName'), d('birthDate'), s('gender'), b('inactive'),
    s('feedWarningTime'), s('diaperWarningTime'), s('feedTimerFrom'), j('feedTimerTypes'),
    d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'),
  ],
  settings: [
    s('id'), s('familyName'), s('securityPin'), s('authType'), s('defaultBottleUnit'),
    s('defaultSolidsUnit'), s('defaultHeightUnit'), s('defaultWeightUnit'), s('defaultTempUnit'),
    j('activitySettings'), j('sleepLocationSettings'), j('bathTypeSettings'), j('nurseryModeSettings'),
    b('enableDebugTimer'), b('enableDebugTimezone'), b('enableBreastMilkTracking'),
    b('includeSolidsInFeedTimer'), i('photoQuotaMB'), s('dateFormat'), s('timeFormat'),
    s('growthChartStandard'), d('createdAt'), d('updatedAt'), s('familyId'),
  ],
  contacts: [
    s('id'), s('name'), s('role'), s('phone'), s('email'), s('address'), s('notes'),
    d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'),
  ],
  familyMembers: [
    s('familyId'), s('caretakerId'), s('role'), d('joinedAt'),
  ],
  medicines: [
    s('id'), s('name'), f('typicalDoseSize'), s('unitAbbr'), s('doseMinTime'), s('notes'),
    b('active'), b('isSupplement'), d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'),
  ],
  foods: [
    s('id'), s('name'), b('commonAllergen'), s('notes'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'),
  ],
  units: [
    s('id'), s('unitAbbr'), s('unitName'), s('activityTypes'), d('createdAt'), d('updatedAt'),
  ],
  sleepLogs: [
    s('id'), d('startTime'), d('endTime'), i('duration'), s('type'), s('location'), s('quality'),
    s('notes'), d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'),
    s('caretakerId'),
  ],
  feedLogs: [
    s('id'), d('time'), d('startTime'), d('endTime'), i('feedDuration'), i('pauseDuration'),
    s('type'), f('amount'), s('unitAbbr'), s('side'), s('food'), s('notes'), b('hadReaction'),
    s('reactionDescription'), s('reactionCause'), s('bottleType'), f('breastMilkAmount'),
    s('sessionId'), s('sourcePumpId'), d('createdAt'), d('updatedAt'), d('deletedAt'),
    s('familyId'), s('babyId'), s('caretakerId'),
  ],
  diaperLogs: [
    s('id'), d('time'), s('type'), s('condition'), s('color'), b('blowout'), b('creamApplied'),
    s('notes'), d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'),
    s('caretakerId'),
  ],
  moodLogs: [
    s('id'), d('time'), s('mood'), i('intensity'), i('duration'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  notes: [
    s('id'), d('time'), s('content'), s('category'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  milestones: [
    s('id'), d('date'), s('title'), s('description'), s('category'), i('ageInDays'), s('photo'),
    d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  pumpLogs: [
    s('id'), d('startTime'), d('endTime'), i('duration'), f('leftAmount'), f('rightAmount'),
    f('totalAmount'), s('unitAbbr'), s('pumpAction'), s('notes'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  breastMilkAdjustments: [
    s('id'), d('time'), f('amount'), s('unitAbbr'), s('reason'), s('notes'), d('createdAt'),
    d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  playLogs: [
    s('id'), d('startTime'), d('endTime'), i('duration'), s('type'), s('notes'), s('activities'),
    d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  bathLogs: [
    s('id'), d('time'), s('bathType'), b('soapUsed'), b('shampooUsed'), s('notes'),
    d('createdAt'), d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  measurements: [
    s('id'), d('date'), s('type'), f('value'), s('unit'), s('notes'), d('createdAt'),
    d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  medicineLogs: [
    s('id'), d('time'), f('doseAmount'), s('unitAbbr'), s('notes'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'), s('medicineId'), s('babyId'), s('caretakerId'),
  ],
  foodLogs: [
    s('id'), d('time'), f('amount'), s('unitAbbr'), s('enjoyment'), b('hadReaction'),
    s('reactionDescription'), s('notes'), s('feedLogId'), j('foods'), d('createdAt'),
    d('updatedAt'), d('deletedAt'), s('familyId'), s('foodId'), s('babyId'), s('caretakerId'),
  ],
  vaccineLogs: [
    s('id'), d('time'), s('vaccineName'), i('doseNumber'), s('notes'), d('createdAt'),
    d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  babyAllergens: [
    s('id'), s('name'), s('allergenType'), s('reactionDescription'), s('notes'), d('createdAt'),
    d('updatedAt'), d('deletedAt'), s('familyId'), s('babyId'), s('caretakerId'),
  ],
  calendarEvents: [
    s('id'), s('title'), s('description'), d('startTime'), d('endTime'), b('allDay'), s('type'),
    s('location'), s('color'), b('recurring'), s('recurrencePattern'), d('recurrenceEnd'),
    j('customRecurrence'), i('reminderTime'), b('notificationSent'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('familyId'),
  ],
  babyEvents: [
    s('babyId'), s('eventId'),
  ],
  caretakerEvents: [
    s('caretakerId'), s('eventId'),
  ],
  contactEvents: [
    s('contactId'), s('eventId'),
  ],
  contactMedicines: [
    s('contactId'), s('medicineId'),
  ],
  contactVaccines: [
    s('contactId'), s('vaccineLogId'),
  ],
  photos: [
    s('id'), s('originalName'), s('storedName'), s('thumbStoredName'), s('mimeType'),
    i('fileSize'), i('thumbSize'), d('takenAt'), s('caption'), d('createdAt'), d('updatedAt'),
    d('deletedAt'), s('babyId'), s('caretakerId'), s('milestoneId'), s('familyId'),
  ],
  photoLogs: [
    s('id'), d('time'), d('createdAt'), d('updatedAt'), d('deletedAt'), s('babyId'),
    s('caretakerId'), s('familyId'),
  ],
  photoLinks: [
    s('id'), s('photoId'), s('activityType'), s('activityId'), d('createdAt'),
  ],
  photoFavorites: [
    s('id'), s('photoId'), s('caretakerId'), s('accountId'), d('createdAt'),
  ],
  vaccineDocuments: [
    s('id'), s('originalName'), s('storedName'), s('mimeType'), i('fileSize'), d('createdAt'),
    d('updatedAt'), s('vaccineLogId'),
  ],
};

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/** Coerce one stored value to a CSV-safe scalar (string/number/boolean) or null. */
function toCell(value: unknown, type: MigrationColumnType): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (type === 'date') {
    return value instanceof Date ? value.toISOString() : String(value);
  }
  // boolean/int/float/string/json all stringify safely via objectArrayToCsv's String().
  return value as string | number | boolean;
}

/**
 * Serialize typed rows to a CSV string in the exact registry column order.
 * Empty input still emits a header-only CSV so the file is well-formed.
 */
export function serializeTable(
  rows: ReadonlyArray<Record<string, unknown>>,
  columns: MigrationTableColumns,
): string {
  const names = columns.map((c) => c.name);

  if (rows.length === 0) {
    // objectArrayToCsv returns '' for empty data, dropping the header — build it here.
    return names.map((v) => `"${v.replaceAll('"', '""')}"`).join(',');
  }

  const coerced = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      const cell = toCell(row[col.name], col.type);
      out[col.name] = cell === null ? null : cell;
    }
    return out;
  });

  return objectArrayToCsv(coerced, names);
}

// ---------------------------------------------------------------------------
// Parse
// ---------------------------------------------------------------------------

/**
 * Parse an RFC-4180-style CSV string (as produced by `objectArrayToCsv`) into rows of
 * string cells. Handles fully-quoted fields, doubled quotes, and embedded commas and
 * newlines. Row separators may be CRLF or LF.
 */
function parseCsvGrid(text: string): string[][] {
  if (text === '') return [];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let idx = 0;

  while (idx < text.length) {
    const ch = text[idx];

    if (inQuotes) {
      if (ch === '"') {
        if (text[idx + 1] === '"') {
          field += '"';
          idx += 2;
          continue;
        }
        inQuotes = false;
        idx += 1;
        continue;
      }
      field += ch;
      idx += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      idx += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      idx += 1;
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      idx += ch === '\r' && text[idx + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += ch;
    idx += 1;
  }

  // Flush the final field/row (no trailing newline is emitted by objectArrayToCsv).
  row.push(field);
  rows.push(row);
  return rows;
}

/** Reverse the export coercion for a single cell, per its column type. */
function fromCell(raw: string, type: MigrationColumnType): unknown {
  if (raw === '') return null; // empty cell → null
  switch (type) {
    case 'date':
      return new Date(raw);
    case 'boolean':
      return raw === 'true';
    case 'int':
    case 'float':
      return Number(raw);
    case 'json':
    case 'string':
    default:
      return raw; // verbatim string
  }
}

/**
 * Parse a CSV string back into typed rows using the same column registry that produced
 * it. Coercion is reversed: ISO→Date, "true"/"false"→boolean, numeric→number, ""→null;
 * JSON-text and string columns pass through verbatim. Header cells not present in the
 * registry are carried through as raw strings (defensive; not expected in-format).
 */
export function parseTable(
  csv: string,
  columns: MigrationTableColumns,
): Record<string, unknown>[] {
  const grid = parseCsvGrid(csv);
  if (grid.length === 0) return [];

  const header = grid[0];
  const typeByName = new Map(columns.map((c) => [c.name, c.type] as const));

  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < header.length; c++) {
      const name = header[c];
      const type = typeByName.get(name);
      const raw = cells[c] ?? '';
      obj[name] = type ? fromCell(raw, type) : (raw === '' ? null : raw);
    }
    rows.push(obj);
  }
  return rows;
}
