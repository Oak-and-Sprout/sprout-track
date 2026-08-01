import { describe, it, expect } from 'vitest';
import { isReservedSlug, validateSlug } from '@/app/api/utils/slug-validation';

describe('short link reserved slug', () => {
  it('reserves "go" so no family can claim it', () => {
    expect(isReservedSlug('go')).toBe(true);
    expect(isReservedSlug('GO')).toBe(true);
  });

  it('rejects "go" via validateSlug', () => {
    const result = validateSlug('go');
    expect(result.isValid).toBe(false);
  });
});
