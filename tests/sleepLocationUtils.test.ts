import { describe, it, expect } from 'vitest';
import {
  buildSleepLocationSummaries,
  getDuplicateSuggestions,
  validateLocationRename,
  validateLocationDelete,
  validateLocationAdd,
  updateSettingsAfterRename,
  updateSettingsAfterDelete,
  applyLocationOrder,
  moveLocation,
  localizeSleepLocation,
  mergeLocationSettings,
} from '@/src/utils/sleepLocationUtils';
import { DEFAULT_SLEEP_LOCATIONS } from '@/src/constants/sleepLocations';
import { SleepLocationSettings, SleepLocationSummary } from '@/app/api/types';

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
    expect(result).toEqual({ hiddenLocations: ['Crib'], customLocations: ['Hammock'], locationOrder: [] });
  });

  it('removes by exact match only', () => {
    const result = updateSettingsAfterDelete(
      { hiddenLocations: ['Crib '], customLocations: ['crib'] },
      'Crib',
    );
    expect(result).toEqual({ hiddenLocations: ['Crib '], customLocations: ['crib'], locationOrder: [] });
  });
});

describe('applyLocationOrder', () => {
  const base = [
    summary('Bassinet', 0, true),
    summary('Crib', 5, true),
    summary('Grandma', 2),
  ];

  it('returns the list unchanged when no order is saved', () => {
    expect(applyLocationOrder(base, []).map((l) => l.name)).toEqual([
      'Bassinet', 'Crib', 'Grandma',
    ]);
  });

  it('produces exactly the saved permutation', () => {
    const result = applyLocationOrder(base, ['Grandma', 'Crib', 'Bassinet']);
    expect(result.map((l) => l.name)).toEqual(['Grandma', 'Crib', 'Bassinet']);
  });

  it('skips a saved name that no longer exists', () => {
    const result = applyLocationOrder(base, ['Deleted Cot', 'Grandma']);
    expect(result.map((l) => l.name)).toEqual(['Grandma', 'Bassinet', 'Crib']);
  });

  it('appends a name missing from the saved order in its fallback position', () => {
    const result = applyLocationOrder(base, ['Grandma']);
    expect(result.map((l) => l.name)).toEqual(['Grandma', 'Bassinet', 'Crib']);
  });

  it('keeps a hidden location in its slot', () => {
    const withHidden = [
      summary('Bassinet', 0, true),
      summary('Crib', 5, true, true),
      summary('Grandma', 2),
    ];
    const result = applyLocationOrder(withHidden, ['Crib', 'Grandma', 'Bassinet']);
    expect(result.map((l) => l.name)).toEqual(['Crib', 'Grandma', 'Bassinet']);
    expect(result[0].hidden).toBe(true);
  });

  it('ignores a duplicated name in the saved order', () => {
    const result = applyLocationOrder(base, ['Crib', 'Crib', 'Bassinet']);
    expect(result.map((l) => l.name)).toEqual(['Crib', 'Bassinet', 'Grandma']);
  });

  it('does not mutate the input array', () => {
    const input = [...base];
    applyLocationOrder(input, ['Grandma']);
    expect(input.map((l) => l.name)).toEqual(['Bassinet', 'Crib', 'Grandma']);
  });
});

describe('moveLocation', () => {
  const order = ['Bassinet', 'Crib', 'Grandma'];

  it('swaps a location upward', () => {
    expect(moveLocation(order, 'Crib', -1)).toEqual(['Crib', 'Bassinet', 'Grandma']);
  });

  it('swaps a location downward', () => {
    expect(moveLocation(order, 'Crib', 1)).toEqual(['Bassinet', 'Grandma', 'Crib']);
  });

  it('no-ops at the head', () => {
    expect(moveLocation(order, 'Bassinet', -1)).toEqual(order);
  });

  it('no-ops at the tail', () => {
    expect(moveLocation(order, 'Grandma', 1)).toEqual(order);
  });

  it('returns the list unchanged when the name is absent', () => {
    expect(moveLocation(order, 'Nowhere', -1)).toEqual(order);
  });

  it('does not mutate the input array', () => {
    const input = [...order];
    moveLocation(input, 'Crib', -1);
    expect(input).toEqual(['Bassinet', 'Crib', 'Grandma']);
  });
});

