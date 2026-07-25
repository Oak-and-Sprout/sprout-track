import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { NotificationEventType } from '@prisma/client';
import { isNotificationsEnabled } from '../../../../src/lib/notifications/config';

/**
 * Builds the OR clause that scopes a query to "things this identity owns".
 * Only includes ids that are actually present. Correction: an earlier
 * version of this comment (and this task's commit message / report) claimed
 * the sibling `id ? { id } : {}` shape used elsewhere in this codebase was a
 * live "matches every row" bug. It is not, on this repo's Prisma version
 * (6.19.2): `OR: [{}, {...}]` drops the empty object rather than treating it
 * as an unconditional match, and both `OR: []` and `OR: [{}, {}]` compile to
 * `1=0` — Prisma already fails closed. This function is a clearer,
 * behaviorally-equivalent way to build the same filter, not a fix for a
 * real leak; `app/api/notifications/subscriptions/route.ts` was left
 * untouched on that basis.
 */
export function buildOwnerFilter(
  accountId?: string | null,
  caretakerId?: string | null
): Array<{ accountId: string } | { caretakerId: string }> {
  const filter: Array<{ accountId: string } | { caretakerId: string }> = [];
  if (accountId) filter.push({ accountId });
  if (caretakerId) filter.push({ caretakerId });
  return filter;
}

/**
 * Where-clause for GET: scopes to rows owned by this identity in this
 * family. familyId is nullable on the model (see the schema/migration
 * comments — required-with-no-default can't be added to a populated
 * Postgres table via `db push`), so a legacy row (a Postgres upgrade with no
 * data-backfill step, or an SQLite row whose subscription vanished before
 * this migration's LEFT JOIN backfill ran) can have `familyId`,
 * `caretakerId`, AND `accountId` all null on the preference itself — the
 * *subscription* is the only place that still knows who owns it. So the
 * legacy branch's owner filter is evaluated against `subscription`'s
 * columns, not the preference's own (null) ones — matching against the
 * preference's own columns here would make every legacy row invisible to
 * its actual owner (confirmed empirically: a row shaped exactly like a
 * Postgres upgrade leaves it returned `[]` before this fix).
 *
 * Two things this deliberately does NOT do, both confirmed by executing the
 * query and reading the generated SQL (not by inspecting the object shape —
 * that was the mistake last round):
 *
 * 1. It does not rely on a nested `OR: []` to "fail closed" when there's no
 *    owner id at all. Verified: `OR: [{ familyId, OR: [] }]` and
 *    `{ OR: [branchA, { familyId: null, OR: [] }] }` both compile to a query
 *    with the inner `OR: []` silently DROPPED — `familyId = ?` /
 *    `familyId = ? OR familyId IS NULL`, not `1=0`. A top-level
 *    `{ familyId, OR: [] }` *does* compile to `... AND 1=0` (this is what
 *    the previous round's "M4 correction" actually verified), but a nested
 *    one does not — Prisma optimizes it away once it's inside another OR.
 *    So the no-owner-at-all case is short-circuited in plain JS instead,
 *    before any Prisma query shape is built.
 * 2. A non-empty nested OR (real ids present) is NOT dropped — verified with
 *    seeded data across two families that the two-branch query below
 *    returns exactly the caller's own row and nothing from the other
 *    family. Only the empty-array case is fragile.
 */
export function buildPreferencesWhere(args: {
  familyId: string;
  accountId?: string | null;
  caretakerId?: string | null;
}) {
  const ownerFilter = buildOwnerFilter(args.accountId, args.caretakerId);
  if (ownerFilter.length === 0) {
    // No owner id at all — nothing can be owned. `id: { in: [] }` compiles
    // to `1=0` regardless of nesting (verified), unlike an empty `OR`.
    return { id: { in: [] as string[] } };
  }
  return {
    OR: [
      { familyId: args.familyId, OR: ownerFilter },
      { familyId: null, subscription: { familyId: args.familyId, OR: ownerFilter } },
    ],
  };
}

/**
 * GET handler for notification preferences
 * Returns all preferences owned by the authenticated user in their family —
 * both web-push preferences (subscriptionId set) and native-push preferences
 * (subscriptionId null, owned directly via caretakerId/accountId).
 */
