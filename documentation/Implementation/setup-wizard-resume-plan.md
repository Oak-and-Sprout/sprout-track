# Setup Wizard Authorization & Resumable Setup

## Problem

Navigating to `/{slug}` for a family with no babies shows the full SetupWizard to **any authenticated user** — not just the family owner. The trigger in `app/(app)/[slug]/layout.tsx:228` is simply `activeBabies.length === 0`. This causes:

1. **Any authenticated user** who reaches a family slug with no babies sees the setup wizard — even unauthorized users
2. **The setup wizard allows creating NEW family slugs** through FamilySetupStage
3. **The wizard renders inside the main app layout** with sidebar/header — poor UX for a setup flow
4. **No persistent setup state** — if a user leaves mid-setup, all progress is lost
5. **Token-based setup tokens are invalidated after Stage 1** — the user can't resume via their original token link

## Goals

1. Only authorized users (account owner, sysadmin, family admin) can access setup on `/{slug}`
2. Unauthorized users are redirected to `/`
3. Setup resumes from the correct stage with pre-filled data (skip Stage 1 since family already exists)
4. Add `setupStage` integer to Family model to explicitly track progress (0–3)
5. Dedicated `/{slug}/resume-setup` page without sidebar/header for a clean setup experience
6. Token-based setup keeps the token valid until setup completes — user can re-authenticate at `/setup/[token]` throughout the entire flow
7. All auth types save security settings immediately in Stage 2 (remove deferral) so data persists across page refreshes

## Schema Change

**File:** `prisma/schema.prisma`

Add to Family model:
```prisma
setupStage Int @default(0) // 0=not started, 1=family created, 2=security configured, 3=complete
```

**Stage values:**
- `0` = fresh/not started (default "my-family" on initial install)
- `1` = family created (wizard Stage 1 done)
- `2` = security configured (wizard Stage 2 done)
- `3` = setup complete (baby created)

**Migration backfill:**
```sql
-- Families with active babies are fully set up
UPDATE Family SET setupStage = 3
  WHERE id IN (SELECT DISTINCT familyId FROM Baby WHERE inactive = 0 AND familyId IS NOT NULL);
-- Families that exist but have no babies are at stage 1
UPDATE Family SET setupStage = 1
  WHERE setupStage = 0
  AND id NOT IN (SELECT DISTINCT familyId FROM Baby WHERE inactive = 0 AND familyId IS NOT NULL);
```

## New API: `GET /api/family/setup-status`

**New file:** `app/api/family/setup-status/route.ts`

Uses `withAuthContext`. Returns setup status for the current user's family:

```typescript
{
  success: true,
  data: {
    setupStage: number,        // 0-3 from Family.setupStage
    canSetup: boolean,         // true if account owner, sysadmin, or family admin
    currentStage: 2 | 3,      // next wizard stage to show: Math.max(setupStage + 1, 2)
    familyData: {
      id: string,
      name: string,
      slug: string,
      authType: string | null,
      securityPin: string | null,
      caretakers: Array<{
        loginId: string,
        name: string,
        type: string,
        role: 'ADMIN' | 'USER',
        securityPin: string,
      }>,
    }
  }
}
```

**Authorization logic (`canSetup`):**
- Account owner: `family.accountId` matches `authContext.accountId`
- SysAdmin: `authContext.isSysAdmin === true`
- Family admin caretaker: `authContext.caretakerRole === 'ADMIN'` and belongs to this family
- Everyone else: `false`

**Pre-fill data:**
- Fetches non-system caretakers (`loginId !== '00'`, `deletedAt: null`) for pre-filling Stage 2
- Fetches `securityPin` and `authType` from family Settings record

## New API: `PUT /api/family/update-setup-stage`

**New file:** `app/api/family/update-setup-stage/route.ts`

