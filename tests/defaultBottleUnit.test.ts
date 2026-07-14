import { describe, expect, it } from 'vitest';
import { DEFAULT_BOTTLE_UNIT, normalizeBottleUnit } from '@/src/utils/defaultBottleUnit';

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
});
