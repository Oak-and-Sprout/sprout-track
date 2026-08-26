import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Regression guard for the Prisma 6 -> 7 upgrade (same family as issue #266).
 *
 * Prisma 7's `prisma db push` removed the `--skip-generate` flag. The database
 * migration routes used during backup restore / setup shell out to `db push`
 * for PostgreSQL; passing the dropped flag makes the command exit non-zero with
 * `! unknown or unexpected option: --skip-generate`, so a restore reports
 * "Failed to push database schema. Database may be incompatible." even though
 * the backup and DB are fine. These routes generate the client explicitly in an
 * earlier step, so no flag is needed to suppress a second generate.
 */
const ROUTE_FILES = [
  'app/api/database/migrate-initial/route.ts',
  'app/api/database/migrate/route.ts',
];

describe('database migration routes use Prisma 7 compatible db push flags', () => {
  for (const rel of ROUTE_FILES) {
    const source = readFileSync(path.join(process.cwd(), rel), 'utf-8');

    it(`${rel} does not pass the removed --skip-generate flag to db push`, () => {
      expect(source).not.toContain('--skip-generate');
    });

    it(`${rel} still runs prisma db push for PostgreSQL`, () => {
      expect(source).toContain('prisma db push --accept-data-loss');
    });
  }
});
