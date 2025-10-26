import { PrismaClient as LogPrismaClient } from '.prisma/log-client';

let logPrisma: LogPrismaClient;

if (process.env.NODE_ENV === 'production') {
  logPrisma = new LogPrismaClient({
    log: ['error'],
  });
} else {
  // In development, use global singleton to prevent multiple instances
  if (!(global as any).logPrisma) {
    (global as any).logPrisma = new LogPrismaClient({
      log: ['error'],
    });
  }
  logPrisma = (global as any).logPrisma;
}

// Handle graceful shutdown
const handleShutdown = async () => {
  try {
    await logPrisma.$disconnect();
  } catch (error) {
    console.error('Error disconnecting from log database:', error);
  }
};

// Add shutdown handlers
process.once('beforeExit', handleShutdown);
process.once('SIGTERM', handleShutdown);
process.once('SIGINT', handleShutdown);

export default logPrisma;
