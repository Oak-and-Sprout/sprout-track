/**
 * Legacy SQLite DateTime conversion (pure core, unit tested).
 *
 * Prisma 6's query engine stored SQLite DateTime values as INTEGER unix-ms.
 * Prisma 7's @prisma/adapter-better-sqlite3 stores AND binds them as ISO TEXT
 * ('2026-07-31T21:39:50.093+00:00'). SQLite orders every integer below every
 * string, so after the upgrade any range filter or orderBy on a date silently
 * excludes every pre-upgrade row while unfiltered reads still decode fine.
 *
 * convertIntegerDatetimes rewrites integer values in every DATETIME column into
 * the exact text the adapter writes. Idempotent (only touches typeof integer),
 * SQLite-only, and skips _prisma_migrations, which Prisma manages itself.
 */

const DEFAULT_EXCLUDED_TABLES = ['_prisma_migrations'];

/** SQL expression turning an integer unix-ms column into the adapter's text format. */
const PRISMA7_DATETIME_FORMAT_SQL = (column) =>
  `strftime('%Y-%m-%dT%H:%M:%f', ${column} / 1000.0, 'unixepoch') || '+00:00'`;

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ excludeTables?: string[] }} [opts]
 * @returns {{ table: string, column: string }[]}
 */
function listDatetimeColumns(db, opts = {}) {
  const excluded = new Set(opts.excludeTables ?? DEFAULT_EXCLUDED_TABLES);
  return db
    .prepare(
      `SELECT m.name AS "table", p.name AS "column"
       FROM sqlite_master m JOIN pragma_table_info(m.name) p
       WHERE m.type = 'table' AND upper(p.type) = 'DATETIME'
       ORDER BY m.name, p.cid`
    )
    .all()
    .filter((c) => !excluded.has(c.table));
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ excludeTables?: string[] }} [opts]
 * @returns {{ table: string, column: string, converted: number }[]}
 */
function convertIntegerDatetimes(db, opts = {}) {
  const run = db.transaction(() =>
    listDatetimeColumns(db, opts).map(({ table, column }) => ({
      table,
      column,
      converted: db
        .prepare(
          `UPDATE ${q(table)} SET ${q(column)} = ${PRISMA7_DATETIME_FORMAT_SQL(q(column))}
           WHERE typeof(${q(column)}) = 'integer'`
        )
        .run().changes,
    }))
  );
  return run();
}

/** @param {{ table: string, column: string, converted: number }[]} results */
function summarizeDatetimeConversion(results) {
  const touched = results.filter((r) => r.converted > 0);
  const total = touched.reduce((n, r) => n + r.converted, 0);
  if (total === 0) return 'SQLite datetime conversion: no legacy integer values found';
  return `SQLite datetime conversion: converted ${total} legacy integer values in ${touched.map((r) => `${r.table}.${r.column}`).join(', ')}`;
}

module.exports = {
  DEFAULT_EXCLUDED_TABLES,
  PRISMA7_DATETIME_FORMAT_SQL,
  listDatetimeColumns,
  convertIntegerDatetimes,
  summarizeDatetimeConversion,
};
