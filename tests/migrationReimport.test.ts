import { describe, it, expect } from 'vitest';
import type { ParsedMigration } from '@/src/types/family-migration';
import { planMigration, type ExistingTargetData } from '@/src/utils/migration-plan';
import { emptyMigrationTables } from '@/src/utils/migration-parse';
import { dedupKey, isDedupTable } from '@/src/utils/migration-dedup';

const TARGET = 'fam-target';
const BD = new Date('2023-06-01T00:00:00.000Z');

function makeParsed(overrides: Partial<ParsedMigration['tables']>): ParsedMigration {
  return {
    manifest: {
      schemaVersion: 1, app: 'sprout-track', kind: 'family-migration',
      exportedAt: '2024-01-01T00:00:00.000Z', sourceProvider: 'sqlite',
      family: { slug: 's', name: 'n' }, features: { photos: false }, counts: {}, files: [],
    },
    tables: { ...emptyMigrationTables(), ...overrides } as ParsedMigration['tables'],
    photoBytes: new Map(),
    vaccineDocBytes: new Map(),
  };
}

// A small but representative fixture: one caretaker, one baby, one medicine,
// two sleep logs, one feed log, one medicine log. FK columns use source ids.
// Note the deliberately tampered familyId — the plan must overwrite it.
function fixture(): ParsedMigration {
  return makeParsed({
    caretakers: [{ id: 'c-src', loginId: '01', name: 'Cara', familyId: 'HOSTILE', accountId: 'acct-1' }] as any,
    babies: [{ id: 'b-src', firstName: 'Ada', lastName: 'L', birthDate: BD, familyId: 'HOSTILE' }] as any,
    medicines: [{ id: 'm-src', name: 'Tylenol', familyId: 'HOSTILE' }] as any,
    sleepLogs: [
      { id: 's1', babyId: 'b-src', caretakerId: 'c-src', startTime: new Date('2024-01-01T01:00:00Z'), type: 'NAP', familyId: 'HOSTILE' },
      { id: 's2', babyId: 'b-src', caretakerId: 'c-src', startTime: new Date('2024-01-01T05:00:00Z'), type: 'NAP', familyId: 'HOSTILE' },
    ] as any,
    feedLogs: [
      { id: 'f1', babyId: 'b-src', caretakerId: 'c-src', time: new Date('2024-01-01T02:00:00Z'), type: 'BOTTLE', amount: 4, side: null, unitAbbr: 'OZ', familyId: 'HOSTILE' },
    ] as any,
    medicineLogs: [
      { id: 'ml1', babyId: 'b-src', caretakerId: 'c-src', medicineId: 'm-src', time: new Date('2024-01-01T03:00:00Z'), doseAmount: 1, familyId: 'HOSTILE' },
    ] as any,
  });
}

function rowsFor(plan: ReturnType<typeof planMigration>, table: string): Record<string, any>[] {
  return (plan.batches.find((b) => b.table === table)?.rows as Record<string, any>[]) ?? [];
}

/** Reconstruct the "existing target" state from a plan's emitted rows + idMap. */
function existingFrom(parsed: ParsedMigration, plan: ReturnType<typeof planMigration>): ExistingTargetData {
  const logKeys: Record<string, Set<string>> = {};
  for (const batch of plan.batches) {
    if (!isDedupTable(batch.table)) continue;
    logKeys[batch.table] = new Set((batch.rows as Record<string, any>[]).map((r) => dedupKey(batch.table, r)!));
  }
  return {
    caretakers: [{ id: plan.idMap.get('Caretaker', 'c-src')!, loginId: '01' }],
    babies: [{ id: plan.idMap.get('Baby', 'b-src')!, firstName: 'Ada', lastName: 'L', birthDate: BD }],
    medicines: [{ id: plan.idMap.get('Medicine', 'm-src')!, name: 'Tylenol' }],
    logKeys,
  };
}