async function handleGet(req: NextRequest, authContext: AuthResult) {
  // Check if notifications are enabled
  if (!(await isNotificationsEnabled())) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    const preferences = await prisma.notificationPreference.findMany({
      where: buildPreferencesWhere({ familyId, accountId, caretakerId }),
      include: {
        subscription: {
          select: {
            id: true,
            deviceLabel: true,
            endpoint: true,
          },
        },
        baby: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return NextResponse.json<ApiResponse<typeof preferences>>({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to fetch notification preferences',
      },
      { status: 500 }
    );
  }
}

/**
 * Resolves the owner for a *native* (subscription-less) preference from
 * authContext only — never from the request body. This is the golden rule:
 * family/owner scoping comes only from the authenticated session. Returns
 * null when the session has neither identity, which the caller must treat
 * as "cannot create an owned preference" (403), not as "owned by nobody".
 */
export function nativeOwnerFromAuthContext(authContext: {
  accountId?: string | null;
  caretakerId?: string | null;
}): { accountId: string | null; caretakerId: string | null } | null {
  if (!authContext.accountId && !authContext.caretakerId) return null;
  return {
    accountId: authContext.accountId ?? null,
    caretakerId: authContext.caretakerId ?? null,
  };
}

/**
 * Where-clause for looking up an existing native preference to update.
 * subscriptionId is nullable, and two rows that are both NULL in a column
 * are NOT considered equal by a SQL unique constraint (true in both SQLite
 * and Postgres) — so uniqueness for native rows can't be enforced at the
 * database level the way the web (subscriptionId-keyed) rows are. This
 * exact-match find-then-write is the applicationlevel substitute; see the
 * task report for the residual race-condition caveat.
 */
export function buildNativePreferenceFindWhere(args: {
  familyId: string;
  babyId: string;
  eventType: NotificationEventType;
  caretakerId: string | null;
  accountId: string | null;
}) {
  return {
    subscriptionId: null,
    familyId: args.familyId,
    babyId: args.babyId,
    eventType: args.eventType,
    caretakerId: args.caretakerId,
    accountId: args.accountId,
  };
}

/**
 * PUT handler for updating notification preferences
 * Creates or updates a NotificationPreference record. `subscriptionId` is
 * optional: when present this is the original web-push path (byte-identical
 * behavior); when absent this is the native-push path, where ownership is
 * taken only from authContext (golden rule) rather than a PushSubscription.
 */
async function handlePut(req: NextRequest, authContext: AuthResult) {
  // Check if notifications are enabled
  if (!(await isNotificationsEnabled())) {
    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: 'Push notifications are disabled',
      },
      { status: 503 }
    );
  }

  try {
    const { familyId, accountId, caretakerId } = authContext;

    if (!familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'User is not associated with a family.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      subscriptionId,
      babyId,
      eventType,
      activityTypes,
      timerIntervalMinutes,
      enabled,
    } = body;

    if (!babyId || !eventType) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Missing required fields: babyId, eventType',
        },
        { status: 400 }
      );
    }

    // Web path only: verify the subscription belongs to the user's family.
    // Native (subscription-less) preferences skip this — there is no
    // PushSubscription to verify, and ownership is asserted from authContext
    // instead (below).
    let subscription: Awaited<ReturnType<typeof prisma.pushSubscription.findUnique>> = null;
    if (subscriptionId) {
      subscription = await prisma.pushSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Subscription not found',
          },
          { status: 404 }
        );
      }

      if (subscription.familyId !== familyId) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'Access denied',
          },
          { status: 403 }
        );
      }
    }

    // Verify baby belongs to user's family
    const baby = await prisma.baby.findUnique({
      where: { id: babyId },
    });

    if (!baby) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Baby not found',
        },
        { status: 404 }
      );
    }

    if (baby.familyId !== familyId) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Access denied',
        },
        { status: 403 }
      );
    }

    // Validate eventType
    if (!Object.values(NotificationEventType).includes(eventType)) {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'Invalid eventType',
        },
        { status: 400 }
      );
    }

    // Validate and parse activityTypes if provided (should be JSON string array)
    const VALID_ACTIVITY_TYPES = ['feed', 'diaper', 'sleep', 'bath', 'pump', 'medicine', 'supplement', 'play', 'note', 'milestone', 'measurement'];
    let activityTypesJson: string | null = null;
    if (activityTypes !== undefined && activityTypes !== null) {
      let activityTypesArray: string[];
      if (Array.isArray(activityTypes)) {
        activityTypesArray = activityTypes;
      } else if (typeof activityTypes === 'string') {
        // Parse JSON string
        try {
          activityTypesArray = JSON.parse(activityTypes);
          if (!Array.isArray(activityTypesArray)) {
            return NextResponse.json<ApiResponse<null>>(
              {
                success: false,
                error: 'activityTypes must be an array',
              },
              { status: 400 }
            );
          }
        } catch {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: 'Invalid activityTypes JSON format',
            },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'activityTypes must be an array or JSON string',
          },
          { status: 400 }
        );
      }

      // Validate each activity type
      for (const actType of activityTypesArray) {
        if (typeof actType !== 'string' || !VALID_ACTIVITY_TYPES.includes(actType.toLowerCase())) {
          return NextResponse.json<ApiResponse<null>>(
            {
              success: false,
              error: `Invalid activity type: ${actType}. Valid types are: ${VALID_ACTIVITY_TYPES.join(', ')}`,
            },
            { status: 400 }
          );
        }
      }

      activityTypesJson = JSON.stringify(activityTypesArray.map(t => t.toLowerCase()));
    }

    // Validate timerIntervalMinutes if provided
    const VALID_TIMER_INTERVALS = [null, 15, 30, 60, 120];
    if (timerIntervalMinutes !== undefined && timerIntervalMinutes !== null) {
      if (typeof timerIntervalMinutes !== 'number' || !VALID_TIMER_INTERVALS.includes(timerIntervalMinutes)) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: `Invalid timerIntervalMinutes. Valid values are: ${VALID_TIMER_INTERVALS.filter(v => v !== null).join(', ')}, or null`,
          },
          { status: 400 }
        );
      }
    }

    let preference;

    if (subscriptionId) {
      // Web path — byte-identical to the original upsert. The DB-level
      // unique constraint on (subscriptionId, babyId, eventType) still does
      // all the concurrency-safety work here.
      preference = await prisma.notificationPreference.upsert({
        where: {
          subscriptionId_babyId_eventType: {
            subscriptionId,
            babyId,
            eventType,
          },
        },
        create: {
          subscriptionId,
          babyId,
          eventType,
          activityTypes: activityTypesJson,
          timerIntervalMinutes: timerIntervalMinutes ?? null,
          enabled: enabled !== undefined ? enabled : true,
          // Stamp the owner directly too, so a preference is self-describing
          // even before resolvePreferenceOwner() falls back to it (native
          // rows, or if this row's subscription is ever deleted out from
          // under it). subscription is guaranteed non-null here (fetched and
          // verified above). resolvePreferenceOwner() itself always prefers
          // the live subscription when present, so this stamp is a fallback
          // snapshot, not the value actually read on the hot path.
          caretakerId: subscription!.caretakerId,
          accountId: subscription!.accountId,
          familyId: subscription!.familyId,
        },
        update: {
          activityTypes: activityTypesJson !== undefined ? activityTypesJson : undefined,
          timerIntervalMinutes: timerIntervalMinutes !== undefined ? timerIntervalMinutes : undefined,
          enabled: enabled !== undefined ? enabled : undefined,
          // Re-stamp on every write too, so the snapshot self-heals if the
          // subscription's owner changed since this row was created (shared
          // tablet, PIN switch) instead of drifting forever. GET's owner
          // scoping reads these columns directly (not through
          // resolvePreferenceOwner, which needs a live subscription include
          // it doesn't fetch), so a stale snapshot there would make a
          // legitimately-reassigned subscription's preferences invisible to
          // its new owner until the next PUT.
          caretakerId: subscription!.caretakerId,
          accountId: subscription!.accountId,
          familyId: subscription!.familyId,
        },
      });
    } else {
      // Native path — ownership comes only from authContext (golden rule),
      // never from the request body.
      const owner = nativeOwnerFromAuthContext(authContext);
      if (!owner) {
        return NextResponse.json<ApiResponse<null>>(
          {
            success: false,
            error: 'User is not associated with an account or caretaker.',
          },
          { status: 403 }
        );
      }

      const existing = await prisma.notificationPreference.findFirst({
        where: buildNativePreferenceFindWhere({
          familyId,
          babyId,
          eventType,
          caretakerId: owner.caretakerId,
          accountId: owner.accountId,
        }),
      });

      if (existing) {
        preference = await prisma.notificationPreference.update({
          where: { id: existing.id },
          data: {
            activityTypes: activityTypesJson !== undefined ? activityTypesJson : undefined,
            timerIntervalMinutes: timerIntervalMinutes !== undefined ? timerIntervalMinutes : undefined,
            enabled: enabled !== undefined ? enabled : undefined,
          },
        });
      } else {
        preference = await prisma.notificationPreference.create({
          data: {
            babyId,
            eventType,
            activityTypes: activityTypesJson,
            timerIntervalMinutes: timerIntervalMinutes ?? null,
            enabled: enabled !== undefined ? enabled : true,
            caretakerId: owner.caretakerId,
            accountId: owner.accountId,
            familyId,
          },
        });
      }
    }

    return NextResponse.json<ApiResponse<typeof preference>>({
      success: true,
      data: preference,
    });
  } catch (error: any) {
    console.error('Error updating notification preference:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json<ApiResponse<null>>(
        {
          success: false,
          error: 'A preference with this combination already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiResponse<null>>(
      {
        success: false,
        error: error.message || 'Failed to update notification preference',
      },
      { status: 500 }
    );
  }
}

export const GET = withAuthContext(handleGet);
export const PUT = withAuthContext(handlePut);
