import { describe, it, expect } from 'vitest';
import { resolveDatabaseUrl, createPrismaAdapter } from '@/prisma/prisma-adapter';

const schemaDir = '/srv/app/prisma';

describe('resolveDatabaseUrl', () => {
  it('resolves a relative file: url against the schema directory (Prisma 6 behavior)', () => {
    expect(resolveDatabaseUrl('file:../db/baby-tracker.db', 'file:x', schemaDir)).toBe('file:/srv/app/db/baby-tracker.db');
    expect(resolveDatabaseUrl('file:./dev.db', 'file:x', schemaDir)).toBe('file:/srv/app/prisma/dev.db');
  });
  it('leaves absolute file: urls alone', () => {
    expect(resolveDatabaseUrl('file:/db/baby-tracker.db', 'file:x', schemaDir)).toBe('file:/db/baby-tracker.db');
  });
  it('strips a sqlite query string the driver adapter cannot parse', () => {
    expect(resolveDatabaseUrl('file:/db/a.db?connection_limit=1', 'file:x', schemaDir)).toBe('file:/db/a.db');
  });
  it('passes postgres urls through untouched', () => {
    const pg = 'postgresql://u:p@host:5432/db?schema=public';
    expect(resolveDatabaseUrl(pg, 'file:x', schemaDir)).toBe(pg);
  });
  it('falls back when the url is missing or blank', () => {
    expect(resolveDatabaseUrl(undefined, 'file:../db/a.db', schemaDir)).toBe('file:/srv/app/db/a.db');
    expect(resolveDatabaseUrl('   ', 'file:../db/a.db', schemaDir)).toBe('file:/srv/app/db/a.db');
  });
  it('keeps in-memory sqlite urls', () => {
    expect(resolveDatabaseUrl('file::memory:', 'file:x', schemaDir)).toBe('file::memory:');
  });
});

describe('createPrismaAdapter', () => {
  it('picks the better-sqlite3 adapter for file: urls', () => {
    const adapter = createPrismaAdapter('file::memory:', 'file:x');
    expect(adapter.provider).toBe('sqlite');
  });
  it('picks the pg adapter for postgres urls', () => {
    expect(createPrismaAdapter('postgresql://u:p@localhost:5432/db', 'file:x').provider).toBe('postgres');
    expect(createPrismaAdapter('postgres://u:p@localhost:5432/db', 'file:x').provider).toBe('postgres');
  });
  it('defaults to the repo sqlite database relative to prisma/', () => {
    const adapter = createPrismaAdapter(undefined, 'file:../db/baby-tracker.db');
    expect(adapter.provider).toBe('sqlite');
  });
});
