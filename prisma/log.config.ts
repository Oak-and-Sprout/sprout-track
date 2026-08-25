import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { resolveDatabaseUrl } from './prisma-adapter';

/** Prisma CLI config for the API log schema. Use: prisma <cmd> --config prisma/log.config.ts */
export default defineConfig({
  schema: 'log-schema.prisma',
  datasource: {
    url: resolveDatabaseUrl(process.env.LOG_DATABASE_URL, 'file:../db/api-logs.db'),
  },
});
