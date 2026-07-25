/**
 * Resolves who a NotificationPreference belongs to.
 *
 * Historically every preference hung off a PushSubscription (web push only),
 * so `subscription.{caretakerId,accountId}` was the only place to look. Native
 * push preferences have no subscription (WKWebView / Android System WebView
 * can't register one), so the owner now also lives directly on the
 * preference row. This function is the single place that reconciles the two.
 *
 * The subscription is authoritative when present, not the preference's own
 * columns — ownership on a PushSubscription can legitimately change after a
 * preference was created (POST /api/notifications/subscribe re-stamps
 * accountId/caretakerId on an existing endpoint, e.g. a shared family
 * tablet or a PIN switch reusing the same browser). The preference's own
 * columns are a write-time snapshot that can go stale; the subscription is
 * live. Falling back to the snapshot only when there's no subscription at
 * all (the native path, or a legacy pre-migration row where the columns
 * were never populated) preserves byte-identical behavior for every web row
 * — this is exactly what the code read before this feature existed.
 */

export interface PreferenceOwnerSource {
  caretakerId?: string | null;
  accountId?: string | null;
  familyId?: string | null;
  subscription?: {
    caretakerId?: string | null;
    accountId?: string | null;
    familyId?: string | null;
  } | null;
}

export interface PreferenceOwner {
  caretakerId: string | null;
  accountId: string | null;
  familyId: string | null;
}

export function resolvePreferenceOwner(pref: PreferenceOwnerSource): PreferenceOwner {
  if (pref.subscription) {
    return {
      caretakerId: pref.subscription.caretakerId ?? null,
      accountId: pref.subscription.accountId ?? null,
      familyId: pref.subscription.familyId ?? null,
    };
  }
  return {
    caretakerId: pref.caretakerId ?? null,
    accountId: pref.accountId ?? null,
    familyId: pref.familyId ?? null,
  };
}

/**
 * Stable key for deduping native push sends per distinct owner. A user with
 * both a web preference and a native preference for the same baby+eventType
 * (the browser-to-app upgrade path this feature targets) produces two
 * preference rows resolving to the same owner — sendToDeviceTokens must
 * still fire only once per owner per notification, since it targets every
 * DeviceToken for that owner regardless of which preference row triggered
 * it. Returns null when there is no owner at all (nothing to dedupe or send
 * to).
 */
export function nativeOwnerKey(owner: PreferenceOwner): string | null {
  if (!owner.caretakerId && !owner.accountId) return null;
  return `${owner.caretakerId ?? ''}|${owner.accountId ?? ''}`;
}
