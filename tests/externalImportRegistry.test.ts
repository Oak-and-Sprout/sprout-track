import { describe, expect, it } from 'vitest';
import {
  externalImportProviders,
  getExternalImportProvider,
} from '../src/lib/importers/registry';

describe('external import provider registry', () => {
  it('registers Baby Buddy as a multi-file CSV provider', () => {
    const provider = getExternalImportProvider('baby-buddy');

    expect(provider).toEqual({
      id: 'baby-buddy',
      name: 'Baby Buddy',
      description:
        'Import children and activity history exported from Baby Buddy.',
      acceptedExtensions: ['.csv'],
      supportsMultipleFiles: true,
    });
  });

  it('returns undefined for an unknown provider', () => {
    expect(getExternalImportProvider('unknown')).toBeUndefined();
  });

  it('contains unique provider IDs', () => {
    const ids = externalImportProviders.map(provider => provider.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
