import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import {
  PRISMA7_DATETIME_FORMAT_SQL,
  listDatetimeColumns,
  convertIntegerDatetimes,
  summarizeDatetimeConversion,
} from '../scripts/convert-sqlite-datetimes-core';

// Prisma 6's engine stored SQLite DateTime values as INTEGER unix-ms; Prisma 7's
// better-sqlite3 adapter stores and binds them as ISO TEXT. SQLite orders every
// integer below every string, so a range filter or orderBy on a date silently
// drops every pre-upgrade row. The conversion rewrites integers into the exact
// text the adapter writes so the two compare correctly.

// Captured from a real Prisma 7 / @prisma/adapter-better-sqlite3 insert.
const ADAPTER_SAMPLE = { ms: 1785533990093, text: '2026-07-31T21:39:50.093+00:00' };

function fixture() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE "SleepLog" ("id" TEXT PRIMARY KEY, "startTime" DATETIME NOT NULL, "endTime" DATETIME, "duration" INTEGER, "notes" TEXT);
    CREATE TABLE "_prisma_migrations" ("id" TEXT PRIMARY KEY, "finished_at" DATETIME);
    INSERT INTO "SleepLog" VALUES ('old', ${ADAPTER_SAMPLE.ms}, NULL, 30, 'x');
    INSERT INTO "SleepLog" VALUES ('old0', 1785344880000, 1785344880000, 5, NULL);
    INSERT INTO "SleepLog" VALUES ('new', '2026-08-25T21:21:58.004+00:00', NULL, 1, NULL);
    INSERT INTO "_prisma_migrations" VALUES ('m', 1784739832353);
  `);
  return db;
}

describe('listDatetimeColumns', () => {
  it('finds DATETIME columns and skips _prisma_migrations by default', () => {
    expect(listDatetimeColumns(fixture())).toEqual([
      { table: 'SleepLog', column: 'startTime' },
      { table: 'SleepLog', column: 'endTime' },
    ]);
  });
  it('returns nothing for an empty database', () => {
    expect(listDatetimeColumns(new Database(':memory:'))).toEqual([]);
  });
});

describe('convertIntegerDatetimes', () => {
  it('rewrites integer values into the adapter text format, leaving text/null/other columns alone', () => {
    const db = fixture();
    const results = convertIntegerDatetimes(db);
    expect(results).toEqual([
      { table: 'SleepLog', column: 'startTime', converted: 2 },
      { table: 'SleepLog', column: 'endTime', converted: 1 },
    ]);
    const rows = db.prepare('SELECT id, startTime, endTime, duration, typeof(startTime) t FROM "SleepLog" ORDER BY id').all() as any[];
    expect(rows.find(r => r.id === 'old')).toMatchObject({ startTime: ADAPTER_SAMPLE.text, endTime: null, duration: 30, t: 'text' });
    expect(rows.find(r => r.id === 'old0')).toMatchObject({ startTime: '2026-07-29T17:08:00.000+00:00', endTime: '2026-07-29T17:08:00.000+00:00' });
    expect(rows.find(r => r.id === 'new')).toMatchObject({ startTime: '2026-08-25T21:21:58.004+00:00' });
    expect(db.prepare('SELECT typeof(finished_at) t FROM "_prisma_migrations"').get()).toEqual({ t: 'integer' });
  });
  it('makes pre-upgrade rows visible to a text range filter (the actual bug)', () => {
    const db = fixture();
    const count = () => (db.prepare(`SELECT count(*) c FROM "SleepLog" WHERE startTime >= ?`).get('1970-01-01T00:00:00.000+00:00') as any).c;
    expect(count()).toBe(1);
    convertIntegerDatetimes(db);
    expect(count()).toBe(3);
  });
  it('is idempotent', () => {
    const db = fixture();
    convertIntegerDatetimes(db);
    expect(convertIntegerDatetimes(db)).toEqual([
      { table: 'SleepLog', column: 'startTime', converted: 0 },
      { table: 'SleepLog', column: 'endTime', converted: 0 },
    ]);
  });
  it('preserves millisecond precision at the boundaries', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE "T" ("v" DATETIME); INSERT INTO "T" VALUES (0), (999), (1785533990999);`);
    convertIntegerDatetimes(db);
    expect(db.prepare('SELECT v FROM "T"').all().map((r: any) => r.v)).toEqual([
      '1970-01-01T00:00:00.000+00:00', '1970-01-01T00:00:00.999+00:00', '2026-07-31T21:39:50.999+00:00',
    ]);
  });
  it('exposes the format expression so it can be reused in raw SQL', () => {
    expect(PRISMA7_DATETIME_FORMAT_SQL('x')).toContain('strftime');
  });
});

describe('summarizeDatetimeConversion', () => {
  it('reports nothing to do', () => {
    expect(summarizeDatetimeConversion([{ table: 'A', column: 'b', converted: 0 }])).toBe('SQLite datetime conversion: no legacy integer values found');
  });
  it('reports totals and touched columns', () => {
    expect(summarizeDatetimeConversion([
      { table: 'A', column: 'b', converted: 2 }, { table: 'A', column: 'c', converted: 0 }, { table: 'D', column: 'e', converted: 1 },
    ])).toBe('SQLite datetime conversion: converted 3 legacy integer values in A.b, D.e');
  });
});
