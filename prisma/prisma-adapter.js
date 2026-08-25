/**
 * Prisma 7 driver-adapter factory shared by the app, the seed, the log client
 * and the maintenance scripts (plain CommonJS so `node scripts/*.js` can use it).
 *
 * Prisma 7 removed the `datasources`/`datasourceUrl` client options and the
 * `url` field in schema.prisma; the connection is now a driver adapter chosen
 * here from the URL scheme. Prisma 6 also resolved relative `file:` URLs
 * against the schema directory (prisma/) — the driver adapter would resolve
 * them against the cwd instead, so resolveDatabaseUrl keeps the old behavior.
 */
const path = require('path');

// Prisma 6 loaded .env itself; Prisma 7 does not. Harmless where Next already did.
require('dotenv').config({ quiet: true });

const SCHEMA_DIR = __dirname;
const DEFAULT_DATABASE_URL = 'file:../db/baby-tracker.db';

/**
 * @param {string | undefined} url
 * @param {string} fallback used when url is missing or blank
 * @param {string} [schemaDir] directory relative file: urls resolve against
 * @returns {string}
 */
function resolveDatabaseUrl(url, fallback, schemaDir = SCHEMA_DIR) {
  const value = url && url.trim() ? url.trim() : fallback;
  if (!value.startsWith('file:')) return value;
  const target = value.slice('file:'.length).replace(/\?.*$/, '');
  if (target === ':memory:' || target.startsWith('/')) return `file:${target}`;
  return `file:${path.resolve(schemaDir, target)}`;
}

/**
 * @param {string | undefined} url
 * @param {string} [fallback]
 * @returns {import('@prisma/adapter-pg').PrismaPg | import('@prisma/adapter-better-sqlite3').PrismaBetterSqlite3}
 */
function createPrismaAdapter(url, fallback = DEFAULT_DATABASE_URL) {
  const resolved = resolveDatabaseUrl(url, fallback);
  if (resolved.startsWith('postgresql://') || resolved.startsWith('postgres://')) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    return new PrismaPg({ connectionString: resolved });
  }
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
  return new PrismaBetterSqlite3({ url: resolved });
}

module.exports = { resolveDatabaseUrl, createPrismaAdapter, DEFAULT_DATABASE_URL };
