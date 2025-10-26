# API Utilities

This directory contains utility functions and middleware for API routes.

## API Logging

The API logging system provides comprehensive request/response logging to a separate SQLite database.

### Files

- **`api-logger.ts`** - Core logging functions
- **`with-logging.ts`** - Middleware wrapper for automatic logging

### Database

Logs are stored in a separate database file: `db/api-logs.db`

**Schema**: `prisma/log-schema.prisma`

**Fields logged**:
- `timestamp` - When the request was made
- `method` - HTTP method (GET, POST, PUT, DELETE, etc.)
- `path` - Request path
- `status` - HTTP response status code
- `durationMs` - Request duration in milliseconds
- `ip` - Client IP address
- `userAgent` - Client user agent string
- `caretakerId` - Authenticated caretaker ID (if applicable)
- `familyId` - Family ID (if applicable)
- `error` - Error message (if request failed)
- `requestBody` - JSON request body (optional)
- `responseBody` - JSON response body (optional)

### Usage

#### Manual Logging

Use this approach when you need fine-grained control over what gets logged:

```typescript
import { logApiCall, getClientInfo } from '../utils/api-logger';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const { ip, userAgent } = getClientInfo(req);

  try {
    const body = await req.json();

    // Your API logic here
    const result = await doSomething(body);

    // Log successful request
    logApiCall({
      method: req.method,
      path: '/api/your-route',
      status: 200,
      durationMs: Date.now() - startTime,
      ip,
      userAgent,
      caretakerId: authContext.caretakerId,
      familyId: authContext.familyId,
      requestBody: body,
      responseBody: result,
    }).catch(err => console.error('Failed to log API call:', err));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // Log failed request
    logApiCall({
      method: req.method,
      path: '/api/your-route',
      status: 500,
      durationMs: Date.now() - startTime,
      ip,
      userAgent,
      error: error instanceof Error ? error.message : String(error),
    }).catch(err => console.error('Failed to log API call:', err));

    return NextResponse.json(
      { success: false, error: 'Request failed' },
      { status: 500 }
    );
  }
}
```

#### Middleware Logging

Use the `withLogging` wrapper for automatic logging of all requests:

```typescript
import { withLogging } from '../utils/with-logging';
import { withAuthContext } from '../utils/auth';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Your handler logic
  const body = await req.json();
  // ...
  return NextResponse.json({ success: true, data: result });
}

// Apply logging middleware
export const POST = withAuthContext(withLogging(handlePost));
```

The middleware automatically captures:
- Request timing
- IP address and user agent
- Request/response bodies
- Errors and status codes
- Authentication context (if available)

#### Combined Auth + Logging

Use `withAuthAndLogging` to apply both authentication and logging:

```typescript
import { withAuthAndLogging } from '../utils/with-logging';
import { withAuthContext } from '../utils/auth';

async function handlePost(req: NextRequest, authContext: AuthResult) {
  // Your handler logic with auth context
  // ...
}

export const POST = withAuthAndLogging(handlePost, withAuthContext);
```

### Security Considerations

**Redacting Sensitive Data**: Always redact sensitive information before logging:

```typescript
logApiCall({
  // ...
  requestBody: {
    ...requestBody,
    password: '[REDACTED]',
    securityPin: '[REDACTED]',
    creditCard: '[REDACTED]',
  },
  // ...
});
```

**What NOT to log**:
- Passwords or PINs
- API keys or tokens
- Credit card numbers
- Personal identification numbers (SSN, etc.)
- Full session tokens

### Querying Logs

View logs using SQLite:

```bash
# View recent logs
sqlite3 db/api-logs.db "SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 10;"

# View failed requests
sqlite3 db/api-logs.db "SELECT * FROM api_logs WHERE status >= 400 ORDER BY timestamp DESC;"

# View logs for specific family
sqlite3 db/api-logs.db "SELECT * FROM api_logs WHERE family_id = 'your-family-id';"

# View slow requests (over 1 second)
sqlite3 db/api-logs.db "SELECT * FROM api_logs WHERE duration_ms > 1000 ORDER BY duration_ms DESC;"

# Count requests by status code
sqlite3 db/api-logs.db "SELECT status, COUNT(*) as count FROM api_logs GROUP BY status ORDER BY count DESC;"

# View error distribution
sqlite3 db/api-logs.db "SELECT error, COUNT(*) as count FROM api_logs WHERE error IS NOT NULL GROUP BY error ORDER BY count DESC;"
```

### Maintenance

The log database is separate from your main application database, making it easy to:
- Archive old logs
- Clear logs periodically
- Export logs for analysis

**Clear old logs**:
```bash
sqlite3 db/api-logs.db "DELETE FROM api_logs WHERE timestamp < datetime('now', '-30 days');"
```

**Backup logs**:
```bash
cp db/api-logs.db backups/api-logs-$(date +%Y%m%d).db
```

### Performance

The logging system is designed to be non-blocking:
- Uses `.catch()` to prevent logging errors from breaking API requests
- Writes happen asynchronously
- Separate database prevents contention with main app

### Environment Variables

Configure logging via `.env`:

```env
# Enable or disable API logging
ENABLE_LOG=true

# Location of the log database file
LOG_DATABASE_URL="file:../db/api-logs.db"
```

**Important**: API logging is **disabled by default** (`ENABLE_LOG=false`). To enable logging, set `ENABLE_LOG=true` in your `.env` file.

When `ENABLE_LOG=false` or is not set:
- No logs will be written to the database
- Logging functions return immediately without any database operations
- Zero performance overhead from the logging system
- The log database file will not be created or accessed

### Example: Auth Endpoint Logging

See [app/api/auth/route.ts](../auth/route.ts) for a complete example of manual logging with:
- Request body capture
- Sensitive data redaction
- Response body logging
- Error tracking
- Authentication context
