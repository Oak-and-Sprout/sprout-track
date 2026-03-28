# Environment Variables

## Overview

Sprout Track uses a `.env` file for configuration. Key variables are auto-generated during setup:

- **Local deployments**: `./scripts/env-update.sh` creates and updates `.env` in the project root
- **Docker deployments**: `docker-startup.sh` manages `.env` at `/app/env/.env` (persisted in the `sprout-track-env` volume)

You do not need to create the `.env` file manually. The setup process handles it.

## Variable Reference

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PROVIDER` | `"sqlite"` | Database backend: `"sqlite"` or `"postgresql"`. Controls schema generation and migration strategy. |
| `DATABASE_URL` | `"file:../db/baby-tracker.db"` | Database connection string. For SQLite: a `file:` path. For PostgreSQL: `postgresql://user:password@host:5432/dbname`. |
| `LOG_DATABASE_URL` | `"file:../db/api-logs.db"` | Connection string for the API log database. Can point to the same database as `DATABASE_URL` (uses separate tables). |

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `"production"` (Docker) | Node environment (`development` or `production`) |
| `PORT` | `3000` | Host port mapping (Docker only, set in compose or env) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_LIFE` | `"86400"` (24 hours) | Access token validity period in seconds |
| `REFRESH_TOKEN_LIFE` | `"604800"` (7 days) | Refresh token lifetime in seconds. Uses a sliding window: resets on each refresh. This is the max gap of inactivity before requiring re-login. |
| `IDLE_TIME` | `"28800"` (8 hours) | Legacy idle timeout. Aligned with `REFRESH_TOKEN_LIFE` in newer versions. |
| `COOKIE_SECURE` | `"false"` | Set to `"true"` to require HTTPS for cookies. The app will only work over HTTPS when enabled. |

### Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `ENC_HASH` | Auto-generated | 64-character hex string used as the AES-256 encryption key for file sensitive database field encryption (vaccine documents). Generated automatically if missing. |

### Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_NOTIFICATIONS` | `"false"` (`"true"` in Docker compose) | Build the notification infrastructure (cron daemon, log directories) into the app. This does not enable notifications -- they must be turned on in the Family Manager settings page after SSL is configured. |
| `NOTIFICATION_CRON_SECRET` | Auto-generated | Bearer token securing the notification cron endpoint. Generated automatically if missing. |
| `NOTIFICATION_LOG_RETENTION_DAYS` | `"30"` | Days to retain notification logs before automatic cleanup |
| `APP_URL` | -- | Full base URL for the app (e.g., `https://baby.example.com`). Used by the cron job to call notification APIs. |
| `ROOT_DOMAIN` | -- | Domain name (e.g., `baby.example.com`). Used to construct `APP_URL` if not set directly. |
| `VAPID_PUBLIC_KEY` | -- | VAPID public key (Docker passthrough). Normally managed in the database via the admin UI. |
| `VAPID_PRIVATE_KEY` | -- | VAPID private key (Docker passthrough). Normally managed in the database via the admin UI. |
| `VAPID_SUBJECT` | `"mailto:notifications@sprouttrack.app"` | VAPID subject identifier |

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_LOG` | `"false"` | Enable API request/response logging to a separate database |

### Service Management

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | `"baby-tracker"` | Name of the systemd service (local deployments only) |

### ST-Guardian (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ST_GUARDIAN_KEY` | -- | Access key for the ST-Guardian update service. Setting this enables the "System Updates" section in App Configuration. |
| `ST_GUARDIAN_PORT` | `"3001"` | Port the ST-Guardian service listens on |

### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_VERSION` | `"1.2.2"` | Application version string |
| `TZ` | -- | Timezone for the container (Docker only, e.g., `America/New_York`) |

## Security-Sensitive Variables

**`ENC_HASH`**: This key encrypts files stored in the application (vaccine documents). If you lose this value, encrypted files and admin access to Sprout Track cannot be decrypted. Do not modify it after data has been encrypted. Always back up your `.env` file before updates. When using the backup tool in the /family-manager settings page the `.env` file is included.

**`NOTIFICATION_CRON_SECRET`**: Protects the notification timer endpoint from unauthorized access. Auto-generated with `openssl rand -hex 32`. Uses timing-safe comparison.

**`ST_GUARDIAN_KEY`**: Controls access to the update service. Only set this if you are running ST-Guardian.

## Auto-Generation

The following variables are automatically generated if missing:

| Variable | Generated By | Method |
|----------|-------------|--------|
| `ENC_HASH` | `env-update.sh` / `docker-startup.sh` | `openssl rand -hex 32` |
| `NOTIFICATION_CRON_SECRET` | `env-update.sh` / `docker-startup.sh` | `openssl rand -hex 32` |
| `AUTH_LIFE` | `env-update.sh` | Default value `86400` |
| `IDLE_TIME` | `env-update.sh` | Default value `604800` matched to `REFRESH_TOKEN_LIFE` |
| `REFRESH_TOKEN_LIFE` | `env-update.sh` | Default value `604800` |

## PostgreSQL Configuration

When using PostgreSQL (`DATABASE_PROVIDER="postgresql"`), set `DATABASE_URL` to a PostgreSQL connection string:

```
DATABASE_URL="postgresql://user:password@host:5432/sprout_track"
```

The `LOG_DATABASE_URL` can point to the same database — Prisma uses separate table names so there is no conflict:

```
LOG_DATABASE_URL="postgresql://user:password@host:5432/sprout_track"
```

Or use a separate database if preferred:

```
LOG_DATABASE_URL="postgresql://user:password@host:5432/sprout_track_logs"
```

The `docker-compose.postgres.yml` file sets these automatically when using the built-in PostgreSQL service.

### PostgreSQL-specific environment variables (docker-compose.postgres.yml)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `sprout` | PostgreSQL superuser name |
| `POSTGRES_PASSWORD` | `sprout` | PostgreSQL superuser password |
| `POSTGRES_DB` | `sprout_track` | Default database name |

These are used by the `postgres:16-alpine` container and to construct `DATABASE_URL` in the compose file. Change them in your `.env` or directly in the compose file for production use.

## Docker vs. Local

| Aspect | Docker | Local |
|--------|--------|-------|
| `.env` location | `/app/env/.env` (persisted in `sprout-track-env` volume) | Project root `.env` |
| Auto-generation | `docker-startup.sh` on every container start | `./scripts/env-update.sh` during setup/deployment |
| Port configuration | `PORT` env var in compose file | `-p` flag in package.json scripts |
| Timezone | `TZ` env var | System timezone |
| Database provider | `DATABASE_PROVIDER` env var (default: `sqlite`) | `DATABASE_PROVIDER` in `.env` (default: `sqlite`) |
