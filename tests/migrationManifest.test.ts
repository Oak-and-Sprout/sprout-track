import { describe, it, expect } from 'vitest';
import {
  buildManifest,
  validateManifest,
} from '@/src/utils/migration-manifest';
import {
  MIGRATION_KIND,
  MIGRATION_SCHEMA_VERSION,
  type MigrationManifest,
} from '@/src/types/family-migration';

function baseBuildInput() {
  return {
    family: { slug: 'smith-family', name: 'Smith Family' },
    sourceProvider: 'postgresql' as const,
    features: { photos: true },
    counts: { babies: 2, feedLogs: 1234, photos: 40 },
    files: ['caretakers.csv', 'babies.csv'],
    exportedAt: '2026-08-28T12:00:00.000Z',
  };
}

describe('buildManifest', () => {
  it('produces a manifest with the current kind and schema version', () => {
    const m = buildManifest(baseBuildInput());
    expect(m.kind).toBe(MIGRATION_KIND);
    expect(m.schemaVersion).toBe(MIGRATION_SCHEMA_VERSION);
    expect(m.app).toBe('sprout-track');
    expect(m.family).toEqual({ slug: 'smith-family', name: 'Smith Family' });
    expect(m.sourceProvider).toBe('postgresql');
    expect(m.features).toEqual({ photos: true });
    expect(m.counts.feedLogs).toBe(1234);
    expect(m.files).toContain('babies.csv');
    expect(m.exportedAt).toBe('2026-08-28T12:00:00.000Z');
  });

  it('defaults exportedAt to a valid ISO string when omitted', () => {
    const input = baseBuildInput();
    delete (input as any).exportedAt;
    const m = buildManifest(input);
    expect(typeof m.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(m.exportedAt))).toBe(false);
  });
});

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const m = buildManifest(baseBuildInput());
    const result = validateManifest(m as unknown);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest.kind).toBe(MIGRATION_KIND);
    }
  });

  it('round-trips buildManifest through validateManifest', () => {
    const built = buildManifest(baseBuildInput());
    const serialized = JSON.parse(JSON.stringify(built));
    const result = validateManifest(serialized);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.manifest).toEqual(built);
    }
  });

  it('rejects a manifest with the wrong kind', () => {
    const m = { ...buildManifest(baseBuildInput()), kind: 'something-else' };
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/kind/i);
    }
  });

  it('rejects a schemaVersion newer than supported', () => {
    const m = {
      ...buildManifest(baseBuildInput()),
      schemaVersion: MIGRATION_SCHEMA_VERSION + 1,
    };
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/version/i);
    }
  });

  it('rejects a missing schemaVersion', () => {
    const m: any = buildManifest(baseBuildInput());
    delete m.schemaVersion;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/version/i);
    }
  });

  it('rejects a non-numeric / unknown schemaVersion', () => {
    const m: any = { ...buildManifest(baseBuildInput()), schemaVersion: 'v1' };
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(validateManifest(null).ok).toBe(false);
    expect(validateManifest('not-a-manifest').ok).toBe(false);
    expect(validateManifest(42).ok).toBe(false);
  });

  it('rejects a manifest missing the family block', () => {
    const m: any = buildManifest(baseBuildInput());
    delete m.family;
    const result = validateManifest(m);
    expect(result.ok).toBe(false);
  });

  it('preserves the parsed manifest shape as MigrationManifest', () => {
    const result = validateManifest(buildManifest(baseBuildInput()));
    if (result.ok) {
      const manifest: MigrationManifest = result.manifest;
      expect(manifest.files.length).toBeGreaterThan(0);
    }
  });
});
