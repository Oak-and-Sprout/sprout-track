import { describe, it, expect, vi } from 'vitest';
import type { ParsedMigration, ImportOptions } from '@/src/types/family-migration';
import { emptyMigrationTables } from '@/src/utils/migration-parse';
import { planMigration } from '@/src/utils/migration-plan';
import {
  applyMigration,
  preloadExisting,
  type ApplyDeps,
  type ImportClient,
} from '@/app/api/utils/family-migration-import';

// --- Fake Prisma client (records writes; no DB) -----------------------------

interface FakeClient extends ImportClient {
  __inserts: Record<string, any[]>;
  __updates: Record<string, { where: any; data: any }[]>;
  __createManyCalls: { table: string; count: number }[];
  __families: any[];
  __findManyResults: Record<string, any[]>;
  __throwCreateManyFor?: Set<string>;
}

function makeFakeClient(findManyResults: Record<string, any[]> = {}): FakeClient {
  const inserts: Record<string, any[]> = {};
  const updates: Record<string, { where: any; data: any }[]> = {};
  const createManyCalls: { table: string; count: number }[] = [];
  const families: any[] = [];
  const throwFor = new Set<string>();

  const modelDelegate = (model: string) => ({
    createMany: async ({ data }: { data: any[] }) => {
      if (throwFor.has(model)) throw new Error(`createMany not supported for ${model}`);
      (inserts[model] ??= []).push(...data);
      createManyCalls.push({ table: model, count: data.length });
      return { count: data.length };
    },
    create: async ({ data }: { data: any }) => {
      (inserts[model] ??= []).push(data);
      return data;
    },
    update: async ({ where, data }: { where: any; data: any }) => {
      (updates[model] ??= []).push({ where, data });
      return data;
    },
    findMany: async () => findManyResults[model] ?? [],
    findUnique: async ({ where }: { where: any }) =>
      model === 'family' ? families.find((f) => f.id === where.id) ?? null : null,
  });

  const base: any = {
    $transaction: async <T,>(fn: (tx: any) => Promise<T>) => fn(proxy),
    __inserts: inserts,
    __updates: updates,
    __createManyCalls: createManyCalls,
    __families: families,
    __findManyResults: findManyResults,
    __throwCreateManyFor: throwFor,
  };

  const proxy: any = new Proxy(base, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'family') {
        return {
          ...modelDelegate('family'),
          create: async ({ data }: { data: any }) => {
            families.push(data);
            return data;
          },
        };
      }
      return modelDelegate(prop);
    },
  });

  return proxy as FakeClient;
}

function makeDeps(client: FakeClient, remaining = 1e12): ApplyDeps & {
  __photoCalls: any[];
  __docCalls: any[];
} {
  const photoCalls: any[] = [];
  const docCalls: any[] = [];
  return {
    client,
    importPhoto: (display: Uint8Array, thumb: Uint8Array | undefined, familyId: string) => {
      photoCalls.push({ display, thumb, familyId });
      return { storedName: 'NEW.enc', thumbStoredName: thumb ? 'NEW.thumb.enc' : '' };
    },
    importVaccineDoc: (bytes: Uint8Array) => {
      docCalls.push({ bytes });
      return 'NEWDOC.enc';
    },
    getRemainingPhotoBytes: async () => remaining,
    __photoCalls: photoCalls,
    __docCalls: docCalls,
  } as any;
}

function makeParsed(overrides: Partial<ParsedMigration['tables']>, media?: Partial<Pick<ParsedMigration, 'photoBytes' | 'vaccineDocBytes'>>): ParsedMigration {
  return {
    manifest: { schemaVersion: 1, app: 'sprout-track', kind: 'family-migration', exportedAt: 'x', sourceProvider: 'sqlite', family: { slug: 's', name: 'n' }, features: { photos: true }, counts: {}, files: [] } as any,
    tables: { ...emptyMigrationTables(), ...overrides } as ParsedMigration['tables'],
    photoBytes: media?.photoBytes ?? new Map(),
    vaccineDocBytes: media?.vaccineDocBytes ?? new Map(),
  };
}

const NEW_FAMILY_OPTS: ImportOptions = { mode: 'new-family', newFamily: { name: 'Imported', slug: 'imported-fam' }, dedup: false };

// --- new-family happy path --------------------------------------------------

