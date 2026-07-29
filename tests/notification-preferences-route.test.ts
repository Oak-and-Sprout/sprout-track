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
  // These are shape/unit checks on the implementation choice, not proof of
  // query behavior — Prisma's handling of nested OR arrays is exactly the
  // thing an object-shape assertion got wrong last round (see the doc
  // comment on buildPreferencesWhere). The actual behavioral proof — real
  // rows in, real rows out, against the real generated SQL — lives in
  // tests/notification-preferences-legacy-owner.test.ts.

  it('matches rows whose own familyId is set (the normal, post-migration case)', () => {
    const where = buildPreferencesWhere({ familyId: 'fam1', caretakerId: 'care1' });
    expect(where).toEqual({
      OR: [
        { familyId: 'fam1', OR: [{ caretakerId: 'care1' }] },
        { familyId: null, subscription: { familyId: 'fam1', OR: [{ caretakerId: 'care1' }] } },
      ],
    });
  });

  it("the legacy branch's owner filter is nested inside `subscription`, not the preference's own columns", () => {
    // This is the exact shape Finding 1 was about: checking the owner
    // filter against the preference row's own (null, for a legacy row)
    // caretakerId/accountId instead of the subscription's would make every
    // legacy row invisible to its real owner.
    const where = buildPreferencesWhere({ familyId: 'fam1', accountId: 'acct1' }) as {
      OR: [unknown, { subscription: { OR: unknown } }];
    };
    expect(where.OR[1].subscription.OR).toEqual([{ accountId: 'acct1' }]);
  });

  it('short-circuits to a sentinel that cannot match anything when the session has no owner id at all', () => {
    // `id: { in: [] }` is used deliberately instead of a nested `OR: []` —
    // verified by executing the query that a nested empty OR gets dropped
    // (see doc comment), while `id: { in: [] }` compiles to `1=0`
    // regardless of nesting. This test only pins that this function reaches
    // for that shape, not that it works — the integration test proves it
    // works.
    const where = buildPreferencesWhere({ familyId: 'fam1' });
    expect(where).toEqual({ id: { in: [] } });
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
