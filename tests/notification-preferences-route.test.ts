import { describe, it, expect } from 'vitest';
import {
  buildOwnerFilter,
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
    // The bug this guards against: `id ? { id } : {}` puts an unconditional
    // `{}` into the OR array, which matches every row in the family
    // regardless of owner. An empty array has no such trap — Prisma treats
    // `OR: []` as "match nothing".
    expect(buildOwnerFilter(undefined, undefined)).toEqual([]);
    expect(buildOwnerFilter(null, null)).toEqual([]);
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
