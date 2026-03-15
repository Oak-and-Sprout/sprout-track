# Database Migration Guide: SQLite to PostgreSQL

This guide provides step-by-step instructions for migrating from SQLite (development) to PostgreSQL (production) with minimal code disruption.

## Overview

The baby tracker application uses Prisma ORM, which makes database provider switching relatively straightforward. The key changes are:

1. **Environment configuration** - Database URL and provider
2. **Schema configuration** - Make provider environment-driven
3. **Migration generation** - Create PostgreSQL-compatible migrations
4. **Data migration** (if needed) - Transfer existing data

## Prerequisites

- Existing SQLite database with data
- PostgreSQL server running
- Database credentials and connection access
- Backup of existing SQLite database

## Step 1: Update Prisma Schema

Modify `prisma/schema.prisma` to use environment variables:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

// Change from hardcoded sqlite to environment variable
datasource db {
  provider = env("DATABASE_PROVIDER")  // Was: "sqlite"
  url      = env("DATABASE_URL")
}

// Rest of schema remains the same...
```

## Step 2: Environment Configuration

### Development Environment (.env.local)
```bash
# Keep SQLite for local development
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:../db/baby-tracker.db"
```

### Production Environment (.env.production)
```bash
# Use PostgreSQL for production
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://username:password@host:5432/database_name"
DATABASE_CONNECTION_LIMIT=10
DATABASE_POOL_TIMEOUT=20
```

## Step 3: PostgreSQL Database Setup

### Option A: Manual Setup
```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE baby_tracker_prod;
CREATE USER baby_tracker_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE baby_tracker_prod TO baby_tracker_user;

-- For newer PostgreSQL versions, also grant schema permissions
\c baby_tracker_prod;
GRANT ALL ON SCHEMA public TO baby_tracker_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO baby_tracker_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO baby_tracker_user;
```

### Option B: Docker Setup
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: baby_tracker_prod
      POSTGRES_USER: baby_tracker_user
      POSTGRES_PASSWORD: secure_password_here
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  postgres_data:
```

## Step 4: Migration Strategy

### Option A: Fresh Migration (Recommended for Production)

If you're deploying fresh without existing data:

```bash
# 1. Set environment to PostgreSQL
export DATABASE_PROVIDER=postgresql
export DATABASE_URL="postgresql://baby_tracker_user:secure_password@localhost:5432/baby_tracker_prod"

# 2. Generate fresh migrations for PostgreSQL
rm -rf prisma/migrations/*  # Backup first!
npx prisma migrate dev --name init

# 3. Run seed if needed
npx prisma db seed
```

### Option B: Data Migration (If you have existing data)

If you need to preserve existing SQLite data:

```bash
# 1. Export existing data
npx prisma db pull --schema=prisma/schema.sqlite.prisma

# 2. Generate a data export script
node scripts/export-sqlite-data.js > data-export.json

# 3. Set up PostgreSQL with fresh schema
export DATABASE_PROVIDER=postgresql
export DATABASE_URL="postgresql://baby_tracker_user:secure_password@localhost:5432/baby_tracker_prod"
npx prisma migrate dev --name init

# 4. Import the data
node scripts/import-data-to-postgres.js data-export.json
```

## Step 5: Code Changes Required

### Good News: Minimal Changes Needed!

The existing API routes and database client code require **NO CHANGES** because:

```typescript
// app/api/caretaker/route.ts - No changes needed!
import prisma from '../db';  // This works with both SQLite and PostgreSQL

// prisma/db.ts - No changes needed!
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
```

### Optional: Enhanced Configuration

You can optionally enhance the database client for production:

```typescript
// prisma/db.ts - Enhanced version
import { PrismaClient, Prisma } from '@prisma/client';

const logLevels: Prisma.LogLevel[] = 
  process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'];

const prisma = new PrismaClient({
  log: logLevels.map(level => ({
    emit: 'stdout',
    level,
  })),
  // PostgreSQL-specific optimizations
  ...(process.env.DATABASE_PROVIDER === 'postgresql' && {
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  }),
});

export default prisma;
```

## Step 6: Deployment Verification

### 1. Health Check
```bash
# Test database connection
npx prisma db status

# Verify migrations are applied
npx prisma migrate status
```

### 2. Functional Testing
```bash
# Test basic operations
curl -X GET http://localhost:3000/api/caretaker
curl -X POST http://localhost:3000/api/baby -d '{"firstName":"Test","lastName":"Baby","birthDate":"2024-01-01T00:00:00Z"}'
```

### 3. Performance Monitoring
Monitor query performance and connection pooling:

```bash
# PostgreSQL connection monitoring
SELECT state, count(*) FROM pg_stat_activity GROUP BY state;

# Slow query monitoring
SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
```

## Step 7: Environment-Specific Deployment

### Development
```bash
# Use SQLite for fast local development
DATABASE_PROVIDER=sqlite
DATABASE_URL="file:../db/baby-tracker.db"
```

### Staging
```bash
# Use PostgreSQL that mirrors production
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://user:pass@staging-db:5432/baby_tracker_staging"
```

### Production
```bash
# Production PostgreSQL with connection pooling
DATABASE_PROVIDER=postgresql
DATABASE_URL="postgresql://user:pass@prod-db:5432/baby_tracker_prod"
DATABASE_CONNECTION_LIMIT=20
DATABASE_POOL_TIMEOUT=30
```

## Rollback Strategy

If you need to rollback to SQLite:

```bash
# 1. Export PostgreSQL data
pg_dump baby_tracker_prod > backup.sql

# 2. Change environment back to SQLite
export DATABASE_PROVIDER=sqlite
export DATABASE_URL="file:../db/baby-tracker.db"

# 3. Reset and re-migrate
npx prisma migrate reset
npx prisma db seed

# 4. Import critical data manually if needed
```

## Common Issues & Solutions

### 1. Migration Conflicts
```bash
# If migrations conflict between SQLite and PostgreSQL
npx prisma migrate resolve --applied "20240101000000_conflicting_migration"
```

### 2. Connection Pool Exhaustion
```typescript
// Add connection pool monitoring
const client = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Use connection pooling in production
process.env.DATABASE_CONNECTION_LIMIT = "10";
```

### 3. Schema Differences
Some SQLite features don't translate directly to PostgreSQL:
- `DATETIME` becomes `TIMESTAMP`
- `TEXT` remains `TEXT` 
- Auto-increment behavior may differ

Prisma handles most of these automatically during migration generation.

## Performance Considerations

### PostgreSQL Advantages in Production:
- **Concurrent access**: Multiple users can read/write simultaneously
- **Connection pooling**: Better resource management
- **Advanced indexing**: Better query performance
- **ACID compliance**: Better data integrity
- **Backup/restore**: Production-grade backup solutions

### Recommended PostgreSQL Configuration:
```sql
-- postgresql.conf optimizations for baby tracker workload
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

This migration approach ensures you can switch between SQLite (development) and PostgreSQL (production) with minimal code changes while maintaining full functionality. 