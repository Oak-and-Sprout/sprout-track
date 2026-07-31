import { describe, it, expect } from 'vitest';
import { DEFAULT_SLEEP_LOCATIONS } from '@/src/constants/sleepLocations';
import en from '@/src/localization/translations/en.json';
import nl from '@/src/localization/translations/nl.json';

// 'Bassinet' was absent from every locale file, so t('Bassinet') rendered the
// raw key in all 11 languages. This guard fails the build if any default
// sleep location loses its English entry again.
describe('sleep location translations', () => {
  const strings = en as Record<string, string>;

  it.each([...DEFAULT_SLEEP_LOCATIONS])(
    'has a non-empty en.json entry for %s',
    (name) => {
      expect(strings[name]).toBeTruthy();
    },
  );

  it('does not give Crib and Bassinet the same Dutch translation', () => {
    // "Wieg" is Dutch for cradle/bassinet, so it cannot also mean crib.
    const dutch = nl as Record<string, string>;
    expect(dutch['Crib']).toBe('Ledikant');
    expect(dutch['Bassinet']).toBe('Wieg');
    expect(dutch['Crib']).not.toBe(dutch['Bassinet']);
  });
});
