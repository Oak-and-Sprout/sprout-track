# Authentication and Authorization

## Overview

Sprout Track supports two authentication paths: PIN-based caretaker auth (for self-hosted/simple setups) and account-based email/password auth (for SaaS mode). Both produce JWT tokens. All API authorization flows through middleware wrappers in `app/api/utils/auth.ts`, with family-level data scoping as the foundational security principle.

## Authentication Paths

### 1. PIN-Based (Caretaker Auth)
Used for self-hosted deployments and families without accounts.

**Flow:**
1. User enters family slug + two-digit login ID + security PIN
2. `POST /api/auth` validates credentials against `Caretaker` table
3. Server returns JWT containing: caretaker ID, name, type, role, familyId, familySlug
4. Client stores JWT in `localStorage` as `authToken`

**System Caretaker (loginId '00'):**
- Auto-created per family when no regular caretakers exist
- Authenticated via the family's `Settings.securityPin`
- Once regular caretakers are configured, the system caretaker is automatically disabled
- Granted admin-level access (`withAdminAuth` allows system caretakers)

### 2. Account-Based (Email/Password Auth)
Used for SaaS mode with individual user accounts.

**Flow:**
1. User registers via `/api/accounts/register` (email, password, name)
2. Verification email sent; user verifies via `/api/accounts/verify`
3. Login via `/api/accounts/login` with email + password
4. Server returns JWT with `isAccountAuth: true`, accountId, accountEmail
5. On each request, server fetches fresh account + linked caretaker from database

**Key difference:** Account JWTs trigger a database lookup on every request to get current family/caretaker associations, since these can change after the JWT was issued (e.g., during initial family setup).

### 3. Setup Authentication
Token-based auth for invited users creating a new family:
- Admin creates setup invite via `/api/family/create-setup-link`
- `FamilySetup` record created with token, hashed password, expiration
- Invited user authenticates with token + password
- JWT includes `isSetupAuth: true` and `setupToken`
- Grants admin privileges for family creation only

## Token Architecture

### Access Token (JWT)
- Stored in `localStorage` as `authToken`
- Sent via `Authorization: Bearer <token>` header
- Lifetime: `AUTH_LIFE` env var (default 1800 seconds / 30 minutes)
- Signed with `JWT_SECRET` env var

### Refresh Token
- Stored as HTTP-only cookie (`refreshToken`)
- Lifetime: `REFRESH_TOKEN_LIFE` env var (default 604800 seconds / 7 days)
- Signed with separate secret (JWT_SECRET + '-refresh')
- Endpoint: `POST /api/auth/refresh-token`
- Contains minimal claims: userId, authType, familyId, accountId

### Token Blacklist
- In-memory `Map<string, number>` (token → expiry timestamp)
- Populated on logout via `invalidateToken()`
- Cleaned up hourly (removes expired entries)
- Checked on every authenticated request

## Auth Middleware Wrappers

Every API route uses one of these wrappers. They are defined in `app/api/utils/auth.ts`.

### `withAuth(handler)`
**Use when:** Any authenticated user should have access.
```typescript
export const GET = withAuth(async (req) => { ... });
```
- Verifies authentication only
- Does not pass auth context to handler
- Returns 401 if not authenticated

### `withAuthContext(handler)`
**Use when:** Handler needs to know who the user is and which family they belong to. This is the most commonly used wrapper.
```typescript
export const GET = withAuthContext(async (req, authContext) => {
  const { familyId, caretakerId, isSysAdmin } = authContext;
  // ...
});
```
- Passes `AuthResult` object to handler
- Handles special cases:
  - **Setup auth:** Extracts familyId from query params, validates setup token
  - **System admin:** Extracts family context from URL path, query params, or referer header
- Returns 401 if not authenticated

### `withAdminAuth(handler)`
**Use when:** Only admins, system caretakers, or system administrators should access.
```typescript
export const DELETE = withAdminAuth(async (req) => { ... });
```
- Allows: `caretakerRole === 'ADMIN'`, system caretakers (loginId '00'), or `isSysAdmin`
- Returns 403 if authenticated but not admin

### `withSysAdminAuth(handler)`
**Use when:** Only the system administrator should access (family manager operations).
- Requires `isSysAdmin: true` in JWT
- Returns 403 for all other users

