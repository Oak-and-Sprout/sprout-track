export interface FamilyScopeAuth {
  familyId?: string | null;
  isSysAdmin?: boolean;
}

export type FamilyScopeResult =
  | { ok: true; familyId: string }
  | { ok: false; status: 400 | 403; error: string };

/**
 * Resolves the family an authenticated request may act on, enforcing the golden
 * rule that only sysadmins act across families.
 *
 * `auth.familyId` is the authority: withAuthContext resolves it from the account
 * (live), the caretaker row, or a validated setup token before any handler runs.
 * A client-supplied `requestedFamilyId` may only CONFIRM it, never override it.
 */
export function resolveFamilyScope(
  auth: FamilyScopeAuth,
  requestedFamilyId: string | null | undefined,
): FamilyScopeResult {
  if (auth.isSysAdmin) {
    const target = requestedFamilyId ?? auth.familyId ?? null;
    if (!target) {
      return { ok: false, status: 400, error: 'System administrators must specify a familyId.' };
    }
    return { ok: true, familyId: target };
  }
  if (!auth.familyId) {
    return { ok: false, status: 403, error: 'User is not associated with a family.' };
  }
  if (requestedFamilyId && requestedFamilyId !== auth.familyId) {
    return { ok: false, status: 403, error: 'Not authorized for this family.' };
  }
  return { ok: true, familyId: auth.familyId };
}
