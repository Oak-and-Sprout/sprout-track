# API Design Patterns

## Overview

All API routes follow a consistent pattern: Next.js App Router route handlers wrapped with authentication middleware, returning a standardized response format. Routes are organized by domain under `app/api/` with shared utilities in `app/api/utils/`.

## Route File Structure

Each API route is a `route.ts` file that exports named HTTP method handlers:

```typescript
// app/api/diaper-log/route.ts
import { withAuthContext, ApiResponse, AuthResult } from '../utils/auth';
import { checkWritePermission } from '../utils/writeProtection';

async function handler(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<any>>> {
  // ...
}

export const GET = withAuthContext(handler);
export const POST = withAuthContext(handler);
```

Routes define a separate handler function per method (`handleGet`, `handlePost`, `handlePut`, `handleDelete`), each individually wrapped and exported:

```typescript
export const GET = withAuthContext(handleGet);
export const POST = withAuthContext(handlePost);
export const PUT = withAuthContext(handlePut);
export const DELETE = withAuthContext(handleDelete);
```

## Standard Response Format

Every API response follows this structure:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

**Success:**
```json
{ "success": true, "data": { ... } }
```

**Error:**
```json
{ "success": false, "error": "Human-readable error message" }
```

HTTP status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthenticated), 403 (forbidden), 404 (not found), 500 (server error).

## Canonical Handler Pattern

Most handlers follow this sequence:

### 1. Authentication (automatic via wrapper)
The `withAuthContext` wrapper handles authentication and passes `authContext` to the handler.

### 2. Write Protection Check (for mutations)
At the top of mutation handlers (`handlePost`, `handlePut`, `handleDelete`):
```typescript
const writeCheck = checkWritePermission(authContext);
if (!writeCheck.allowed) return writeCheck.response;
```

### 3. Extract Family Context
```typescript
const { familyId: userFamilyId, caretakerId } = authContext;
```

### 4. Parse and Validate Input
```typescript
const body = await req.json();
const { babyId, time, type, ...rest } = body;

if (!babyId || !time) {
  return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
}
```

