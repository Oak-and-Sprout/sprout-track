import { PrismaClient, Prisma } from '@prisma/client';

// Canonical Prisma singleton for the app. Uses a shared global key so that
// prisma/db.ts (used by seed.ts which can't resolve @/ aliases) and this
// file always resolve to the same PrismaClient instance.

const GLOBAL_KEY = '__sprout_prisma';

const logLevels: Prisma.LogLevel[] = ['warn', 'error'];

let prisma: PrismaClient;

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

/**
 * Reconnects the Prisma singleton after a database restore.
 * Ensures the in-process client uses the current DATABASE_URL and
 * opens a fresh connection to the restored database.
 */
export async function reconnectPrisma() {
  try {
    await prisma.$disconnect();
  } catch (e) {
    // ignore disconnect errors
  }
  await prisma.$connect();
  console.log('✓ Prisma client reconnected');
}

// Handle graceful shutdown
const handleShutdown = async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Error disconnecting from database:', error);
  }
};

// Remove any existing listeners to prevent duplicates
process.removeAllListeners('beforeExit');
process.removeAllListeners('SIGTERM');
process.removeAllListeners('SIGINT');

// Add single listeners for each event
process.once('beforeExit', handleShutdown);
process.once('SIGTERM', handleShutdown);
process.once('SIGINT', handleShutdown);

export default prisma;
