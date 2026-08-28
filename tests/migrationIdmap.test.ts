import { describe, it, expect } from 'vitest';
import { TABLE_IMPORT_ORDER } from '@/app/api/utils/db-backup';
import { createIdMap, remapRow, TABLE_SPECS } from '@/src/utils/migration-idmap';
import { MIGRATION_TABLE_ORDER } from '@/src/utils/migration-plan';

const TARGET = 'target-family-id';

describe('createIdMap', () => {
  it('sets/gets/has and resolves, throwing on unknown pairs', () => {
    const m = createIdMap();
    m.set('Baby', 'src1', 'tgt1');
    expect(m.get('Baby', 'src1')).toBe('tgt1');
    expect(m.has('Baby', 'src1')).toBe(true);
    expect(m.has('Baby', 'nope')).toBe(false);
    expect(m.resolve('Baby', 'src1')).toBe('tgt1');
    expect(() => m.resolve('Baby', 'nope')).toThrow(/unmapped/i);
    // Same source id under a different table is a different entry.
    expect(m.has('Caretaker', 'src1')).toBe(false);
  });
});

describe('remapRow — parent/child/junction FKs', () => {
  const idMap = createIdMap();
  idMap.set('Baby', 'baby-src', 'baby-tgt');
  idMap.set('Caretaker', 'care-src', 'care-tgt');
  idMap.set('FeedLog', 'feed-src', 'feed-tgt');
  idMap.set('CalendarEvent', 'evt-src', 'evt-tgt');

  it('rewrites the PK and child FKs to fresh target ids; no source id leaks into a PK', () => {
    const row = {
      id: 'feed-src', babyId: 'baby-src', caretakerId: 'care-src',
      unitAbbr: 'OZ', amount: 4, familyId: 'FILE-FAMILY', type: 'BOTTLE',
    };
    const out = remapRow(TABLE_SPECS.FeedLog, row, idMap, TARGET);
    expect(out.id).toBe('feed-tgt');
    expect(out.id).not.toBe('feed-src');
    expect(out.babyId).toBe('baby-tgt');
    expect(out.caretakerId).toBe('care-tgt');
    // Golden rule: familyId forced to target, never the file's value.
    expect(out.familyId).toBe(TARGET);
    // Unit FK is exempt — carried over verbatim (references stable unitAbbr).
    expect(out.unitAbbr).toBe('OZ');
    // Input row is untouched (pure).
    expect(row.babyId).toBe('baby-src');
  });

  it('leaves null FK columns null', () => {
    const out = remapRow(TABLE_SPECS.FeedLog, { id: 'feed-src', babyId: 'baby-src', caretakerId: null }, idMap, TARGET);
    expect(out.caretakerId).toBeNull();
    expect(out.babyId).toBe('baby-tgt');
  });

  it('remaps both sides of a junction row and sets no familyId on it', () => {
    const out = remapRow(TABLE_SPECS.BabyEvent, { babyId: 'baby-src', eventId: 'evt-src' }, idMap, TARGET);
    expect(out.babyId).toBe('baby-tgt');
    expect(out.eventId).toBe('evt-tgt');
    expect('familyId' in out).toBe(false);
  });

  it('nulls out dropped columns (Caretaker.accountId → excluded Account)', () => {
    idMap.set('Caretaker', 'c2', 'c2-tgt');
    const out = remapRow(TABLE_SPECS.Caretaker, { id: 'c2', loginId: '01', accountId: 'acct-x', familyId: 'F' }, idMap, TARGET);
    expect(out.accountId).toBeNull();
    expect(out.familyId).toBe(TARGET);
  });

  it('resolves a polymorphic PhotoLink.activityId by activityType', () => {
    idMap.set('Photo', 'p-src', 'p-tgt');
    idMap.set('PhotoLink', 'pl-src', 'pl-tgt');
    idMap.set('Milestone', 'm-src', 'm-tgt');
    const out = remapRow(
      TABLE_SPECS.PhotoLink,
      { id: 'pl-src', photoId: 'p-src', activityType: 'milestone', activityId: 'm-src' },
      idMap,
      TARGET,
    );
    expect(out.photoId).toBe('p-tgt');
    expect(out.activityId).toBe('m-tgt');
  });
});

describe('MIGRATION_TABLE_ORDER respects TABLE_IMPORT_ORDER', () => {
  it('keeps the relative order of every shared (base) table', () => {
    const migrationSet = new Set(MIGRATION_TABLE_ORDER);
    const importSet = new Set(TABLE_IMPORT_ORDER);
    const migrationBase = MIGRATION_TABLE_ORDER.filter((t) => importSet.has(t));
    const importBase = TABLE_IMPORT_ORDER.filter((t) => migrationSet.has(t));
    expect(migrationBase).toEqual(importBase);
  });

  it('places every parent table before its children', () => {
    const idx = (t: string) => MIGRATION_TABLE_ORDER.indexOf(t);
    expect(idx('Baby')).toBeLessThan(idx('SleepLog'));
    expect(idx('Medicine')).toBeLessThan(idx('MedicineLog'));
    expect(idx('Food')).toBeLessThan(idx('FoodLog'));
    expect(idx('CalendarEvent')).toBeLessThan(idx('BabyEvent'));
    expect(idx('Photo')).toBeLessThan(idx('PhotoLink'));
    expect(idx('VaccineLog')).toBeLessThan(idx('VaccineDocument'));
    expect(idx('VaccineLog')).toBeLessThan(idx('ContactVaccine'));
  });
});
