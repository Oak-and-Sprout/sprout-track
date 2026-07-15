/**
 * Decide whether the root page (`/`) should bounce an installed PWA back to
 * the last-used family. When the OS kills a PWA whose start_url is `/` (the
 * static manifest identity), relaunch lands on the marketing/root page; in a
 * chrome-less standalone window there is no URL bar to recover the family.
 * This guard sends the user straight back to `/${slug}` (issue #209 follow-up).
 *
 * Pure so it can be unit-tested without a browser; the caller supplies the
 * standalone flag, the raw `selectedFamily` localStorage string, and the
 * once-per-session loop-guard flag.
 */
export interface RootRedirectParams {
  isStandalone: boolean;
  storedFamilyJson: string | null;
  alreadyBounced: boolean;
}

export function resolveRootRedirect({
  isStandalone,
  storedFamilyJson,
  alreadyBounced,
}: RootRedirectParams): { redirectTo: string | null } {
  if (!isStandalone || alreadyBounced || !storedFamilyJson) {
    return { redirectTo: null };
  }
  try {
    const parsed = JSON.parse(storedFamilyJson);
    const slug =
      parsed && typeof parsed.slug === 'string' ? parsed.slug.trim() : '';
    if (!slug) return { redirectTo: null };
    return { redirectTo: `/${slug}` };
  } catch {
    return { redirectTo: null };
  }
}
