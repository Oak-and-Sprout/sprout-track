import { describe, it, expect } from 'vitest';
import type { ParsedMigration, ImportOptions } from '@/src/types/family-migration';
import { emptyMigrationTables } from '@/src/utils/migration-parse';
import { planMigration } from '@/src/utils/migration-plan';
import { applyMigration, type ApplyDeps, type ImportClient } from '@/app/api/utils/family-migration-import';

/**
 * Golden rule: `familyId` on every inserted row must be the *target* family the
 * importer chose — never the value carried in the archive. Here the parsed CSVs
 * are tampered to claim `familyId: 'EVIL-FAMILY'`; the import must ignore it.
 */

const EVIL = 'EVIL-FAMILY';

function makeFakeClient() {
  const inserts: Record<string, any[]> = {};
  const families: any[] = [];
  const modelDelegate = () => ({
    createMany: async ({ data }: { data: any[] }) => {
      const list = (inserts.__all ??= []);
      list.push(...data);
      return { count: data.length };
    },
    create: async ({ data }: { data: any }) => { (inserts.__all ??= []).push(data); return data; },
    update: async () => ({}),
    findMany: async () => [],
    findUnique: async ({ where }: { where: any }) => families.find((f) => f.id === where.id) ?? null,
  });
  const base: any = {
    $transaction: async <T,>(fn: (tx: any) => Promise<T>) => fn(proxy),
    __allInserts: inserts,
    __families: families,
  };
  const proxy: any = new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'family') {
        return { ...modelDelegate(), create: async ({ data }: { data: any }) => { families.push(data); return data; } };
      }
      return modelDelegate();
    },
  });
  return proxy as ImportClient & { __allInserts: Record<string, any[]>; __families: any[] };
}

function makeDeps(client: ImportClient): ApplyDeps {
  return {
    client,
    importPhoto: () => ({ storedName: 'n', thumbStoredName: '' }),
    importVaccineDoc: () => 'n',
    getRemainingPhotoBytes: async () => 1e12,
  };
}

function tamperedParsed(): ParsedMigration {
  return {
    manifest: { schemaVersion: 1, app: 'sprout-track', kind: 'family-migration', exportedAt: 'x', sourceProvider: 'sqlite', family: { slug: 's', name: 'n' }, features: { photos: false }, counts: {}, files: [] } as any,
    tables: {
      ...emptyMigrationTables(),
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara', familyId: EVIL }],
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01'), familyId: EVIL }],
      feedLogs: [{ id: 'f1', time: new Date('2024-03-01'), type: 'BOTTLE', amount: 4, babyId: 'b1', caretakerId: 'c1', familyId: EVIL }],
      settings: [{ id: 's1', familyName: 'Evil', photoQuotaMB: 100, familyId: EVIL }],
    } as any,
    photoBytes: new Map(),
    vaccineDocBytes: new Map(),
  };
}

function assertNoEvilFamily(rows: any[], target: string) {
  const withFamily = rows.filter((r) => 'familyId' in r && r.familyId != null);
  expect(withFamily.length).toBeGreaterThan(0);
  for (const row of withFamily) {
    expect(row.familyId).toBe(target);
    expect(row.familyId).not.toBe(EVIL);
  }
}

describe('golden rule — tampered familyId is ignored', () => {
  it('new-family: every inserted row and the created family use the target id', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const parsed = tamperedParsed();
    const opts: ImportOptions = { mode: 'new-family', newFamily: { name: 'Clean', slug: 'clean' }, dedup: false };
    const plan = planMigration(parsed, opts);

    await applyMigration(plan, parsed, opts, deps);

    const target = plan.targetFamilyId;
    expect(target).not.toBe(EVIL);
    expect(client.__families[0].id).toBe(target);
    assertNoEvilFamily(client.__allInserts.__all, target);
  });

  it('append: every inserted row uses the chosen existing target family', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const parsed = tamperedParsed();
    const opts: ImportOptions = { mode: 'append', targetFamilyId: 'real-target', dedup: false };
    const plan = planMigration(parsed, opts, {});

    await applyMigration(plan, parsed, opts, deps);

    expect(plan.targetFamilyId).toBe('real-target');
    assertNoEvilFamily(client.__allInserts.__all, 'real-target');
  });
});
