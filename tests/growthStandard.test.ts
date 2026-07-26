import { describe, it, expect } from 'vitest';
import {
  WHO_MAX_AGE_MONTHS,
  isValidGrowthStandard,
  effectiveGrowthStandard,
} from '@/src/utils/growthStandard';

describe('WHO_MAX_AGE_MONTHS', () => {
  it('is 24', () => {
    expect(WHO_MAX_AGE_MONTHS).toBe(24);
  });
});

describe('isValidGrowthStandard', () => {
  it('accepts the two exact standards', () => {
    expect(isValidGrowthStandard('CDC')).toBe(true);
    expect(isValidGrowthStandard('WHO')).toBe(true);
  });

  it('rejects lowercase, empty, null, undefined, and unknown values', () => {
    expect(isValidGrowthStandard('cdc')).toBe(false);
    expect(isValidGrowthStandard('who')).toBe(false);
    expect(isValidGrowthStandard('')).toBe(false);
    expect(isValidGrowthStandard(null)).toBe(false);
    expect(isValidGrowthStandard(undefined)).toBe(false);
    expect(isValidGrowthStandard('BOTH')).toBe(false);
    expect(isValidGrowthStandard(1)).toBe(false);
  });
});

describe('effectiveGrowthStandard', () => {
  it('returns WHO when WHO is selected and age is within range', () => {
    expect(effectiveGrowthStandard('WHO', 0)).toBe('WHO');
    expect(effectiveGrowthStandard('WHO', 12)).toBe('WHO');
    expect(effectiveGrowthStandard('WHO', 24)).toBe('WHO'); // inclusive boundary
  });

  it('falls back to CDC when WHO is selected but age exceeds 24 months', () => {
    expect(effectiveGrowthStandard('WHO', 24.01)).toBe('CDC');
    expect(effectiveGrowthStandard('WHO', 30)).toBe('CDC');
  });

  it('returns CDC whenever CDC is selected, at any age', () => {
    expect(effectiveGrowthStandard('CDC', 0)).toBe('CDC');
    expect(effectiveGrowthStandard('CDC', 24)).toBe('CDC');
    expect(effectiveGrowthStandard('CDC', 40)).toBe('CDC');
  });

  it('case-normalizes the selection', () => {
    expect(effectiveGrowthStandard(' who ', 10)).toBe('WHO');
    expect(effectiveGrowthStandard('Who', 10)).toBe('WHO');
  });

  it('defaults to CDC for null, undefined, empty, and unknown selections', () => {
    expect(effectiveGrowthStandard(null, 10)).toBe('CDC');
    expect(effectiveGrowthStandard(undefined, 10)).toBe('CDC');
    expect(effectiveGrowthStandard('', 10)).toBe('CDC');
    expect(effectiveGrowthStandard('STONE', 10)).toBe('CDC');
  });
});
