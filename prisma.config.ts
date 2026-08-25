import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl, DEFAULT_DATABASE_URL } from './prisma/prisma-adapter';

/**
 * Prisma CLI config for the main application schema (Prisma 7 moved the
 * datasource URL out of schema.prisma). The log schema has its own config at
 * prisma/log.config.ts — pass `--config prisma/log.config.ts` for it.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: resolveDatabaseUrl(process.env.DATABASE_URL, DEFAULT_DATABASE_URL),
  },
});
