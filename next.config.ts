import type { NextConfig } from 'next';

/**
 * Keep the Prisma client and its driver adapters out of the Next/Turbopack
 * server bundle so they are `require`d from `node_modules` at runtime.
 *
 * Why this matters (issue #266): Prisma requires a *literal* datasource
 * `provider` in schema.prisma, so the provider ("sqlite" | "postgresql") is
 * frozen into the generated client at `prisma generate` time — it cannot come
 * from an env var. The Docker image runs `prisma generate` at build time with
 * the default sqlite provider, then `next build`. Without this config,
 * Turbopack inlines that sqlite-generated client into `.next/server/chunks`.
 *
 * At container startup `docker-startup.sh` rewrites the schema to the runtime
 * DATABASE_PROVIDER and re-runs `prisma generate`, which correctly updates
 * `node_modules/.prisma/client` to postgresql — but a bundled copy would be
 * ignored, so a PostgreSQL deployment loaded the stale sqlite client and threw
 * `PrismaClientInitializationError: The Driver Adapter @prisma/adapter-pg ...
 * is not compatible with the provider sqlite specified in the Prisma schema.`
 *
 * Marking these packages external makes the runtime-regenerated client the one
 * that actually loads, so a single image serves both sqlite and postgresql.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: [
    // The main client is imported as `@prisma/client`; the log client is
    // generated to a custom output and imported directly as `.prisma/log-client`
    // (see prisma/log-db.ts). BOTH must be external or Turbopack inlines the
    // generated client — including its build-time `activeProvider` — into the
    // server bundle, defeating the runtime `prisma generate` in docker-startup.sh.
    // Turbopack matches these by import specifier, not the generated package's
    // hashed name, so list the specifiers exactly as imported.
    '@prisma/client',
    '.prisma/client',
    '.prisma/log-client',
    '@prisma/adapter-pg',
    '@prisma/adapter-better-sqlite3',
    'better-sqlite3',
  ],
};

export default nextConfig;
