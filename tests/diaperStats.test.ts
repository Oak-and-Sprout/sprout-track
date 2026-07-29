import { describe, expect, it } from 'vitest';
import { isDirtyDiaper, isWetDiaper } from '@/src/utils/diaperStats';

describe('diaper stat predicates', () => {
  it.each([
    ['WET', true, false],
    ['DIRTY', false, true],
    ['BOTH', true, true],
    ['DRY', false, false],
  ] as const)('classifies %s as wet=%s dirty=%s', (type, wet, dirty) => {
    expect(isWetDiaper(type)).toBe(wet);
    expect(isDirtyDiaper(type)).toBe(dirty);
  });

  it('excludes an unrecognised type from both counters', () => {
    expect(isWetDiaper('SOMETHING_NEW')).toBe(false);
    expect(isDirtyDiaper('SOMETHING_NEW')).toBe(false);
  });
});
