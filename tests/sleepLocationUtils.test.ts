import { describe, it, expect } from 'vitest';
import {
  buildSleepLocationSummaries,
  getDuplicateSuggestions,
  validateLocationRename,
  validateLocationDelete,
  validateLocationAdd,
  updateSettingsAfterRename,
  updateSettingsAfterDelete,
} from '@/src/utils/sleepLocationUtils';
import { DEFAULT_SLEEP_LOCATIONS } from '@/src/constants/sleepLocations';
import { SleepLocationSummary } from '@/app/api/types';

// Issue #174: sleep locations are free-text on SleepLog rows; these helpers
// power the Settings manager (list / add / rename / merge / cleanup).
// Custom names can also be persisted in Settings.sleepLocationSettings
// (customLocations) so they exist before any sleep entry uses them.

const summary = (
  name: string,
  count = 0,
  isDefault = false,
  hidden = false,
): SleepLocationSummary => ({ name, count, isDefault, hidden });

describe('buildSleepLocationSummaries', () => {
  it('returns all defaults in canonical order with zero counts when there is no data', () => {
    const result = buildSleepLocationSummaries([], [], []);
    expect(result.map((l) => l.name)).toEqual([...DEFAULT_SLEEP_LOCATIONS]);
    expect(result.every((l) => l.isDefault && l.count === 0 && !l.hidden)).toBe(true);
  });

  it('folds usage counts onto defaults and appends customs sorted by count desc, then name asc', () => {
    const result = buildSleepLocationSummaries(
      [
        { location: 'Crib', count: 5 },
        { location: 'Grandparents', count: 2 },
        { location: 'Beach House', count: 2 },
        { location: 'Hammock', count: 7 },
      ],
      [],
      [],
    );
    expect(result.find((l) => l.name === 'Crib')).toEqual(summary('Crib', 5, true));
    expect(result.slice(DEFAULT_SLEEP_LOCATIONS.length).map((l) => l.name)).toEqual([
      'Hammock',
      'Beach House',
      'Grandparents',
    ]);
  });

  it('skips null and exactly-empty locations but keeps whitespace-padded values distinct', () => {
    const result = buildSleepLocationSummaries(
      [
        { location: null, count: 3 },
        { location: '', count: 2 },
        { location: 'Crib ', count: 4 },
      ],
      [],
      [],
    );
    const names = result.map((l) => l.name);
    expect(names).not.toContain('');
    expect(names).toContain('Crib ');
    expect(result.find((l) => l.name === 'Crib ')).toEqual(summary('Crib ', 4));
  });

  it('surfaces hidden locations with zero uses so they can be cleaned up', () => {
    const result = buildSleepLocationSummaries([], ['Old Cot'], []);
    expect(result.find((l) => l.name === 'Old Cot')).toEqual(
      summary('Old Cot', 0, false, true),
    );
  });

  it('includes persisted custom locations with zero uses', () => {
    const result = buildSleepLocationSummaries([], [], ['Grandma']);
    expect(result.find((l) => l.name === 'Grandma')).toEqual(summary('Grandma', 0));
  });

  it('merges usage counts onto persisted customs without duplicating them', () => {
    const result = buildSleepLocationSummaries(
      [{ location: 'Grandma', count: 3 }],
      ['Grandma'],
      ['Grandma'],
    );
    const matches = result.filter((l) => l.name === 'Grandma');
    expect(matches).toEqual([summary('Grandma', 3, false, true)]);
  });

  it('marks hidden by exact string match only', () => {
    const result = buildSleepLocationSummaries(
      [{ location: 'crib', count: 1 }],
      ['Crib'],
      [],
    );
    expect(result.find((l) => l.name === 'Crib')?.hidden).toBe(true);
    expect(result.find((l) => l.name === 'crib')?.hidden).toBe(false);
  });
});

