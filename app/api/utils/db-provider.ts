/**
 * Database provider detection utility.
 * Determines the active database provider based on the DATABASE_URL format.
 */

export type DatabaseProvider = 'sqlite' | 'postgresql';

export function getDatabaseProvider(): DatabaseProvider {
  const url = process.env.DATABASE_URL || '';
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    return 'postgresql';
  }
  return 'sqlite';
}

export function isSQLite(): boolean {
  return getDatabaseProvider() === 'sqlite';
}

export function isPostgreSQL(): boolean {
  return getDatabaseProvider() === 'postgresql';
}
