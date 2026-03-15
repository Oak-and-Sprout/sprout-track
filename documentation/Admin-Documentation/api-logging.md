# API Logging

## Overview

Sprout Track includes an optional API logging system for debugging and monitoring. It uses a separate SQLite database (`api-logs.db`) to avoid bloating the main application database.

API logging is **disabled by default**.

## Enabling

Add or update these variables in your `.env` file:

```env
ENABLE_LOG=true
LOG_DATABASE_URL="file:../db/api-logs.db"
```

Restart the application after changing these values.

## Log Database Management

The log database is managed separately from the main database:

- **Schema sync**: Uses `prisma db push` instead of versioned migrations. This avoids conflicts with the main database's migration folder.
- **Setup**: Automatically created during initial setup via `./scripts/setup.sh`
- **Schema updates**: Run `npm run prisma:push:log` to sync schema changes

### Data Safety During Schema Updates

| Change Type | Data Impact |
|-------------|-------------|
| Adding fields | Safe, existing logs preserved |
| Removing or renaming fields | May lose data for those fields |

For production, back up `api-logs.db` before schema changes if log history is important.

## Viewing Logs

Open Prisma Studio for the log database:

```bash
npm run prisma:studio:log
```

This opens a browser-based UI for browsing and querying log entries.

## Log Entry Contents

Each log entry captures:

- Timestamp, HTTP method, request path, status code
- Response duration
- Client IP and user agent
- Caretaker and family context (if authenticated)
- Error details (if applicable)

## Related Documentation

- [Environment Variables](environment-variables.md) -- `ENABLE_LOG` and `LOG_DATABASE_URL` reference
