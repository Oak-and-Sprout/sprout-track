import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';

/**
 * Regression guard for issue #266.
 *
 * The single Docker image generates the Prisma client for sqlite at build time,
 * then rewrites the provider and regenerates at container startup. That runtime
 * regeneration only takes effect if the Prisma client is loaded from
 * node_modules at runtime instead of being inlined into the Next/Turbopack
 * server bundle. `serverExternalPackages` is what keeps it external — dropping
 * these entries silently reintroduces the sqlite-vs-postgresql mismatch.
 */
describe('next.config serverExternalPackages (issue #266)', () => {
  const external = nextConfig.serverExternalPackages ?? [];

  it('keeps the Prisma client external so the runtime-regenerated client loads', () => {
    expect(external).toContain('@prisma/client');
    expect(external).toContain('.prisma/client');
  });

  it('keeps the separately-generated log client external', () => {
    // prisma/log-db.ts imports `.prisma/log-client` (custom generator output).
    // Missing this entry leaves the log client bundled with a stale provider,
    // so every API route that logs a request throws PrismaClientInitializationError.
    expect(external).toContain('.prisma/log-client');
  });

  it('keeps both driver adapters external', () => {
    expect(external).toContain('@prisma/adapter-pg');
    expect(external).toContain('@prisma/adapter-better-sqlite3');
  });
});
