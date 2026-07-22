import { describe, expect, it } from 'vitest';
import {
  BATH_TYPES,
  BOTTLE_TYPES,
  DIAPER_COLORS,
  DIAPER_CONDITIONS,
  FEED_SIDES,
  SLEEP_QUALITIES,
  normalizeEnumValue,
} from '../app/api/hooks/v1/field-values';

describe('canonical field-value sets', () => {
  it('matches the diaper form dropdown values verbatim', () => {
    expect(DIAPER_CONDITIONS).toEqual(['NORMAL', 'LOOSE', 'FIRM', 'OTHER']);
    expect(DIAPER_COLORS).toEqual(['YELLOW', 'BROWN', 'GREEN', 'BLACK', 'RED', 'OTHER']);
  });

  it('matches the sleep form quality values verbatim', () => {
    expect(SLEEP_QUALITIES).toEqual(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']);
  });

  it('matches the bath form built-in types verbatim', () => {
    expect(BATH_TYPES).toEqual(['Full Bath', 'Sponge Bath', 'Wipe Down']);
  });

  it('matches the feed bottleType and side values verbatim', () => {
    expect(BOTTLE_TYPES).toEqual(['Formula', 'Breast Milk', 'Formula/Breast', 'Milk', 'Other']);
    expect(FEED_SIDES).toEqual(['LEFT', 'RIGHT']);
  });
});

describe('normalizeEnumValue', () => {
  it('returns the value unchanged when it already matches the canonical casing', () => {
    expect(normalizeEnumValue('NORMAL', DIAPER_CONDITIONS)).toBe('NORMAL');
  });

  it('matches case-insensitively and returns the canonical casing', () => {
    expect(normalizeEnumValue('normal', DIAPER_CONDITIONS)).toBe('NORMAL');
    expect(normalizeEnumValue('Loose', DIAPER_CONDITIONS)).toBe('LOOSE');
    expect(normalizeEnumValue('yellow', DIAPER_COLORS)).toBe('YELLOW');
    expect(normalizeEnumValue('good', SLEEP_QUALITIES)).toBe('GOOD');
    expect(normalizeEnumValue('sponge bath', BATH_TYPES)).toBe('Sponge Bath');
    expect(normalizeEnumValue('FORMULA/BREAST', BOTTLE_TYPES)).toBe('Formula/Breast');
    expect(normalizeEnumValue('left', FEED_SIDES)).toBe('LEFT');
  });

  it('returns null when no case-insensitive match exists', () => {
    expect(normalizeEnumValue('ZZZ_BOGUS', DIAPER_CONDITIONS)).toBeNull();
    expect(normalizeEnumValue('purple', DIAPER_COLORS)).toBeNull();
    expect(normalizeEnumValue('excellentish', SLEEP_QUALITIES)).toBeNull();
    expect(normalizeEnumValue('UP', FEED_SIDES)).toBeNull();
  });

  it('does not partial-match a substring of a canonical value', () => {
    expect(normalizeEnumValue('NORM', DIAPER_CONDITIONS)).toBeNull();
  });

  it('treats an empty string as no match', () => {
    expect(normalizeEnumValue('', DIAPER_CONDITIONS)).toBeNull();
  });
});
