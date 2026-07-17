import { describe, it, expect } from 'vitest';
import { RESERVED_URLS, isReservedSlug, validateSlug } from '@/app/api/utils/slug-validation';

describe('slug validation - reserved marketing route names', () => {
  const marketingRoutes = ['features', 'pricing', 'terms', 'privacy', 'home'];

  it.each(marketingRoutes)('rejects "%s" as a family slug via isReservedSlug', (route) => {
    expect(isReservedSlug(route)).toBe(true);
  });

  it.each(marketingRoutes)('rejects "%s" as a family slug via validateSlug', (route) => {
    const result = validateSlug(route);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe('This URL is reserved by the system and cannot be used');
  });

  it('includes each marketing route in RESERVED_URLS', () => {
    for (const route of marketingRoutes) {
      expect(RESERVED_URLS).toContain(route);
    }
  });

  it('does not reserve "demo" - the live demo family relies on this slug', () => {
    expect(isReservedSlug('demo')).toBe(false);
  });
});
