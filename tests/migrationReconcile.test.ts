import { describe, it, expect } from 'vitest';
import { naturalKey, reconcileEntities } from '@/src/utils/migration-reconcile';

describe('reconcileEntities — Baby by firstName+lastName+birthDate', () => {
  const bd = new Date('2024-01-15T00:00:00.000Z');
  const existing = [{ id: 'existing-baby', firstName: 'Ada', lastName: 'Lovelace', birthDate: bd }];

  it('reuses the existing id on an exact match', () => {
    const imported = [{ id: 'import-baby', firstName: 'Ada', lastName: 'Lovelace', birthDate: new Date(bd.getTime()) }];
    const r = reconcileEntities(imported, existing, naturalKey.baby);
    expect(r.matched).toBe(1);
    expect(r.created).toBe(0);
    expect(r.reuse.get('import-baby')).toBe('existing-baby');
    expect(r.create).toHaveLength(0);
  });

  it('creates a new entity on a birthDate near-miss', () => {
    const imported = [{ id: 'import-baby', firstName: 'Ada', lastName: 'Lovelace', birthDate: new Date('2024-01-16T00:00:00.000Z') }];
    const r = reconcileEntities(imported, existing, naturalKey.baby);
    expect(r.matched).toBe(0);
    expect(r.created).toBe(1);
    expect(r.reuse.size).toBe(0);
    expect(r.create[0].id).toBe('import-baby');
  });

  it('creates a new entity when only the name differs', () => {
    const imported = [{ id: 'x', firstName: 'Grace', lastName: 'Lovelace', birthDate: new Date(bd.getTime()) }];
    const r = reconcileEntities(imported, existing, naturalKey.baby);
    expect(r.created).toBe(1);
  });
});

describe('reconcileEntities — Caretaker by loginId', () => {
  it('matches on loginId regardless of name', () => {
    const existing = [{ id: 'ct-existing', loginId: '01', name: 'Old Name' }];
    const imported = [{ id: 'ct-import', loginId: '01', name: 'New Name' }];
    const r = reconcileEntities(imported, existing, naturalKey.caretaker);
    expect(r.reuse.get('ct-import')).toBe('ct-existing');
    expect(r.matched).toBe(1);
  });

  it('creates when loginId is unseen', () => {
    const r = reconcileEntities(
      [{ id: 'ct-import', loginId: '02', name: 'N' }],
      [{ id: 'ct-existing', loginId: '01', name: 'O' }],
      naturalKey.caretaker,
    );
    expect(r.created).toBe(1);
  });
});

describe('reconcileEntities — Contact by name+role', () => {
  const existing = [{ id: 'contact-existing', name: 'Dr. Smith', role: 'doctor' }];

  it('matches on name+role', () => {
    const r = reconcileEntities([{ id: 'in', name: 'Dr. Smith', role: 'doctor' }], existing, naturalKey.contact);
    expect(r.reuse.get('in')).toBe('contact-existing');
  });

  it('creates when role differs', () => {
    const r = reconcileEntities([{ id: 'in', name: 'Dr. Smith', role: 'teacher' }], existing, naturalKey.contact);
    expect(r.created).toBe(1);
  });
});

describe('reconcileEntities — Medicine/Food by name; empty existing', () => {
  it('matches medicine by name', () => {
    const r = reconcileEntities(
      [{ id: 'm-in', name: 'Tylenol' }],
      [{ id: 'm-ex', name: 'Tylenol' }],
      naturalKey.medicine,
    );
    expect(r.reuse.get('m-in')).toBe('m-ex');
  });

  it('creates everything when the target has no existing rows', () => {
    const imported = [{ id: 'f1', name: 'Banana' }, { id: 'f2', name: 'Apple' }];
    const r = reconcileEntities(imported, [], naturalKey.food);
    expect(r.matched).toBe(0);
    expect(r.created).toBe(2);
  });
});