describe('applyMigration — new-family', () => {
  function baseParsed() {
    return makeParsed({
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara' }] as any,
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      feedLogs: [
        { id: 'f1', time: new Date('2024-03-01'), type: 'BOTTLE', amount: 4, babyId: 'b1', caretakerId: 'c1', familyId: 'src-fam' },
      ] as any,
    });
  }

  it('creates the family, inserts rows, and finalizes the report', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const parsed = baseParsed();
    const plan = planMigration(parsed, NEW_FAMILY_OPTS);

    const report = await applyMigration(plan, parsed, NEW_FAMILY_OPTS, deps);

    // Family created with the plan's freshly-minted target id.
    expect(client.__families).toHaveLength(1);
    expect(client.__families[0].id).toBe(plan.targetFamilyId);
    expect(client.__families[0].slug).toBe('imported-fam');

    // Rows inserted for entities + logs.
    expect(client.__inserts.caretaker).toHaveLength(1);
    expect(client.__inserts.baby).toHaveLength(1);
    expect(client.__inserts.feedLog).toHaveLength(1);

    // Report reflects the plan.
    expect(report.entities.caretakers.created).toBe(1);
    expect(report.entities.babies.created).toBe(1);
    expect(report.logs.feedLogs.inserted).toBe(1);
  });

  it('drops units already present in the global set (both modes) so new-family does not collide', () => {
    // Units are global reference data — pre-seeded on every target. A new-family
    // import must still dedup them against the existing global unitAbbrs, or the
    // insert collides on the unique unitAbbr and rolls the whole import back.
    const parsed = makeParsed({
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara' }] as any,
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      units: [{ unitAbbr: 'OZ', unitName: 'Ounces' }, { unitAbbr: 'ML', unitName: 'Milliliters' }] as any,
    });
    const plan = planMigration(parsed, NEW_FAMILY_OPTS, { unitAbbrs: new Set(['OZ']) });
    const unitBatch = plan.batches.find((b) => b.table === 'Unit');
    expect((unitBatch?.rows ?? []).map((r: any) => r.unitAbbr)).toEqual(['ML']);
  });

  it('batches createMany at BATCH_SIZE=100', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const feedLogs = Array.from({ length: 150 }, (_, i) => ({
      id: `f${i}`, time: new Date('2024-03-01'), type: 'BOTTLE', amount: i, babyId: 'b1', caretakerId: 'c1',
    }));
    const parsed = makeParsed({
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara' }] as any,
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      feedLogs: feedLogs as any,
    });
    const plan = planMigration(parsed, NEW_FAMILY_OPTS);

    await applyMigration(plan, parsed, NEW_FAMILY_OPTS, deps);

    const feedBatches = client.__createManyCalls.filter((c) => c.table === 'feedLog');
    expect(feedBatches.map((c) => c.count)).toEqual([100, 50]);
    expect(client.__inserts.feedLog).toHaveLength(150);
  });

  it('re-encrypts photo + vaccine-doc bytes after the rows exist and reports migrated counts', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const photoBytes = new Map([['ph1', { display: new Uint8Array([1, 2]), thumb: new Uint8Array([3]) }]]);
    const vaccineDocBytes = new Map([['vd1', new Uint8Array([9])]]);
    const parsed = makeParsed({
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara' }] as any,
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      vaccineLogs: [{ id: 'vl1', time: new Date('2024-04-01'), vaccineName: 'DTaP', babyId: 'b1', caretakerId: 'c1' }] as any,
      vaccineDocuments: [{ id: 'vd1', originalName: 'card.pdf', storedName: 'SRC.enc', mimeType: 'application/pdf', fileSize: 1, vaccineLogId: 'vl1' }] as any,
      photos: [{ id: 'ph1', originalName: 'p.jpg', storedName: 'SRC.enc', thumbStoredName: 'SRC.t.enc', mimeType: 'image/jpeg', fileSize: 2, thumbSize: 1, takenAt: new Date('2024-02-01'), babyId: 'b1', caretakerId: 'c1' }] as any,
    }, { photoBytes, vaccineDocBytes });
    const plan = planMigration(parsed, NEW_FAMILY_OPTS);

    const report = await applyMigration(plan, parsed, NEW_FAMILY_OPTS, deps);

    // Media delegates invoked with the target family id.
    expect((deps as any).__photoCalls).toHaveLength(1);
    expect((deps as any).__photoCalls[0].familyId).toBe(plan.targetFamilyId);
    expect((deps as any).__docCalls).toHaveLength(1);

    // Photo + doc rows updated with fresh stored names.
    const photoTargetId = plan.idMap.get('Photo', 'ph1');
    expect(client.__updates.photo[0].where.id).toBe(photoTargetId);
    expect(client.__updates.photo[0].data.storedName).toBe('NEW.enc');
    const docTargetId = plan.idMap.get('VaccineDocument', 'vd1');
    expect(client.__updates.vaccineDocument[0].where.id).toBe(docTargetId);
    expect(client.__updates.vaccineDocument[0].data.storedName).toBe('NEWDOC.enc');

    expect(report.media.photos.migrated).toBe(1);
    expect(report.media.vaccineDocs.migrated).toBe(1);
  });

  it('reports a photo whose bytes are missing as skippedDecryptError', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const parsed = makeParsed({
      caretakers: [{ id: 'c1', loginId: '01', name: 'Cara' }] as any,
      babies: [{ id: 'b1', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      photos: [{ id: 'ph1', originalName: 'p.jpg', storedName: 'SRC.enc', thumbStoredName: '', mimeType: 'image/jpeg', fileSize: 2, thumbSize: 0, takenAt: new Date('2024-02-01'), babyId: 'b1', caretakerId: 'c1' }] as any,
    }); // no photoBytes
    const plan = planMigration(parsed, NEW_FAMILY_OPTS);
    const report = await applyMigration(plan, parsed, NEW_FAMILY_OPTS, deps);
    expect(report.media.photos.migrated).toBe(0);
    expect(report.media.photos.skippedDecryptError).toBe(1);
  });

  it('rolls back (throws) when an insert fails mid-transaction', async () => {
    const client = makeFakeClient();
    client.__throwCreateManyFor!.add('feedLog');
    const deps = makeDeps(client);
    const parsed = baseParsed();
    const plan = planMigration(parsed, NEW_FAMILY_OPTS);
    // new-family does not tolerate errors → createMany throw propagates.
    await expect(applyMigration(plan, parsed, NEW_FAMILY_OPTS, deps)).rejects.toThrow(/rolled back/i);
  });
});