describe('localizeSleepLocation', () => {
  // Stand-in for the real t(): translates a couple of known keys, otherwise
  // falls back to the key, exactly like src/context/localization.tsx does.
  const t = (key: string) => ({ Crib: 'Cuna', Other: 'Otro' }[key] ?? key);

  it('translates a default location', () => {
    expect(localizeSleepLocation('Crib', t)).toBe('Cuna');
  });

  it('returns a custom name verbatim even when it collides with a real key', () => {
    // A family that named their own location "Other" keeps their name.
    expect(localizeSleepLocation('Other ', t)).toBe('Other ');
  });

  it('returns an ordinary custom name verbatim', () => {
    expect(localizeSleepLocation('Grandma', t)).toBe('Grandma');
  });

  it('leaves a whitespace-padded custom name untouched', () => {
    expect(localizeSleepLocation(' Crib ', t)).toBe(' Crib ');
  });
});

describe('locationOrder bookkeeping', () => {
  it('renames a location in place in the order', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['Grandma'], locationOrder: ['Crib', 'Grandma', 'Other'] },
      'Grandma',
      'Nana',
    );
    expect(result.locationOrder).toEqual(['Crib', 'Nana', 'Other']);
  });

  it('drops the source when merging into a target already in the order', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['Grandma'], locationOrder: ['Crib', 'Grandma', 'Other'] },
      'Grandma',
      'Crib',
    );
    expect(result.locationOrder).toEqual(['Crib', 'Other']);
  });

  it('leaves the order alone when the renamed name is not in it', () => {
    const result = updateSettingsAfterRename(
      { hiddenLocations: [], customLocations: ['Grandma'], locationOrder: ['Crib'] },
      'Grandma',
      'Nana',
    );
    expect(result.locationOrder).toEqual(['Crib']);
  });

  it('drops a deleted location from the order', () => {
    const result = updateSettingsAfterDelete(
      { hiddenLocations: [], customLocations: ['Hammock'], locationOrder: ['Crib', 'Hammock'] },
      'Hammock',
    );
    expect(result.locationOrder).toEqual(['Crib']);
  });

  it('returns an empty order when none was saved', () => {
    const result = updateSettingsAfterDelete(
      { hiddenLocations: [], customLocations: [] },
      'Hammock',
    );
    expect(result.locationOrder).toEqual([]);
  });
});

// The POST /api/sleep-location-settings body is a partial patch: the manager
// saves only hiddenLocations when toggling visibility and only locationOrder
// when moving a row. Anything the patch omits has to survive untouched.
describe('mergeLocationSettings', () => {
  const existing: SleepLocationSettings = {
    hiddenLocations: ['Couch'],
    customLocations: ['Hammock'],
    locationOrder: ['Crib', 'Hammock'],
  };

  it('applies a locationOrder-only patch without dropping the other keys', () => {
    const result = mergeLocationSettings(existing, { locationOrder: ['Hammock', 'Crib'] });
    expect(result).toEqual({
      hiddenLocations: ['Couch'],
      customLocations: ['Hammock'],
      locationOrder: ['Hammock', 'Crib'],
    });
  });

  it('applies a hiddenLocations-only patch without dropping the other keys', () => {
    const result = mergeLocationSettings(existing, { hiddenLocations: [] });
    expect(result).toEqual({
      hiddenLocations: [],
      customLocations: ['Hammock'],
      locationOrder: ['Crib', 'Hammock'],
    });
  });

  it('applies a customLocations-only patch without dropping the other keys', () => {
    const result = mergeLocationSettings(existing, { customLocations: ['Hammock', 'Sling'] });
    expect(result).toEqual({
      hiddenLocations: ['Couch'],
      customLocations: ['Hammock', 'Sling'],
      locationOrder: ['Crib', 'Hammock'],
    });
  });

  it('treats an empty patch as a no-op', () => {
    expect(mergeLocationSettings(existing, {})).toEqual(existing);
  });

  it('ignores keys explicitly set to undefined', () => {
    const result = mergeLocationSettings(existing, {
      hiddenLocations: undefined,
      locationOrder: undefined,
    });
    expect(result).toEqual(existing);
  });

  it('resolves hiddenLocations to an array when absent from both sides', () => {
    const result = mergeLocationSettings(
      {} as SleepLocationSettings,
      { locationOrder: ['Crib'] },
    );
    expect(result).toEqual({ hiddenLocations: [], locationOrder: ['Crib'] });
  });

  it('does not mutate either input', () => {
    const before = JSON.parse(JSON.stringify(existing));
    const patch = { locationOrder: ['Hammock', 'Crib'] };
    const patchBefore = JSON.parse(JSON.stringify(patch));
    mergeLocationSettings(existing, patch);
    expect(existing).toEqual(before);
    expect(patch).toEqual(patchBefore);
  });
});
