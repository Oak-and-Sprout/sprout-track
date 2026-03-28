import { PrismaClient, Prisma } from '@prisma/client';

// This file exists for prisma/seed.ts which runs under prisma/tsconfig.json
// (commonjs, no path aliases). It shares the same global singleton key as
// app/api/db.ts so both files resolve to one PrismaClient instance at runtime.

const GLOBAL_KEY = '__sprout_prisma';

const logLevels: Prisma.LogLevel[] = ['warn', 'error'];

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  if (!(global as any)[GLOBAL_KEY]) {
    (global as any)[GLOBAL_KEY] = new PrismaClient({
      log: logLevels.map(level => ({
        emit: 'stdout',
        level,
      })),
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = (global as any)[GLOBAL_KEY];
} else {
  if (!(global as any)[GLOBAL_KEY]) {
    (global as any)[GLOBAL_KEY] = new PrismaClient({
      log: logLevels.map(level => ({
        emit: 'stdout',
        level,
      })),
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  prisma = (global as any)[GLOBAL_KEY];
}

export default prisma;