// --- append path ------------------------------------------------------------

describe('applyMigration / preloadExisting — append', () => {
  it('preloadExisting shapes ExistingTargetData from the target family', async () => {
    const client = makeFakeClient({
      baby: [{ id: 'existing-b', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }],
      caretaker: [{ id: 'existing-c', loginId: '01' }],
      contact: [],
      medicine: [],
      food: [],
      unit: [{ unitAbbr: 'OZ' }, { unitAbbr: 'ML' }],
    });
    const existing = await preloadExisting(client, 'target-fam', false);
    expect(existing.babies).toHaveLength(1);
    expect(existing.caretakers?.[0].loginId).toBe('01');
    expect(existing.unitAbbrs?.has('OZ')).toBe(true);
    expect(existing.logKeys).toBeUndefined(); // dedup=false
  });

  it('reconciles a matching baby (reuse, not re-insert) and merges its logs', async () => {
    const client = makeFakeClient();
    const deps = makeDeps(client);
    const parsed = makeParsed({
      babies: [{ id: 'b-src', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }] as any,
      caretakers: [{ id: 'c-src', loginId: '01', name: 'Cara' }] as any,
      feedLogs: [{ id: 'f1', time: new Date('2024-03-01'), type: 'BOTTLE', amount: 4, babyId: 'b-src', caretakerId: 'c-src' }] as any,
    });
    const opts: ImportOptions = { mode: 'append', targetFamilyId: 'target-fam', dedup: false };
    const existing = {
      babies: [{ id: 'existing-b', firstName: 'Ada', lastName: 'L', birthDate: new Date('2023-01-01') }],
      caretakers: [{ id: 'existing-c', loginId: '01' }],
    };
    const plan = planMigration(parsed, opts, existing as any);

    // Reused entities are not re-inserted.
    expect(plan.batches.find((b) => b.table === 'Baby')).toBeUndefined();
    expect(plan.batches.find((b) => b.table === 'Caretaker')).toBeUndefined();
    expect(plan.report.entities.babies.matched).toBe(1);

    const report = await applyMigration(plan, parsed, opts, deps);

    // No new family created in append mode.
    expect(client.__families).toHaveLength(0);
    // Feed log inserted under the existing (reused) baby/caretaker ids.
    expect(client.__inserts.feedLog).toHaveLength(1);
    expect(client.__inserts.feedLog[0].babyId).toBe('existing-b');
    expect(client.__inserts.feedLog[0].caretakerId).toBe('existing-c');
    expect(client.__inserts.feedLog[0].familyId).toBe('target-fam');
    expect(report.mode).toBe('append');
  });

  it('tolerates a createMany failure in append (per-row fallback)', async () => {
    const client = makeFakeClient();
    client.__throwCreateManyFor!.add('baby');
    const deps = makeDeps(client);
    const parsed = makeParsed({
      babies: [{ id: 'b-src', firstName: 'New', lastName: 'Baby', birthDate: new Date('2023-05-05') }] as any,
    });
    const opts: ImportOptions = { mode: 'append', targetFamilyId: 'target-fam', dedup: false };
    const plan = planMigration(parsed, opts, {});
    await applyMigration(plan, parsed, opts, deps); // must not throw
    // Fallback per-row create still recorded the insert.
    expect(client.__inserts.baby).toHaveLength(1);
  });
});