describe('re-import idempotency (append, dedup:true)', () => {
  const opts = { mode: 'append' as const, targetFamilyId: TARGET, dedup: true };

  it('first run creates all entities and inserts all logs', () => {
    const plan = planMigration(fixture(), opts, {});
    expect(plan.report.entities.babies).toEqual({ matched: 0, created: 1 });
    expect(plan.report.entities.caretakers).toEqual({ matched: 0, created: 1 });
    expect(plan.report.entities.medicines).toEqual({ matched: 0, created: 1 });
    expect(plan.report.logs.sleepLogs).toEqual({ inserted: 2, skippedDuplicate: 0 });
    expect(plan.report.logs.feedLogs.inserted).toBe(1);
    expect(plan.report.logs.medicineLogs.inserted).toBe(1);
    expect(rowsFor(plan, 'SleepLog')).toHaveLength(2);
  });

  it('second run into the same family reuses all entities and inserts zero logs', () => {
    const parsed = fixture();
    const run1 = planMigration(parsed, opts, {});
    const existing = existingFrom(parsed, run1);
    const run2 = planMigration(parsed, opts, existing);

    expect(run2.report.entities.babies).toEqual({ matched: 1, created: 0 });
    expect(run2.report.entities.caretakers).toEqual({ matched: 1, created: 0 });
    expect(run2.report.entities.medicines).toEqual({ matched: 1, created: 0 });

    expect(run2.report.logs.sleepLogs).toEqual({ inserted: 0, skippedDuplicate: 2 });
    expect(run2.report.logs.feedLogs).toEqual({ inserted: 0, skippedDuplicate: 1 });
    expect(run2.report.logs.medicineLogs).toEqual({ inserted: 0, skippedDuplicate: 1 });

    // No rows emitted for reused entities or deduped logs.
    expect(rowsFor(run2, 'Baby')).toHaveLength(0);
    expect(rowsFor(run2, 'SleepLog')).toHaveLength(0);
    expect(rowsFor(run2, 'MedicineLog')).toHaveLength(0);

    // The reconciled baby resolves to the existing target id, not a fresh one.
    expect(run2.idMap.get('Baby', 'b-src')).toBe(run1.idMap.get('Baby', 'b-src'));
  });
});

describe('dedup:false keeps every log', () => {
  it('inserts all logs even when they duplicate existing natural keys', () => {
    const parsed = fixture();
    const run1 = planMigration(parsed, { mode: 'append', targetFamilyId: TARGET, dedup: true }, {});
    const existing = existingFrom(parsed, run1);
    const merge = planMigration(parsed, { mode: 'append', targetFamilyId: TARGET, dedup: false }, existing);

    expect(merge.report.logs.sleepLogs).toEqual({ inserted: 2, skippedDuplicate: 0 });
    expect(rowsFor(merge, 'SleepLog')).toHaveLength(2);
    // Entities still reconcile (reconciliation is independent of log dedup).
    expect(merge.report.entities.babies).toEqual({ matched: 1, created: 0 });
  });
});

describe('golden rule — familyId is always the target', () => {
  it('overwrites the file familyId on every family-scoped row (new-family and append)', () => {
    for (const opts of [
      { mode: 'new-family' as const, newFamily: { name: 'N', slug: 's' }, dedup: false },
      { mode: 'append' as const, targetFamilyId: TARGET, dedup: false },
    ]) {
      const plan = planMigration(fixture(), opts, {});
      for (const batch of plan.batches) {
        for (const row of batch.rows as Record<string, any>[]) {
          if ('familyId' in row) expect(row.familyId).toBe(plan.targetFamilyId);
          expect(row.familyId).not.toBe('HOSTILE');
        }
      }
      // Caretaker.accountId (excluded model link) is stripped.
      const caretaker = rowsFor(plan, 'Caretaker')[0];
      if (caretaker) expect(caretaker.accountId).toBeNull();
    }
  });
});
