/**
 * Routes where an UNBOUND setup token (familyId still null) is allowed to name
 * the family it targets. Keep this list minimal — only the pre-provisioning
 * route(s) that legitimately create/bind a family for a fresh invite token.
 */
const UNBOUND_TOKEN_ALLOWED_PATHS = new Set<string>(['/api/setup/start']);

/**
 * Pure policy check for whether a setup token may act on `requestedFamilyId`.
 *
 * - A token already bound to a family may only target that same family,
 *   regardless of route.
 * - An unbound token (no family assigned yet) may target an arbitrary
 *   `requestedFamilyId` ONLY on the allowlisted pre-provisioning route(s)
 *   above, where naming a not-yet-existing family is the whole point of the
 *   request. On every other route an unbound token must not be able to claim
 *   any family.
 */
export function setupTokenMayTarget(
  token: { familyId: string | null },
  requestedFamilyId: string,
  pathname: string,
): boolean {
  if (token.familyId) {
    return token.familyId === requestedFamilyId;
  }
  return UNBOUND_TOKEN_ALLOWED_PATHS.has(pathname);
}
