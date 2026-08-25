#!/usr/bin/env node

/**
 * Convert legacy Prisma 6 integer DateTimes to Prisma 7 text (startup CLI wrapper)
 *
 * Runs scripts/convert-sqlite-datetimes-core.js against the main and log SQLite
 * databases. Safe to run on every startup/deploy after migrations — idempotent,
 * transactional per database, never crashes startup. Postgres URLs and missing
 * database files are skipped. The post-restore migration routes
 * (/api/database/migrate*) run it too, since a restored backup can reintroduce
 * integer values.
 *
 * Usage:
 *   node scripts/convert-sqlite-datetimes.js
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { resolveDatabaseUrl, DEFAULT_DATABASE_URL } = require('../prisma/prisma-adapter');
const { convertIntegerDatetimes, summarizeDatetimeConversion } = require('./convert-sqlite-datetimes-core');

// Manually load environment variables from .env file (same approach as
// scripts/convert-solids-feeds.js) so DATABASE_URL/LOG_DATABASE_URL apply.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key.trim()]) {
        process.env[key.trim()] = valueParts.join('=').replace(/^["']|["']$/g, '');
      }
    }
  }
}

const TARGETS = [
  { label: 'main', url: resolveDatabaseUrl(process.env.DATABASE_URL, DEFAULT_DATABASE_URL) },
  { label: 'log', url: resolveDatabaseUrl(process.env.LOG_DATABASE_URL, 'file:../db/api-logs.db') },
];

for (const { label, url } of TARGETS) {
  if (!url.startsWith('file:')) {
    console.log(`[${label}] not SQLite, skipping datetime conversion`);
    continue;
  }
  const file = url.slice('file:'.length);
  if (file === ':memory:' || !fs.existsSync(file)) {
    console.log(`[${label}] no database file at ${file}, skipping datetime conversion`);
    continue;
  }
  let db;
  try {
    db = new Database(file);
    console.log(`[${label}] ${summarizeDatetimeConversion(convertIntegerDatetimes(db))}`);
  } catch (error) {
    // Never crash startup: log and continue
    console.error(`[${label}] SQLite datetime conversion failed:`, error.message);
  } finally {
    if (db) db.close();
  }
}
