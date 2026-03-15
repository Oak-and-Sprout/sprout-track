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

A single handler function typically handles multiple HTTP methods by checking `req.method` or by exporting separate functions per method.

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
```typescript
if (req.method !== 'GET') {
  const writeCheck = checkWritePermission(authContext);
  if (!writeCheck.allowed) return writeCheck.response;
}
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
// Push notifications after activity creation
await triggerActivityNotification(log, baby, userFamilyId);
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

## Webhook / External API

External integrations use a separate API surface at `app/api/hooks/v1/`:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/hooks/v1/babies/` | List babies |
| `GET /api/hooks/v1/babies/[babyId]/activities/` | Recent activities |
| `GET /api/hooks/v1/babies/[babyId]/measurements/latest/` | Latest measurements |
| `GET /api/hooks/v1/babies/[babyId]/status/` | Baby status summary |

**Authentication:** Uses API keys (not JWT). Keys are validated via SHA-256 hash lookup against the `ApiKey` model. Scoped by `familyId` and optionally `babyId`, with read/write permissions.

**Rate Limiting:** Implemented in `app/api/hooks/v1/rate-limiter.ts`.

## Notification Hooks

After creating activity logs, the system can trigger push notifications:

```typescript
// src/lib/notifications/activityHook.ts
await triggerActivityNotification(log, baby, familyId);
```

This checks `NotificationPreference` records to determine which subscriptions want to be notified about this activity type for this baby, then sends push notifications via the Web Push API.

### Timer-Based Notifications
A cron job (`/api/notifications/cron`) checks for overdue timers:
- Feed timer: compares last feed time against `baby.feedWarningTime`
- Diaper timer: compares last diaper change against `baby.diaperWarningTime`
- Medicine timer: compares last dose against `medicine.doseMinTime`

## API Logging

Optional logging wrapper for debugging:

```typescript
import { withLogging } from '../utils/with-logging';

export const GET = withLogging(withAuthContext(handler));
```

Logs request method, URL, status code, and response time. Controlled by debug flags in Settings.

## Key Files

- `app/api/utils/auth.ts` — Auth middleware wrappers
- `app/api/utils/writeProtection.ts` — Write protection for expired accounts
- `app/api/utils/timezone.ts` — Date conversion utilities (`toUTC`, `formatForResponse`)
- `app/api/types.ts` — Shared API type definitions
- `app/api/db.ts` — Prisma client singleton
- `app/api/utils/with-logging.ts` — Request logging wrapper
- `app/api/hooks/v1/` — External webhook API routes
- `src/lib/notifications/activityHook.ts` — Post-activity notification triggers
- `src/lib/notifications/timerCheck.ts` — Timer expiration checks
