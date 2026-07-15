#!/usr/bin/env node

/**
 * Convert SOLIDS Feeds to Food Logs (startup CLI wrapper)
 *
 * One-way, self-healing migration of legacy SOLIDS FeedLog rows into the
 * food tracker (Food + FoodLog, issue #203). Safe to run on every
 * startup/deploy after `prisma migrate deploy` — idempotent, per-row
 * transactional, and never crashes startup on partial data.
 *
 * The conversion itself lives in scripts/convert-solids-feeds-runner.js so
 * the post-restore migration routes (/api/database/migrate*) can run it too;
 * pure decision logic is in scripts/convert-solids-feeds-core.js.
 *
 * Usage:
 *   node scripts/convert-solids-feeds.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { convertSolidsFeeds, summarizeConversion } = require('./convert-solids-feeds-runner');

// Manually load environment variables from .env file (same approach as
// scripts/reset-changelog-seen.js) so DATABASE_URL overrides the schema URL.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath) && !process.env.DATABASE_URL) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    }
  }
}

async function main() {
  const prisma = new PrismaClient(
    process.env.DATABASE_URL
      ? { datasources: { db: { url: process.env.DATABASE_URL } } }
      : undefined
  );

  try {
    const result = await convertSolidsFeeds(prisma);
    console.log(summarizeConversion(result));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  // Never crash startup: log and exit cleanly
  console.error('Solids conversion failed:', error.message);
  process.exit(0);
});
