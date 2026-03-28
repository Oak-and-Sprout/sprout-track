# Docker Deployment

## Quick Start (SQLite -- Default)

Run the latest image:

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -v sprout-track-db:/db \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Or with docker-compose:

```bash
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Default PIN: `111222`
- Default admin password: `admin`

On first access, the Setup Wizard will guide you through initial configuration.

## Quick Start (PostgreSQL)

Requires an existing PostgreSQL 14+ server. Create the databases first:

```sql
CREATE DATABASE sprout_track;
CREATE DATABASE sprout_track_logs;
```

Run the latest image with your PostgreSQL connection details:

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track" \
  -e LOG_DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track_logs" \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Or with docker-compose, set `DATABASE_URL` and `LOG_DATABASE_URL` in your environment (or a `.env` file) and use the PostgreSQL compose file:

```bash
docker compose -f docker-compose.postgres.yml up -d
```

The app automatically creates the database schema and seeds default data on first run.

## Custom Port

Map a different host port:

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 8080:3000 \
  -v sprout-track-db:/db \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Or with docker-compose, set `PORT` in your environment:

```bash
PORT=8080 docker-compose up -d
```

## Timezone

Set the `TZ` environment variable:

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -e TZ=America/New_York \
  -v sprout-track-db:/db \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Or in docker-compose.yml:

```yaml
environment:
  - TZ=America/New_York
```

## Database Provider

Sprout Track supports two database backends:

| Provider | Default | Use Case |
|----------|---------|----------|
| **SQLite** | Yes | Simple, zero-config, single-file database. Great for most users. |
| **PostgreSQL** | No | External database server. Better for high availability or existing infrastructure. |

The database provider is selected via the `DATABASE_PROVIDER` environment variable (`sqlite` or `postgresql`). SQLite is the default -- no configuration needed.

### Choosing a Provider

- **SQLite** is recommended for most users. It requires no external services, stores everything in a single file, and handles the typical workload of a family tracking app with ease.
- **PostgreSQL** is useful if you already run a PostgreSQL server, want to use managed database services, or prefer a client-server database architecture.

Both providers support the same features. You can migrate between them at any time using the built-in backup/restore tool (see [Database Migration](upgrades-and-backups.md#migrating-between-database-providers)).

> **ⓘ To migrate:**  
> Create a new instance of Sprout Track configured for your desired database provider, then restore your database using a backup from your previous instance.  
> All your data will be imported into the new database provider, but your environment files (`.env`) will retain the current connection settings.

## Volumes

### SQLite Deployment

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `sprout-track-db` | `/db` | SQLite database files |
| `sprout-track-env` | `/app/env` | Environment configuration (`.env` file, encryption keys) |
| `sprout-track-files` | `/app/Files` | Encrypted file storage (vaccine documents) |

### PostgreSQL Deployment

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `sprout-track-env` | `/app/env` | Environment configuration (`.env` file, encryption keys) |
| `sprout-track-files` | `/app/Files` | Encrypted file storage (vaccine documents) |

Data is stored in your external PostgreSQL server, so no database volume is needed on the app container.

All named volumes persist across container restarts and upgrades. Your data, configuration, and encryption keys are preserved automatically when pulling a new image.

## Environment Configuration

The container automatically manages the `.env` file stored in the `sprout-track-env` volume:

- **First run:** Creates a complete `.env` with all required defaults and generates encryption keys (`ENC_HASH`)
- **Upgrades:** Adds any new environment variables introduced in newer versions without overwriting your existing settings
- **Backup restore:** Fills in any missing variables after restoring a `.env` from an older backup. Database connection parameters (`DATABASE_PROVIDER`, `DATABASE_URL`, `LOG_DATABASE_URL`) are always preserved during restore, even if the backup came from a different database provider

Your `ENC_HASH` (used for file encryption) is never overwritten once generated. See [Environment Variables](environment-variables.md) for the full reference.

## What Happens at Startup

Each time the container starts, it automatically:

1. Ensures the `.env` file is complete (generates missing secrets, adds new defaults)
2. Configures Prisma for the active database provider
3. Runs database migrations (SQLite) or pushes the schema (PostgreSQL)
4. Seeds the database with defaults (safe to run repeatedly)
5. Sets up the notification cron job (if notifications are enabled)

For PostgreSQL, the startup script waits for the database server to be ready before running migrations.

This means upgrades are handled automatically -- just pull the new image and restart.

## Upgrading

Your data is stored in Docker volumes, so upgrading is just replacing the container with a newer image. Nothing is lost.

```bash
docker stop sprout-track
docker rm sprout-track
docker pull sprouttrack/sprout-track:latest
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -v sprout-track-db:/db \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Or with docker-compose:

```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

On startup, the new container automatically runs database migrations and adds any new environment variables. No manual steps needed.

## Viewing Logs

```bash
# Container logs
docker logs sprout-track

# Follow logs in real time
docker logs -f sprout-track
```

## Building from Source

To build the image locally instead of pulling from Docker Hub:

```bash
# SQLite (default)
docker-compose build
docker-compose up -d

# PostgreSQL (requires DATABASE_URL and LOG_DATABASE_URL in environment)
docker compose -f docker-compose.postgres.yml build
docker compose -f docker-compose.postgres.yml up -d
```

## Related Documentation

- [Environment Variables](environment-variables.md) -- full variable reference
- [Upgrades and Backups](upgrades-and-backups.md) -- upgrade procedures, backup strategies, and database migration
- [Push Notifications](push-notifications.md) -- notification setup
