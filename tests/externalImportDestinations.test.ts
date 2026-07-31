import { describe, expect, it } from 'vitest';
import { findSharedChildDestinations } from '../src/components/ExternalImport/destination-utils';

describe('findSharedChildDestinations', () => {
  it('returns babies targeted by more than one source child', () => {
    expect(
      findSharedChildDestinations({
        '1': { mode: 'existing', targetBabyId: 'baby-a' },
        '2': { mode: 'existing', targetBabyId: 'baby-a' },
        '3': { mode: 'existing', targetBabyId: 'baby-b' },
      }),
    ).toEqual([{ targetBabyId: 'baby-a', count: 2 }]);
  });

  it('ignores new-baby destinations and empty targets', () => {
    expect(
      findSharedChildDestinations({
        '1': { mode: 'new', gender: 'FEMALE' },
        '2': { mode: 'new', gender: 'FEMALE' },
        '3': { mode: 'existing', targetBabyId: '' },
        '4': { mode: 'existing', targetBabyId: '' },
      }),
    ).toEqual([]);
  });

  it('returns an empty list when destinations are unique', () => {
    expect(
      findSharedChildDestinations({
        '1': { mode: 'existing', targetBabyId: 'baby-a' },
        '2': { mode: 'existing', targetBabyId: 'baby-b' },
      }),
    ).toEqual([]);
  });

  it('counts three or more children mapped to one baby', () => {
    expect(
      findSharedChildDestinations({
        '1': { mode: 'existing', targetBabyId: 'baby-a' },
        '2': { mode: 'existing', targetBabyId: 'baby-a' },
        '3': { mode: 'existing', targetBabyId: 'baby-a' },
      }),
    ).toEqual([{ targetBabyId: 'baby-a', count: 3 }]);
  });
});
