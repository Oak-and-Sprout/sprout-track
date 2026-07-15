import { describe, expect, it, afterEach } from 'vitest';
import {
  DEFAULT_BOTTLE_UNIT,
  normalizeBottleUnit,
  cacheDefaultBottleUnit,
  readCachedDefaultBottleUnit,
} from '@/src/utils/defaultBottleUnit';

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
  keys(): string[] {
    return Array.from(this.store.keys());
  }
}

class ThrowingStorage {
  getItem(): string | null {
    throw new Error('storage unavailable');
  }
  setItem(): void {
    throw new Error('storage unavailable');
  }
}

function makeToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function stubWindow({
  token,
  pathname = '/my-family/log-entry',
  storage = new MemoryStorage(),
}: { token?: string; pathname?: string; storage?: MemoryStorage | ThrowingStorage } = {}) {
  if (token && storage instanceof MemoryStorage) {
    storage.setItem('authToken', token);
  }
  (globalThis as any).window = {
    localStorage: storage,
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    location: { pathname },
  };
  return storage;
}

afterEach(() => {
  delete (globalThis as any).window;
});

describe('default bottle unit', () => {
  it('normalizes persisted unit values case-insensitively', () => {
    expect(normalizeBottleUnit('ml')).toBe('ML');
    expect(normalizeBottleUnit('OZ')).toBe('OZ');
  });

  it('rejects unsupported values and keeps OZ as the fallback', () => {
    expect(normalizeBottleUnit('G')).toBeNull();
    expect(normalizeBottleUnit(null)).toBeNull();
    expect(DEFAULT_BOTTLE_UNIT).toBe('OZ');
  });

  it('returns the default without window (SSR) and does not throw', () => {
    expect(readCachedDefaultBottleUnit()).toBe(DEFAULT_BOTTLE_UNIT);
    expect(cacheDefaultBottleUnit('ML')).toBe('ML');
  });

  it('round-trips the configured unit so it is available on first render after resume', () => {
    const token = makeToken({ familyId: 'family-1' });
    stubWindow({ token });

    expect(cacheDefaultBottleUnit('ML')).toBe('ML');
    // Simulate a fresh cold render after PWA resume: state initializers call
    // readCachedDefaultBottleUnit before any settings fetch resolves.
    expect(readCachedDefaultBottleUnit()).toBe('ML');
  });

  it('scopes the cache by familyId from the JWT (no cross-family leakage)', () => {
    const storage = stubWindow({ token: makeToken({ familyId: 'family-1' }) }) as MemoryStorage;
    cacheDefaultBottleUnit('ML');

    // Same device, different family token: must not see family-1's unit.
    storage.setItem('authToken', makeToken({ familyId: 'family-2' }));
    expect(readCachedDefaultBottleUnit()).toBe(DEFAULT_BOTTLE_UNIT);

    // Switching back restores family-1's cached unit.
    storage.setItem('authToken', makeToken({ familyId: 'family-1' }));
    expect(readCachedDefaultBottleUnit()).toBe('ML');
  });

  it('falls back to the route slug scope when the token has no familyId', () => {
    stubWindow({ token: makeToken({ isSysAdmin: true, familyId: null }), pathname: '/smith-family/log-entry' });
    cacheDefaultBottleUnit('ML');
    expect(readCachedDefaultBottleUnit()).toBe('ML');

    // A different family slug is a different scope.
    (globalThis as any).window.location.pathname = '/jones-family/log-entry';
    expect(readCachedDefaultBottleUnit()).toBe(DEFAULT_BOTTLE_UNIT);
  });

  it('falls back to the route slug scope when the token is malformed', () => {
    const storage = stubWindow() as MemoryStorage;
    storage.setItem('authToken', 'not-a-jwt');
    expect(() => cacheDefaultBottleUnit('ML')).not.toThrow();
    expect(readCachedDefaultBottleUnit()).toBe('ML');
  });

  it('ignores corrupted cached values', () => {
    const storage = stubWindow({ token: makeToken({ familyId: 'family-1' }) }) as MemoryStorage;
    cacheDefaultBottleUnit('ML');
    const [key] = storage.keys().filter((k) => k !== 'authToken');
    storage.setItem(key, 'GARBAGE');
    expect(readCachedDefaultBottleUnit()).toBe(DEFAULT_BOTTLE_UNIT);
  });

  it('does not write invalid units to storage', () => {
    const storage = stubWindow({ token: makeToken({ familyId: 'family-1' }) }) as MemoryStorage;
    expect(cacheDefaultBottleUnit('LITERS')).toBeNull();
    expect(cacheDefaultBottleUnit(undefined)).toBeNull();
    expect(cacheDefaultBottleUnit(false)).toBeNull();
    expect(storage.keys()).toEqual(['authToken']);
  });

  it('survives storage errors (private mode / quota) without throwing', () => {
    stubWindow({ storage: new ThrowingStorage() });
    expect(readCachedDefaultBottleUnit()).toBe(DEFAULT_BOTTLE_UNIT);
    expect(cacheDefaultBottleUnit('ML')).toBe('ML');
  });
});
