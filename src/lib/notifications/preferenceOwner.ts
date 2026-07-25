/**
 * Resolves who a NotificationPreference belongs to.
 *
 * Historically every preference hung off a PushSubscription (web push only),
 * so `subscription.{caretakerId,accountId}` was the only place to look. Native
 * push preferences have no subscription (WKWebView / Android System WebView
 * can't register one), so the owner now also lives directly on the
 * preference row. This function is the single place that reconciles the two:
 * the preference's own columns win, falling back to the subscription's for
 * pre-migration rows that predate the direct columns being populated.
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
  return {
    caretakerId: pref.caretakerId ?? pref.subscription?.caretakerId ?? null,
    accountId: pref.accountId ?? pref.subscription?.accountId ?? null,
    familyId: pref.familyId ?? pref.subscription?.familyId ?? null,
  };
}
