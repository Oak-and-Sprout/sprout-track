import { describe, it, expect } from 'vitest';
import { classifyZipEntries } from '@/src/utils/import-file-detect';
import { MIGRATION_KIND } from '@/src/types/family-migration';

describe('classifyZipEntries', () => {
  it('classifies a family migration export by manifest kind', () => {
    const entries = ['manifest.json', 'FeedLog.csv', 'Baby.csv', 'media/'];
    expect(classifyZipEntries(entries, MIGRATION_KIND)).toBe('migration');
  });

  it('classifies a SQLite backup zip (baby-tracker.db)', () => {
    expect(classifyZipEntries(['baby-tracker.db', '2026-01-01.backup.env'])).toBe('backup');
  });

  it('classifies a Postgres backup zip (data.json)', () => {
    expect(classifyZipEntries(['data.json', '2026-01-01.backup.env'])).toBe('backup');
  });

  it('treats a manifest of the wrong kind as unknown, not a backup', () => {
    // A zip that carries a manifest.json but is not our migration format must not
    // fall through to the backup path — it is genuinely unrecognized.
    expect(classifyZipEntries(['manifest.json', 'baby-tracker.db'], 'something-else')).toBe('unknown');
    expect(classifyZipEntries(['manifest.json'], null)).toBe('unknown');
  });

  it('returns unknown for a zip with neither marker', () => {
    expect(classifyZipEntries(['readme.txt', 'photo.jpg'])).toBe('unknown');
    expect(classifyZipEntries([])).toBe('unknown');
  });

  it('ignores a leading ./ or / on entry names', () => {
    expect(classifyZipEntries(['./manifest.json', 'FeedLog.csv'], MIGRATION_KIND)).toBe('migration');
    expect(classifyZipEntries(['/baby-tracker.db'])).toBe('backup');
  });
});
