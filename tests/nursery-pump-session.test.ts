import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  parsePumpSessionSnapshot,
  pumpSessionKey,
  loadPumpSession,
  savePumpSession,
  clearPumpSession,
  PumpSessionSnapshot,
} from '@/src/utils/nursery/pumpSession';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const validSnapshot: PumpSessionSnapshot = {
  phase: 'timing',
  activeSide: 'left',
  startTime: '2026-07-14T10:00:00.000Z',
  sideDuration: { left: 30, right: 0 },
  pauseAccumulated: 0,
  resumeTime: 1752480000000,
  elapsed: 45,
  amountLeft: '',
  amountRight: '',
};

describe('parsePumpSessionSnapshot', () => {
  it('accepts a well-formed snapshot', () => {
    expect(parsePumpSessionSnapshot(validSnapshot)).toEqual(validSnapshot);
  });

  it('rejects non-object input', () => {
    expect(parsePumpSessionSnapshot(null)).toBeNull();
    expect(parsePumpSessionSnapshot('nope')).toBeNull();
    expect(parsePumpSessionSnapshot([1, 2, 3])).toBeNull();
  });

  it('rejects an invalid phase', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, phase: 'idle' })).toBeNull();
    expect(parsePumpSessionSnapshot({ ...validSnapshot, phase: 'bogus' })).toBeNull();
  });

  it('rejects an invalid activeSide', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, activeSide: 'up' })).toBeNull();
  });

  it('rejects an unparsable startTime', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, startTime: 'not-a-date' })).toBeNull();
  });

  it('rejects a malformed sideDuration', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, sideDuration: { left: -1, right: 0 } })).toBeNull();
    expect(parsePumpSessionSnapshot({ ...validSnapshot, sideDuration: null })).toBeNull();
  });

  it('accepts a null resumeTime (paused session)', () => {
    const paused = { ...validSnapshot, phase: 'paused' as const, resumeTime: null };
    expect(parsePumpSessionSnapshot(paused)).toEqual(paused);
  });

  it('rejects a non-numeric resumeTime', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, resumeTime: 'now' })).toBeNull();
  });

  it('rejects non-string amount fields', () => {
    expect(parsePumpSessionSnapshot({ ...validSnapshot, amountLeft: 4 })).toBeNull();
  });
});

describe('pumpSessionKey', () => {
  it('scopes the storage key per baby', () => {
    expect(pumpSessionKey('baby-1')).toBe('nurseryPumpSessionV1:baby-1');
    expect(pumpSessionKey('baby-2')).not.toBe(pumpSessionKey('baby-1'));
  });
});

describe('save/load/clear round-trip', () => {
  beforeEach(() => {
    (globalThis as any).window = { localStorage: new MemoryStorage() };
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('round-trips a saved snapshot', () => {
    savePumpSession('baby-1', validSnapshot);
    expect(loadPumpSession('baby-1')).toEqual(validSnapshot);
  });

  it('keeps sessions for different babies isolated', () => {
    savePumpSession('baby-1', validSnapshot);
    expect(loadPumpSession('baby-2')).toBeNull();
  });

  it('returns null when nothing is saved', () => {
    expect(loadPumpSession('baby-1')).toBeNull();
  });

  it('clears a saved session', () => {
    savePumpSession('baby-1', validSnapshot);
    clearPumpSession('baby-1');
    expect(loadPumpSession('baby-1')).toBeNull();
  });

  it('ignores corrupt JSON instead of throwing', () => {
    window.localStorage.setItem(pumpSessionKey('baby-1'), '{not json');
    expect(loadPumpSession('baby-1')).toBeNull();
  });

  it('is a no-op without a babyId', () => {
    savePumpSession('', validSnapshot);
    expect(loadPumpSession('')).toBeNull();
  });
});