### `withAccountOwner(handler)`
**Use when:** Only the account owner (or system admin) should access.
```typescript
export const PUT = withAccountOwner(async (req, authContext) => { ... });
```
- Requires `isAccountOwner: true` or `isSysAdmin: true`
- Passes auth context to handler

## AuthResult Interface

The `AuthResult` object passed to handlers by `withAuthContext`:

```typescript
interface AuthResult {
  authenticated: boolean;
  caretakerId?: string;      // Who is making the request
  caretakerType?: string;    // parent, nanny, daycare, etc.
  caretakerRole?: string;    // USER or ADMIN
  familyId?: string;         // THE source of truth for data scoping
  familySlug?: string;       // URL slug for the family
  isSysAdmin?: boolean;      // System administrator flag
  isSetupAuth?: boolean;     // Setup token authentication
  isAccountAuth?: boolean;   // Account-based authentication
  accountId?: string;        // Account ID (if account auth)
  accountEmail?: string;     // Account email
  isAccountOwner?: boolean;  // Account owns the family
  verified?: boolean;        // Email verified
  betaparticipant?: boolean; // Beta participant (exempt from expiration)
  isExpired?: boolean;       // Account subscription expired
  trialEnds?: string;        // Trial end date (ISO)
  planExpires?: string;      // Plan expiration date (ISO)
  planType?: string;         // Subscription plan type
  error?: string;            // Error message if not authenticated
}
```

## Family-Level Authorization (The Golden Rule)

**Never trust client-sent family context.** The only source of truth for a user's family is `authContext.familyId` from the middleware.

### CRUD Authorization Patterns

**List (GET all):**
```typescript
const items = await prisma.feedLog.findMany({
  where: { familyId: userFamilyId, deletedAt: null }
});
```

**Read/Update/Delete (by ID):**
```typescript
const item = await prisma.feedLog.findUnique({ where: { id } });
if (!item || item.familyId !== userFamilyId) {
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
```

**Create:**
```typescript
// Verify parent resource belongs to family
const baby = await prisma.baby.findFirst({
  where: { id: babyId, familyId: userFamilyId }
});
if (!baby) return NextResponse.json({ success: false, error: 'Baby not found' }, { status: 404 });

// Explicitly set familyId on new record
const log = await prisma.feedLog.create({
  data: { ...input, familyId: userFamilyId }
});
```

## System Administrator

System administrators authenticate with a sitewide admin password and get `isSysAdmin: true` in their JWT. They can operate on any family's data.

**Family context resolution for sysAdmin (in order):**
1. `?familyId=` query parameter
2. URL path slug → database lookup by slug
3. `Referer` header → extract slug → database lookup

## Write Protection (SaaS Mode)

Expired accounts get read-only access via `checkWritePermission()` in `app/api/utils/writeProtection.ts`:

```typescript
const writeCheck = checkWritePermission(authContext);
if (!writeCheck.allowed) return writeCheck.response;
```

- Only enforced when `DEPLOYMENT_MODE=saas`
- Returns 403 with specific error: `TRIAL_EXPIRED`, `PLAN_EXPIRED`, or `NO_PLAN`
- Beta participants and non-account families are exempt

## IP Lockout

Brute-force protection via `app/api/utils/ip-lockout.ts`:
- In-memory store tracks failed login attempts per IP
- 3 failed attempts → 5-minute lockout
- `checkIpLockout(ip)` returns `{ locked, remainingTime }`
- `recordFailedAttempt(ip)` increments counter
- `resetFailedAttempts(ip)` clears on successful login

## Client-Side Auth Integration

The `FamilyProvider` (`src/context/family.tsx`) handles client-side auth:
- Global fetch interceptor adds `Authorization: Bearer <token>` to all requests
- 401 responses trigger automatic logout (except on login page)
- Account expiration checked every 30 seconds in SaaS mode
- Provides `authenticatedFetch` wrapper for components

## Key Files

- `app/api/utils/auth.ts` — All auth middleware wrappers and `getAuthenticatedUser()`
- `app/api/utils/writeProtection.ts` — Write protection for expired accounts
- `app/api/utils/ip-lockout.ts` — IP-based login lockout
- `app/api/utils/password-utils.ts` — PBKDF2 password hashing (100K iterations, SHA256)
- `app/api/auth/route.ts` — Login endpoint
- `app/api/auth/refresh-token/route.ts` — Token refresh endpoint
- `app/api/auth/logout/route.ts` — Logout (token blacklisting)
- `src/context/family.tsx` — Client-side auth integration