Uses `withAuthContext`. Accepts `{ setupStage: number, familyId: string }`. Only allows incrementing (can't go backwards). Used by the wizard after completing each stage.

## Token Auth: Keep Token Valid Until Setup Complete

**File:** `app/api/auth/token/route.ts`

Currently (line 49) rejects tokens where `familyId` is set ("already been used"). Change to only reject when `family.setupStage >= 3`:

```typescript
// OLD
if (setupToken.familyId) {
  return NextResponse.json({ error: 'Setup token has already been used' }, { status: 409 });
}

// NEW
if (setupToken.familyId) {
  const family = await prisma.family.findUnique({ where: { id: setupToken.familyId } });
  if (family && family.setupStage >= 3) {
    return NextResponse.json({ error: 'Setup token has already been used' }, { status: 409 });
  }
}
```

Include `familyId` in the JWT when the token has a linked family:
```typescript
const authToken = jwt.sign({
  setupToken: token,
  isSetupAuth: true,
  familyId: setupToken.familyId || null,
  exp: Math.floor(expiresAt / 1000),
}, jwtSecret);
```

**File:** `app/setup/[token]/page.tsx`

When re-authenticating with a token that has a linked family, redirect to `/{slug}/resume-setup` instead of showing the fresh setup wizard.

## Setup Start: Set `setupStage: 1`

**File:** `app/api/setup/start/route.ts`

In all family creation scenarios, set `setupStage: 1` on the new Family record:
```typescript
const family = await tx.family.create({
  data: { name, slug, isActive: true, setupStage: 1 },
});
```

## Baby Creation: Set `setupStage: 3`

**Files:** `app/api/baby/create/route.ts` and `app/api/baby/route.ts`

After successfully creating a baby, mark setup as complete:
```typescript
if (family && family.setupStage < 3) {
  await prisma.family.update({
    where: { id: familyId },
    data: { setupStage: 3 },
  });
}
```

## Layout Change: Redirect Instead of Inline Wizard

**File:** `app/(app)/[slug]/layout.tsx`

Replace line 228 (`setShowSetup(activeBabies.length === 0)`) with:

```typescript
if (activeBabies.length === 0) {
  const setupResponse = await fetch('/api/family/setup-status', {
    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
  });
  if (setupResponse.ok) {
    const setupData = await setupResponse.json();
    if (setupData.success && setupData.data.setupStage < 3) {
      if (setupData.data.canSetup) {
        router.push(`/${familySlug}/resume-setup`);
        return;
      } else {
        router.push('/');
        return;
      }
    }
  }
}
setShowSetup(false);
```

Remove `showSetup` state, `setupStatus` state, `<SetupWizard>` import, and the inline wizard JSX. The wizard is no longer rendered inside the app layout.

## New Route Group: `(setup-resume)`

**New file:** `app/(setup-resume)/layout.tsx`

Minimal layout with providers only — no sidebar, no header. Follows the `(auth)` layout pattern:

```tsx
import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import { DeploymentProvider } from '@/app/context/deployment';

export default function SetupResumeLayout({ children }: { children: React.ReactNode }) {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <DeploymentProvider>
          {children}
        </DeploymentProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
```

**New file:** `app/(setup-resume)/[slug]/resume-setup/page.tsx`

Client component that:
1. Validates the family slug (redirect to `/` if invalid)
2. Checks authentication (redirect to `/{slug}` login if not authenticated)
3. Fetches `GET /api/family/setup-status`
4. If `setupStage >= 3` → redirect to `/{slug}/log-entry`
5. If `canSetup === false` → redirect to `/`
6. Otherwise → render `<SetupWizard>` full-screen with `resumeStage` and `familyData` props
7. On completion → redirect to `/{slug}/log-entry`

## SetupWizard Component Changes

### New Props

**File:** `src/components/SetupWizard/setup-wizard.types.ts`

```typescript
resumeStage?: number;
familyData?: {
  id: string;
  name: string;
  slug: string;
  authType: string | null;
  securityPin: string | null;
  caretakers: Array<{
    loginId: string;
    name: string;
    type: string;
    role: 'ADMIN' | 'USER';
    securityPin: string;
  }>;
};
```

### State Initialization from Props

**File:** `src/components/SetupWizard/index.tsx`

When `familyData` is provided (resuming):
- `minStage = 2` (skip Stage 1, allow navigating between 2 and 3)
- `stage` initialized from `resumeStage` prop
- `createdFamily` initialized from `familyData` (id, name, slug)
- `useSystemPin` set based on `familyData.authType`
- `systemPin`/`confirmSystemPin` pre-filled from `familyData.securityPin`
- `caretakers` array pre-filled from `familyData.caretakers`
- Show "Completing setup for **Family Name**" banner

### Remove Stage 2 Deferral

The current code defers saving caretakers/security in Stage 2 for token and account auth. This is unnecessarily cautious — both auth types use JWTs that are handled independently of authType/PIN settings in `getAuthenticatedUser()`.

**Remove:** The `if (token || isAccountAuth()) { setStage(3); return; }` guards (~lines 169-176 and 224-231)

**Remove:** Stage 3's duplicate caretaker/security save logic (~lines 295-425)

All auth types now save security settings immediately in Stage 2. Stage 3 only saves the baby and handles account-caretaker linking.

### Stage 2 Completion → Update `setupStage`

After Stage 2 saves successfully, call the new `update-setup-stage` endpoint:
```typescript
await fetch('/api/family/update-setup-stage', {
  method: 'PUT',
  headers: getAuthHeaders(),
  body: JSON.stringify({ setupStage: 2, familyId: createdFamily?.id }),
});
```

## Files Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `setupStage Int @default(0)` to Family |
| `app/api/family/setup-status/route.ts` | **New.** GET endpoint — setup status, auth check, caretaker/security data |
| `app/api/family/update-setup-stage/route.ts` | **New.** PUT endpoint — increment `setupStage` |
| `app/api/baby/create/route.ts` | Set `setupStage = 3` after baby creation |
| `app/api/baby/route.ts` | Set `setupStage = 3` after baby creation |
| `app/api/setup/start/route.ts` | Set `setupStage: 1` on family creation |
| `app/api/auth/token/route.ts` | Keep token valid until `setupStage >= 3`; include `familyId` in JWT |
| `app/setup/[token]/page.tsx` | Redirect to `/{slug}/resume-setup` if token has linked incomplete family |
| `app/(app)/[slug]/layout.tsx` | Replace inline wizard with redirect to `/{slug}/resume-setup`; remove `showSetup` state |
| `app/(setup-resume)/layout.tsx` | **New.** Minimal layout — providers only, no sidebar/header |
| `app/(setup-resume)/[slug]/resume-setup/page.tsx` | **New.** Dedicated resume-setup page |
| `src/components/SetupWizard/setup-wizard.types.ts` | Add `resumeStage` and `familyData` props |
| `src/components/SetupWizard/index.tsx` | Remove deferral, pre-fill Stage 2, call `update-setup-stage`, support resume |

## Resume Flows by Auth Type

| Auth Type | Stage 1 done, left before Stage 2 | Stage 2 done, left before Stage 3 |
|-----------|-----------------------------------|-----------------------------------|
| **SaaS account** | `/{slug}` → account login → redirect to `/{slug}/resume-setup` at Stage 2 | Same, wizard at Stage 3 |
| **Token (self-hosted)** | `/setup/[token]` → token password → redirect to `/{slug}/resume-setup` at Stage 2 (token stays valid until `setupStage = 3`) | Same, wizard at Stage 3 |
| **SysAdmin** | `/{slug}` → admin login → redirect to `/{slug}/resume-setup` at Stage 2 | Same, wizard at Stage 3 |

## Verification

1. **Migration:** `setupStage` column added with backfill — families with babies → 3, families without → 1
2. **Unauthorized user:** Log in as user from Family A, navigate to incomplete Family B slug → redirects to `/`
3. **Resume (SaaS):** Account owner with incomplete family → `/{slug}` → redirects to `/{slug}/resume-setup` → clean wizard (no sidebar/header) at Stage 2+
4. **Resume (token):** Token user completed Stage 1 → `/setup/[token]` → token password → redirects to `/{slug}/resume-setup` at Stage 2. Token stays valid until `setupStage = 3`
5. **Resume (admin):** SysAdmin → `/{slug}` → admin login → redirects to `/{slug}/resume-setup` at Stage 2+
6. **Pre-fill:** Complete Stages 1 and 2 → refresh → `/{slug}/resume-setup` → wizard at Stage 3, go back → Stage 2 shows existing caretakers/PIN
7. **Account/token regression:** Complete full setup → verify caretakers created, account-caretaker linking works
8. **Complete setup:** Finish wizard → baby created, `setupStage = 3`, redirects to `/{slug}/log-entry`
9. **All babies inactive:** Family with `setupStage = 3` but all babies deactivated → does NOT show wizard or redirect to resume-setup
10. **Existing flows:** `/setup`, `/setup/[token]`, `/account/family-setup` still work for fresh setups
