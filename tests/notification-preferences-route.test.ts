import { describe, it, expect } from 'vitest';
import {
  buildOwnerFilter,
  buildPreferencesWhere,
  nativeOwnerFromAuthContext,
  buildNativePreferenceFindWhere,
} from '@/app/api/notifications/preferences/route';
import { NotificationEventType } from '@prisma/client';

describe('buildOwnerFilter', () => {
  it('includes only the ids that are actually present', () => {
    expect(buildOwnerFilter('acct1', undefined)).toEqual([{ accountId: 'acct1' }]);
    expect(buildOwnerFilter(undefined, 'care1')).toEqual([{ caretakerId: 'care1' }]);
    expect(buildOwnerFilter('acct1', 'care1')).toEqual([
      { accountId: 'acct1' },
      { caretakerId: 'care1' },
    ]);
  });

  it('fails closed (empty OR, matches nothing) when neither id is present', () => {
    // Not a bug fix — on this repo's Prisma version, `id ? { id } : {}`
    // already fails closed too (Prisma drops the empty object rather than
    // treating it as an unconditional match). This is just a clearer,
    // behaviorally-equivalent shape for building the same filter.
    expect(buildOwnerFilter(undefined, undefined)).toEqual([]);
    expect(buildOwnerFilter(null, null)).toEqual([]);
  });
});

describe('buildPreferencesWhere', () => {
  it('matches rows whose own familyId is set (the normal, post-migration case)', () => {
    const where = buildPreferencesWhere({ familyId: 'fam1', caretakerId: 'care1' });
    expect(where).toEqual({
      OR: [
        { familyId: 'fam1', OR: [{ caretakerId: 'care1' }] },
        { familyId: null, subscription: { familyId: 'fam1' }, OR: [{ caretakerId: 'care1' }] },
      ],
    });
  });

  it('the second branch also requires the owner filter, not just a matching subscription family', () => {
    // Legacy rows (familyId: null) must still be scoped to the caller's
    // own ownership, not just "anyone in the right family via subscription".
    const where = buildPreferencesWhere({ familyId: 'fam1', accountId: 'acct1' });
    const legacyBranch = where.OR[1] as { OR: unknown };
    expect(legacyBranch.OR).toEqual([{ accountId: 'acct1' }]);
  });

  it('fails closed when the session has no owner id at all', () => {
    const where = buildPreferencesWhere({ familyId: 'fam1' });
    expect(where.OR[0]).toEqual({ familyId: 'fam1', OR: [] });
    expect(where.OR[1]).toEqual({ familyId: null, subscription: { familyId: 'fam1' }, OR: [] });
  });
});

describe('nativeOwnerFromAuthContext', () => {
  it('returns the owner when authContext has a caretakerId', () => {
    expect(nativeOwnerFromAuthContext({ caretakerId: 'care1', accountId: undefined })).toEqual({
      caretakerId: 'care1',
      accountId: null,
    });
  });

  it('returns the owner when authContext has an accountId', () => {
    expect(nativeOwnerFromAuthContext({ accountId: 'acct1', caretakerId: undefined })).toEqual({
      caretakerId: null,
      accountId: 'acct1',
    });
  });

  it('returns both when an account-linked caretaker has both set', () => {
    expect(nativeOwnerFromAuthContext({ accountId: 'acct1', caretakerId: 'care1' })).toEqual({
      caretakerId: 'care1',
      accountId: 'acct1',
    });
  });

  it('returns null when authContext has neither — caller must 403, not create an ownerless row', () => {
    expect(nativeOwnerFromAuthContext({})).toBeNull();
    expect(nativeOwnerFromAuthContext({ accountId: null, caretakerId: null })).toBeNull();
  });
});

describe('buildNativePreferenceFindWhere', () => {
  it('always scopes to subscriptionId: null so it can never match a web-owned row', () => {
    const where = buildNativePreferenceFindWhere({
      familyId: 'fam1',
      babyId: 'baby1',
      eventType: NotificationEventType.ACTIVITY_CREATED,
      caretakerId: 'care1',
      accountId: null,
    });
    expect(where.subscriptionId).toBeNull();
    expect(where).toEqual({
      subscriptionId: null,
      familyId: 'fam1',
      babyId: 'baby1',
      eventType: NotificationEventType.ACTIVITY_CREATED,
      caretakerId: 'care1',
      accountId: null,
    });
  });
});
