import { describe, it, expect } from 'vitest';
import {
  serializeTable,
  parseTable,
  MIGRATION_TABLE_COLUMNS,
  type MigrationColumn,
} from '@/src/utils/migration-csv';
import type { MigrationTableKey } from '@/src/types/family-migration';

/**
 * Build a synthetic value for a column based on its declared type. Used to
 * generate a fully-populated fixture row for every in-scope table so the
 * round-trip is exercised across each table's exact column set.
 */
function sampleValue(col: MigrationColumn): unknown {
  switch (col.type) {
    case 'date':
      return new Date('2026-08-28T13:45:12.000Z');
    case 'boolean':
      return true;
    case 'int':
      return 7;
    case 'float':
      return 1.5;
    case 'json':
      return '{"a":1,"b":[2,3],"note":"has \\"quote\\" and, comma"}';
    case 'string':
    default:
      return `${col.name}-value`;
  }
}

function fullRow(columns: readonly MigrationColumn[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of columns) row[c.name] = sampleValue(c);
  return row;
}

function nullRow(columns: readonly MigrationColumn[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of columns) row[c.name] = null;
  return row;
}

const ALL_KEYS = Object.keys(MIGRATION_TABLE_COLUMNS) as MigrationTableKey[];

describe('migration-csv registry', () => {
  it('defines a column set for every in-scope table', () => {
    expect(ALL_KEYS.length).toBeGreaterThan(30);
    for (const key of ALL_KEYS) {
      const cols = MIGRATION_TABLE_COLUMNS[key];
      expect(Array.isArray(cols)).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
    }
  });

  it('coerces JSON-text columns as verbatim strings, never parsed', () => {
    const settingsCols = MIGRATION_TABLE_COLUMNS.settings;
    const activity = settingsCols.find((c) => c.name === 'activitySettings');
    expect(activity?.type).toBe('json');
    expect(MIGRATION_TABLE_COLUMNS.babies.find((c) => c.name === 'feedTimerTypes')?.type).toBe('json');
    expect(MIGRATION_TABLE_COLUMNS.foodLogs.find((c) => c.name === 'foods')?.type).toBe('json');
    expect(MIGRATION_TABLE_COLUMNS.calendarEvents.find((c) => c.name === 'customRecurrence')?.type).toBe('json');
  });
});

describe('serializeTable / parseTable round-trip (per table)', () => {
  for (const key of ALL_KEYS) {
    const cols = MIGRATION_TABLE_COLUMNS[key];

    it(`${key}: fully-populated row round-trips`, () => {
      const rows = [fullRow(cols)];
      const csv = serializeTable(rows, cols);
      const parsed = parseTable(csv, cols);
      expect(parsed).toEqual(rows);
    });

    it(`${key}: all-null row round-trips (empty cells become null)`, () => {
      const rows = [nullRow(cols)];
      const csv = serializeTable(rows, cols);
      const parsed = parseTable(csv, cols);
      expect(parsed).toEqual(rows);
    });

    it(`${key}: empty table serializes to a header-only CSV and parses to []`, () => {
      const csv = serializeTable([], cols);
      expect(csv.length).toBeGreaterThan(0); // header present
      expect(parseTable(csv, cols)).toEqual([]);
    });
  }
});

describe('CSV edge cases', () => {
  const cols = MIGRATION_TABLE_COLUMNS.feedLogs;

  it('handles embedded quotes, commas, and newlines in string cells', () => {
    const row: Record<string, unknown> = nullRow(cols);
    row.id = 'feed-1';
    row.time = new Date('2026-08-28T13:45:12.000Z');
    row.type = 'BREAST';
    row.babyId = 'baby-1';
    row.notes = 'line one\nline two, with "quotes" and, commas';
    row.food = 'a,b,"c"\r\nd';

    const csv = serializeTable([row], cols);
    const parsed = parseTable(csv, cols);
    expect(parsed).toEqual([row]);
  });

  it('preserves ISO dates as Date objects through round-trip', () => {
    const row: Record<string, unknown> = nullRow(cols);
    row.time = new Date('2020-01-01T00:00:00.000Z');
    row.startTime = new Date('2020-01-01T00:00:30.500Z');
    const csv = serializeTable([row], cols);
    const parsed = parseTable(csv, cols);
    expect(parsed[0].time).toBeInstanceOf(Date);
    expect((parsed[0].time as Date).toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect((parsed[0].startTime as Date).toISOString()).toBe('2020-01-01T00:00:30.500Z');
  });

  it('round-trips booleans as real booleans', () => {
    const row: Record<string, unknown> = nullRow(cols);
    row.hadReaction = false;
    const csv = serializeTable([row], cols);
    const parsed = parseTable(csv, cols);
    expect(parsed[0].hadReaction).toBe(false);
  });

  it('round-trips numeric int and float columns', () => {
    const row: Record<string, unknown> = nullRow(cols);
    row.feedDuration = 0; // int, boundary
    row.amount = 4; // float stored as whole number
    row.breastMilkAmount = 2.25;
    const csv = serializeTable([row], cols);
    const parsed = parseTable(csv, cols);
    expect(parsed[0].feedDuration).toBe(0);
    expect(parsed[0].amount).toBe(4);
    expect(parsed[0].breastMilkAmount).toBe(2.25);
  });

  it('passes JSON-text columns through verbatim (not re-parsed)', () => {
    const settingsCols = MIGRATION_TABLE_COLUMNS.settings;
    const row: Record<string, unknown> = nullRow(settingsCols);
    row.id = 'settings-1';
    row.activitySettings = '{"order":["feed","sleep"],"hidden":[]}';
    const csv = serializeTable([row], settingsCols);
    const parsed = parseTable(csv, settingsCols);
    expect(parsed[0].activitySettings).toBe('{"order":["feed","sleep"],"hidden":[]}');
    expect(typeof parsed[0].activitySettings).toBe('string');
  });

  it('serializes only registry columns, ignoring extraneous fields', () => {
    const row: Record<string, unknown> = nullRow(cols);
    row.id = 'feed-1';
    (row as any).somethingExtra = 'should not survive';
    const csv = serializeTable([row], cols);
    expect(csv).not.toContain('somethingExtra');
    const parsed = parseTable(csv, cols);
    expect('somethingExtra' in parsed[0]).toBe(false);
  });

  it('carries familyId through serialization (ignored on import, but present in the file)', () => {
    const caretakerCols = MIGRATION_TABLE_COLUMNS.caretakers;
    expect(caretakerCols.some((c) => c.name === 'familyId')).toBe(true);
    const row: Record<string, unknown> = nullRow(caretakerCols);
    row.id = 'ct-1';
    row.familyId = 'source-family-123';
    const csv = serializeTable([row], caretakerCols);
    const parsed = parseTable(csv, caretakerCols);
    expect(parsed[0].familyId).toBe('source-family-123');
  });
});
