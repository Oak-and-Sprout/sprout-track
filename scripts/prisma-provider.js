#!/usr/bin/env node

/**
 * Prisma Provider Configuration Script
 *
 * Prisma requires a literal string for the datasource provider (not env()).
 * This script modifies schema.prisma and log-schema.prisma in-place to set
 * the correct provider based on the DATABASE_PROVIDER env var. Connection
 * URLs live in prisma.config.ts / prisma/log.config.ts (Prisma 7).
 *
 * Usage:
 *   DATABASE_PROVIDER=postgresql node scripts/prisma-provider.js
 *
 * Supported providers: sqlite (default), postgresql
 */

const fs = require('fs');
const path = require('path');

const provider = (process.env.DATABASE_PROVIDER || 'sqlite').toLowerCase();

if (!['sqlite', 'postgresql'].includes(provider)) {
  console.error(`Error: Unsupported DATABASE_PROVIDER "${provider}". Must be "sqlite" or "postgresql".`);
  process.exit(1);
}

console.log(`Configuring Prisma schemas for provider: ${provider}`);

/**
 * Update a Prisma schema file's datasource block to use the specified provider.
 */
function updateSchema(schemaPath) {
  if (!fs.existsSync(schemaPath)) {
    console.warn(`Warning: Schema file not found: ${schemaPath}`);
    return;
  }

  let content = fs.readFileSync(schemaPath, 'utf-8');

  if (provider === 'postgresql') {
    content = content.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
  } else {
    content = content.replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"');
  }

  fs.writeFileSync(schemaPath, content, 'utf-8');
  console.log(`  Updated: ${path.basename(schemaPath)}`);
}

const prismaDir = path.join(__dirname, '..', 'prisma');

// Update main schema
updateSchema(path.join(prismaDir, 'schema.prisma'));

// Update log schema
updateSchema(path.join(prismaDir, 'log-schema.prisma'));

console.log('Prisma schema configuration complete.');
