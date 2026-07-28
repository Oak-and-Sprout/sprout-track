import { describe, it, expect } from 'vitest';
import { resolvePreferenceOwner } from '@/src/lib/notifications/preferenceOwner';

describe('resolvePreferenceOwner', () => {
  it('prefers the subscription when present, even if the preference has its own (stale) owner columns', () => {
    // The subscription is live; the preference's own columns are a
    // write-time snapshot. POST /api/notifications/subscribe re-stamps
    // ownership on an existing endpoint (shared tablet, PIN switch), so a
    // preference row can go stale while the subscription stays current.
    // Subscription must win for a web row to keep byte-identical behavior.
    const owner = resolvePreferenceOwner({
      caretakerId: 'stale-caretaker',
      accountId: 'stale-account',
      familyId: 'stale-fam',
      subscription: { caretakerId: 'care1', accountId: null, familyId: 'fam1' },
    });
    expect(owner).toEqual({ caretakerId: 'care1', accountId: null, familyId: 'fam1' });
  });

  it('falls back to the preference row\'s own owner columns when there is no subscription (native path)', () => {
    const owner = resolvePreferenceOwner({
      caretakerId: 'care1',
      accountId: null,
      familyId: 'fam1',
      subscription: null,
    });
    expect(owner).toEqual({ caretakerId: 'care1', accountId: null, familyId: 'fam1' });
  });

  it('resolves to all-null when there is neither a subscription nor a direct owner', () => {
    const owner = resolvePreferenceOwner({});
    expect(owner).toEqual({ caretakerId: null, accountId: null, familyId: null });
  });

  it('handles the no-subscription (native) case with subscription undefined entirely', () => {
    const owner = resolvePreferenceOwner({ caretakerId: null, accountId: 'acct9', familyId: 'fam9' });
    expect(owner).toEqual({ caretakerId: null, accountId: 'acct9', familyId: 'fam9' });
  });

  it('treats a present-but-empty subscription owner as null rather than falling through to the preference columns', () => {
    // A live subscription with no owner (shouldn't normally happen, but
    // defensive: presence of `subscription` alone determines which source
    // is used) still wins over the preference's own columns.
    const owner = resolvePreferenceOwner({
      caretakerId: 'care1',
      accountId: null,
      familyId: 'fam1',
      subscription: { caretakerId: null, accountId: null, familyId: null },
    });
    expect(owner).toEqual({ caretakerId: null, accountId: null, familyId: null });
  });
});