Array payloads are validated item by item with a shared pure helper, and a malformed item rejects the whole request rather than being silently dropped. For example, `/api/food-log` passes `foods[]` through `validateFoodItemInputs()` (`src/utils/foodLogUtils.ts`): distinct non-empty `foodId`s, a positive finite `amount`, a `unitAbbr` of at most 16 characters, a valid `enjoyment`, a boolean `hadReaction` and a string `reactionDescription` — anything else returns `400` with the reason. The row-level `amount`/`unitAbbr` are then derived from the items with `deriveMealAmountFromItems()` (see [Data Model](./DataModel.md#food-tracker)).

### 5. Verify Parent Resource Belongs to Family
```typescript
const baby = await prisma.baby.findFirst({
  where: { id: babyId, familyId: userFamilyId, deletedAt: null }
});
if (!baby) {
  return NextResponse.json({ success: false, error: 'Baby not found' }, { status: 404 });
}
```

### 6. Perform Database Operation
```typescript
const log = await prisma.diaperLog.create({
  data: {
    time: toUTC(time),
    type,
    babyId,
    caretakerId,
    familyId: userFamilyId,  // Always explicitly set
    ...rest,
  }
});
```

### 7. Trigger Side Effects
```typescript
// Push notifications after activity creation (fire-and-forget)
notifyActivityCreated(
  log.babyId,
  'diaper',
  { accountId: authContext.accountId, caretakerId: authContext.caretakerId },
  { type: body.type }
).catch(console.error);
```

### 8. Return Response
```typescript
return NextResponse.json({
  success: true,
  data: { ...log, time: formatForResponse(log.time) }
});
```

## Timezone Handling

All dates are stored as UTC in the database. The API layer handles conversion.

### Incoming Dates
Use `toUTC()` from `app/api/utils/timezone.ts` to convert client-sent date strings to UTC:
```typescript
import { toUTC, formatForResponse } from '../utils/timezone';

// Convert incoming date to UTC
const utcDate = toUTC(body.time);
```

### Outgoing Dates
Use `formatForResponse()` to format dates as ISO strings for API responses:
```typescript
const response = {
  ...log,
  time: formatForResponse(log.time),
  startTime: log.startTime ? formatForResponse(log.startTime) : null,
};
```

### Client-Side Display
The `TimezoneProvider` (`app/context/timezone.tsx`) detects the browser's timezone and provides formatting utilities (`formatDate`, `formatTime`, `formatDateTime`) for display.

## API Type Definitions

Shared types are defined in `app/api/types.ts` with paired Create/Response types:

```typescript
// Create type — what the client sends
interface DiaperLogCreate {
  babyId: string;
  time: string;
  type: DiaperType;
  condition?: string;
  // ...
}

// Response type — what the API returns
interface DiaperLogResponse {
  id: string;
  babyId: string;
  time: string;  // ISO format
  type: DiaperType;
  // ...
}
```

## Soft Delete Pattern

Activity logs use soft deletion via `deletedAt`:

```typescript
// Delete: set deletedAt instead of removing
await prisma.diaperLog.update({
  where: { id },
  data: { deletedAt: new Date() }
});

// Query: always filter out deleted records
const logs = await prisma.diaperLog.findMany({
  where: { familyId: userFamilyId, deletedAt: null }
});
```

## SaaS-Gated & Public Endpoints

The short-link and analytics features (see [SaaS Analytics and Short Links](./SaasAnalyticsAndShortLinks.md)) deviate from the canonical family-scoped pattern in three documented ways.

### SaaS feature gate (404 in self-hosted)

Both features are wrapped by a gate helper that returns a `404` `NextResponse` when `DEPLOYMENT_MODE !== 'saas'`, so the endpoints simply do not exist in self-hosted deployments (mirroring the gift-code 404-in-selfhosted behavior):

```typescript
// app/api/utils/analytics.ts / app/api/utils/short-links.ts
export function analyticsSaasGate(): NextResponse<ApiResponse<never>> | null {
  if ((process.env.DEPLOYMENT_MODE || 'selfhosted') !== 'saas') {
    return NextResponse.json({ success: false, error: '...' }, { status: 404 });
  }
  return null;
}

// at the top of the handler:
const gate = analyticsSaasGate();
if (gate) return gate;
```

### Intentionally unauthenticated endpoints

Two routes have **no auth wrapper by design** — they are public and self-authenticating:

| Endpoint | Why unauthenticated |
|----------|---------------------|
| `POST /api/analytics/collect` | First-party pageview beacon fired from public/funnel pages; unknown/garbage paths are dropped silently with `204` |
| `GET /go/[slug]` | Public short-link redirect; the slug is the only credential and any miss/error redirects to `/` |

**Telemetry must never break the response.** In both routes the database write (pageview insert / click insert + count increment) is wrapped in its own try/catch so a logging failure never breaks the `302` redirect or the beacon `204`.

### Global (non-family-scoped) sysadmin resources

The short-link and analytics management endpoints (`/api/short-links/*`, `/api/analytics/stats`, `/api/analytics/export`) are wrapped with `withSysAdminAuth` and operate on **global models with no `familyId`** — the golden-rule family scoping does not apply. They are the only domain that is sysadmin-only and cross-/no-family.

## Webhook / External API

External integrations use a separate API surface at `app/api/hooks/v1/`:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/hooks/v1/babies/` | List babies |
| `GET /api/hooks/v1/babies/[babyId]/activities/` | Recent activities |
| `POST /api/hooks/v1/babies/[babyId]/activities/` | Log a new activity (all eleven types, including `food`, plus feed/sleep/pump timer actions) |
| `PUT /api/hooks/v1/babies/[babyId]/activities/[activityId]/` | Edit an existing activity |
| `DELETE /api/hooks/v1/babies/[babyId]/activities/[activityId]/` | Delete an existing activity |
| `GET /api/hooks/v1/babies/[babyId]/measurements/latest/` | Latest measurements |
| `GET /api/hooks/v1/babies/[babyId]/status/` | Baby status summary |
| `GET /api/hooks/v1/babies/[babyId]/reference/` | Reference data (valid enum values for activity fields, plus the family food catalog at `?type=foods` and enjoyment values at `?type=food-enjoyments`) |

**Authentication:** Uses API keys (not JWT). Keys are validated via SHA-256 hash lookup against the `ApiKey` model. Scoped by `familyId` and optionally `babyId`, with read/write permissions.

**Validation:** Request bodies are strict — fields not accepted by the declared activity type are rejected with `400 INVALID_FIELD` rather than silently dropped. Enum-like fields (`condition`, `color`, `quality`, `bottleType`, `side`, `pumpAction`, and the known `bathType` values) are matched case-insensitively against canonical sets in `app/api/hooks/v1/field-values.ts` and stored with canonical casing; `unitAbbr` is validated against the `Unit` table. `GET /reference` advertises every one of these sets.

**Food activities:** The `food` type (`app/api/hooks/v1/food.ts`) accepts `foodName`/`foodId` or a `foods[]` array with per-food `amount`/`unitAbbr`/`enjoyment`, find-or-creates catalog foods by name, and writes through the same `buildFoodLogFoodFields()` / `deriveMealAmountFromItems()` helpers as `/api/food-log`, so webhook and app food logs are indistinguishable. A legacy `feed` with `feedType: "SOLIDS"` is stored as a `FoodLog` through the same path (`createFoodActivity(..., dedupe = true)`): an existing non-deleted food log of the same baby, exact time and food-name set (`findExistingFoodLog()`, shared with the startup conversion) is returned with `duplicate: true` instead of creating a second one. `type: "food"` posts are not deduplicated. Neither path calls `notifyActivityCreated()`.

**Rate Limiting:** Implemented in `app/api/hooks/v1/rate-limiter.ts` — sliding 60 s window per key and method; GET 60/min and POST/PUT/DELETE 30/min by default. The limits are deployment-wide `AppConfig` fields (`hooksReadsPerMinute` / `hooksWritesPerMinute`), set by the sysadmin in the Family Manager App Configuration form; there is deliberately no env var or per-family override. `checkRateLimit()` reads them through a 60 s in-memory cache that `PUT /api/app-config` clears on save, and falls back to the defaults when no row exists or the read fails. Every response carries `X-RateLimit-Limit` / `-Remaining` / `-Reset`; a 429 adds `Retry-After`, computed by the pure `evaluateSlidingWindow()` as the wait until the oldest counted request leaves the window.

## External Imports

Baby Buddy and Huckleberry imports go through `POST /api/import/external/preview` and `POST /api/import/external/execute` (`withAuthContext`; execute also runs `checkWritePermission`). Each provider implements `ExternalImportRuntimeProvider` (`src/lib/importers/runtime-registry.ts`):

```typescript
previewFiles(files): ExternalImportProviderPreview;
buildRecords(files, configuration, execution): readonly ExternalImportRecord[];
```

`configuration` is the provider-specific options (e.g. Baby Buddy units); `execution` is the shared `ExternalImportExecutionConfiguration`, which carries the child → baby destinations. Huckleberry uses it to scope its record ids to the target baby (see [Data Model](./DataModel.md#externalimportrecord)). The execute route runs the records through `executeExternalImport()` in a single transaction, using `ExternalImportRecord` provenance to skip already-imported rows.

## Notification Hooks

After creating activity logs, the system can trigger push notifications:

```typescript
// src/lib/notifications/activityHook.ts
notifyActivityCreated(babyId, activityType, actingUser, activityData).catch(console.error);
```

This checks `NotificationPreference` records to determine which subscriptions want to be notified about this activity type for this baby (excluding the acting user), then sends push notifications via the Web Push API. `resetTimerNotificationState()` is also exported to clear timer-notification state when a new feed/medicine log lands.

### Timer-Based Notifications
A cron job (`/api/notifications/cron`) checks for overdue timers:
- Feed timer: compares last feed time against `baby.feedWarningTime`
- Diaper timer: compares last diaper change against `baby.diaperWarningTime`
- Medicine timer: compares last dose against `medicine.doseMinTime`

## API Logging

Optional logging wrapper for debugging:

```typescript
import { withLogging } from '../utils/with-logging';

export const GET = withAuthContext(withLogging(handler));
```

Logs request method, path, status code, response time, IP/user agent, and request/response bodies. Enabled via the `ENABLE_LOG=true` environment variable. A combined `withAuthAndLogging(handler, authWrapper)` helper is also available. Separately, `withAdminAuth`/`withSysAdminAuth` always write metadata-only audit entries (no bodies) for privileged calls when `ENABLE_LOG=true`.

## Key Files

- `app/api/utils/auth.ts` — Auth middleware wrappers
- `app/api/utils/writeProtection.ts` — Write protection for expired accounts
- `app/api/utils/timezone.ts` — Date conversion utilities (`toUTC`, `formatForResponse`)
- `app/api/types.ts` — Shared API type definitions
- `app/api/db.ts` — Prisma client singleton
- `app/api/utils/with-logging.ts` — Request logging wrapper
- `app/api/hooks/v1/` — External webhook API routes
- `app/api/hooks/v1/field-values.ts` — Canonical enum-like field values + case-insensitive normalization for the webhook API
- `app/api/hooks/v1/food.ts` — `food` activity type: parses foods, find-or-creates catalog foods by name, and writes FoodLogs through the same `foodLogUtils` helpers as `/api/food-log`. Legacy `feed` posts with `feedType: "SOLIDS"` are written through the same path, deduplicated by baby, time and food with the startup conversion's `findExistingFoodLog` (`scripts/convert-solids-feeds-runner.js`)
- `app/api/hooks/v1/rate-limiter.ts` — Webhook sliding-window rate limiter (`getRateLimit()`, `evaluateSlidingWindow()`)
- `src/lib/importers/runtime-registry.ts` — External import providers (`previewFiles` / `buildRecords`)
- `app/api/utils/family-scope.ts` — `resolveFamilyScope()`: a client-sent familyId may only confirm the auth context's family, never override it (sysadmin excepted)
- `app/api/utils/setup-token-scope.ts` — `setupTokenMayTarget()`: unbound setup tokens may bind a family only via `/api/setup/start`
- `app/api/utils/analytics.ts` / `app/api/utils/short-links.ts` — `analyticsSaasGate()` / `shortLinkSaasGate()`: SaaS 404 gate for the analytics and short-link routes
- `src/lib/notifications/activityHook.ts` — Post-activity notification triggers
- `src/lib/notifications/timerCheck.ts` — Timer expiration checks