describe('getDuplicateSuggestions', () => {
  it('suggests merging case/whitespace variants into the default in the group', () => {
    const suggestions = getDuplicateSuggestions([
      summary('Crib', 5, true),
      summary('crib', 2),
      summary('Crib ', 1),
      summary('Hammock', 3),
    ]);
    expect(suggestions).toEqual(
      expect.arrayContaining([
        { name: 'crib', mergeInto: 'Crib' },
        { name: 'Crib ', mergeInto: 'Crib' },
      ]),
    );
    expect(suggestions).toHaveLength(2);
  });

  it('uses the highest-count member as canonical when no default is in the group', () => {
    const suggestions = getDuplicateSuggestions([
      summary('grandma', 1),
      summary('Grandma', 6),
    ]);
    expect(suggestions).toEqual([{ name: 'grandma', mergeInto: 'Grandma' }]);
  });

  it('breaks count ties by name ascending', () => {
    const suggestions = getDuplicateSuggestions([
      summary('beach house', 2),
      summary('Beach House', 2),
    ]);
    expect(suggestions).toEqual([{ name: 'beach house', mergeInto: 'Beach House' }]);
  });

  it('returns nothing when all values are distinct after trimming and lowercasing', () => {
    expect(
      getDuplicateSuggestions([summary('Crib', 5, true), summary('Hammock', 3)]),
    ).toEqual([]);
  });
});

describe('validateLocationRename', () => {
  it('accepts a rename, trimming the target but never the source', () => {
    expect(validateLocationRename('Crib ', '  Crib')).toEqual({
      valid: true,
      from: 'Crib ',
      to: 'Crib',
    });
  });

  it('allows merging into a default location', () => {
    expect(validateLocationRename('crib', 'Crib')).toEqual({
      valid: true,
      from: 'crib',
      to: 'Crib',
    });
  });

  it('rejects non-string or empty inputs', () => {
    expect(validateLocationRename(undefined, 'Crib').valid).toBe(false);
    expect(validateLocationRename('', 'Crib').valid).toBe(false);
    expect(validateLocationRename('Hammock', '   ').valid).toBe(false);
  });

  it('rejects renaming a location to itself', () => {
    expect(validateLocationRename('Hammock', 'Hammock ').valid).toBe(false);
  });

  it('rejects renaming or merging away a default location', () => {
    const result = validateLocationRename('Crib', 'Baby Crib');
    expect(result).toEqual({
      valid: false,
      error: 'Default locations cannot be renamed or merged',
    });
  });
});

describe('validateLocationAdd', () => {
  it('accepts and trims a new location name', () => {
    expect(validateLocationAdd('  Grandma ', ['Crib', 'Hammock'])).toEqual({
      valid: true,
      name: 'Grandma',
    });
  });

  it('rejects non-string or empty names', () => {
    expect(validateLocationAdd(undefined, []).valid).toBe(false);
    expect(validateLocationAdd('   ', []).valid).toBe(false);
  });

  it('rejects names that already exist, matching case-insensitively after trimming', () => {
    const existing = ['Crib', 'Grandma'];
    expect(validateLocationAdd('grandma', existing)).toEqual({
      valid: false,
      error: 'This location already exists',
    });
    expect(validateLocationAdd(' CRIB ', existing).valid).toBe(false);
  });
});

describe('updateSettingsAfterRename', () => {
  it('removes the source from hiddenLocations and de-duplicates', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: ['Old Cot', 'Crib', 'Old Cot'], customLocations: [] },
      'Old Cot',
      'New Cot',
    );
    expect(result.hiddenLocations).toEqual(['Crib']);
  });

  it('renames a persisted custom location in place', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['Grandma', 'Hammock'] },
      'Grandma',
      "Grandma's House",
    );
    expect(result.customLocations).toEqual(["Grandma's House", 'Hammock']);
  });

  it('does not add the target to customLocations when the source was not persisted', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['Hammock'] },
      'Grandma',
      'Nana',
    );
    expect(result.customLocations).toEqual(['Hammock']);
  });

  it('drops the source without adding the target when merging into a default', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['crib'] },
      'crib',
      'Crib',
    );
    expect(result.customLocations).toEqual([]);
  });

  it('does not duplicate the target when merging into another persisted custom', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['grandma', 'Grandma'] },
      'grandma',
      'Grandma',
    );
    expect(result.customLocations).toEqual(['Grandma']);
  });
});

describe('updateSettingsAfterDelete', () => {
  it('removes the name from both hiddenLocations and customLocations', () => {
    const result = updateSettingsAfterDelete(
      { hiddenLocations: ['Old Cot', 'Crib'], customLocations: ['Old Cot', 'Hammock'] },
      'Old Cot',
    );
    expect(result).toEqual({ hiddenLocations: ['Crib'], customLocations: ['Hammock'] });
  });

  it('removes by exact match only', () => {
    const result = updateSettingsAfterDelete(
      { hiddenLocations: ['Crib '], customLocations: ['crib'] },
      'Crib',
    );
    expect(result).toEqual({ hiddenLocations: ['Crib '], customLocations: ['crib'] });
  });
});
