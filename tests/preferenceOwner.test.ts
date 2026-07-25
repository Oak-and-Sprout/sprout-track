import { describe, it, expect } from 'vitest';
import { resolvePreferenceOwner } from '@/src/lib/notifications/preferenceOwner';

describe('resolvePreferenceOwner', () => {
  it('prefers the preference row\'s own owner columns (native path)', () => {
    const owner = resolvePreferenceOwner({
      caretakerId: 'care1',
      accountId: null,
      familyId: 'fam1',
      subscription: null,
    });
    expect(owner).toEqual({ caretakerId: 'care1', accountId: null, familyId: 'fam1' });
  });

  it('falls back to the subscription when the preference has no direct owner (pre-migration rows)', () => {
    const owner = resolvePreferenceOwner({
      caretakerId: null,
      accountId: null,
      familyId: null,
      subscription: { caretakerId: 'care2', accountId: null, familyId: 'fam2' },
    });
    expect(owner).toEqual({ caretakerId: 'care2', accountId: null, familyId: 'fam2' });
  });

  it('does not fall back when the preference has its own owner, even if the subscription disagrees', () => {
    // Direct columns always win — this is what lets a native preference
    // (subscription: null) resolve correctly without ever consulting subscription.
    const owner = resolvePreferenceOwner({
      caretakerId: 'care1',
      accountId: 'acct1',
      familyId: 'fam1',
      subscription: { caretakerId: 'other', accountId: 'other-acct', familyId: 'other-fam' },
    });
    expect(owner).toEqual({ caretakerId: 'care1', accountId: 'acct1', familyId: 'fam1' });
  });

  it('resolves to all-null when there is neither a direct owner nor a subscription', () => {
    const owner = resolvePreferenceOwner({});
    expect(owner).toEqual({ caretakerId: null, accountId: null, familyId: null });
  });

  it('handles the no-subscription (native) case with subscription undefined entirely', () => {
    const owner = resolvePreferenceOwner({ caretakerId: null, accountId: 'acct9', familyId: 'fam9' });
    expect(owner).toEqual({ caretakerId: null, accountId: 'acct9', familyId: 'fam9' });
  });
});
