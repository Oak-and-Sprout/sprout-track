import { describe, it, expect } from 'vitest';
import { favoriteOwnerFilter } from '@/app/api/photos/photo-service';
import type { AuthResult } from '@/app/api/utils/auth';

const auth = (over: Partial<AuthResult>): AuthResult => ({ authenticated: true, ...over });

describe('favoriteOwnerFilter', () => {
  it('keys favorites to the caretaker when there is one', () => {
    expect(favoriteOwnerFilter(auth({ caretakerId: 'ct-1' }))).toEqual({ caretakerId: 'ct-1' });
  });

  it('prefers caretaker identity over account identity', () => {
    expect(favoriteOwnerFilter(auth({ caretakerId: 'ct-1', accountId: 'acct-1' })))
      .toEqual({ caretakerId: 'ct-1' });
  });

  it('falls back to the account when there is no caretaker', () => {
    expect(favoriteOwnerFilter(auth({ accountId: 'acct-1' }))).toEqual({ accountId: 'acct-1' });
  });

  it('attributes sysadmin favorites to the family system caretaker', () => {
    expect(favoriteOwnerFilter(auth({ isSysAdmin: true, familyId: 'fam-1' }), 'sys-ct-1'))
      .toEqual({ caretakerId: 'sys-ct-1' });
  });

  it('returns null for a sysadmin whose family has no system caretaker', () => {
    expect(favoriteOwnerFilter(auth({ isSysAdmin: true, familyId: 'fam-1' }), null)).toBeNull();
    expect(favoriteOwnerFilter(auth({ isSysAdmin: true, familyId: 'fam-1' }))).toBeNull();
  });

  it('never lends the system caretaker to a non-sysadmin with no identity', () => {
    expect(favoriteOwnerFilter(auth({ familyId: 'fam-1' }), 'sys-ct-1')).toBeNull();
  });

  it('returns null when there is no identity at all', () => {
    expect(favoriteOwnerFilter(auth({}))).toBeNull();
    expect(favoriteOwnerFilter(auth({ caretakerId: null, accountId: undefined }))).toBeNull();
  });
});
