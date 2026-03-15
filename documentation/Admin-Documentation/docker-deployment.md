# Docker Deployment

## Quick Start

Pull and run the latest image:

```bash
docker pull sprouttrack/sprout-track:latest
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Default PIN: `111222`
- Default admin password: `admin`

On first access, the Setup Wizard will guide you through initial configuration.

## docker-compose.yml Reference

The included `docker-compose.yml` defines:

```yaml
services:
  app:
    image: sprout-track
    container_name: sprout-track
    restart: unless-stopped
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - db-data:/db
      - env-data:/app/env
      - files:/app/Files
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - ENABLE_NOTIFICATIONS=${ENABLE_NOTIFICATIONS:-true}
      - NOTIFICATION_CRON_SECRET=${NOTIFICATION_CRON_SECRET:-}
      - APP_URL=${APP_URL:-}
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  db-data:
    name: sprout-track-db
  env-data:
    name: sprout-track-env
  files:
    name: sprout-track-files
```

### Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `sprout-track-db` | `/db` | SQLite database files |
| `sprout-track-env` | `/app/env` | Environment configuration (`.env` file, encryption keys) |
| `sprout-track-files` | `/app/Files` | Encrypted file storage (vaccine documents) |
| `./logs` (bind mount) | `/app/logs` | Application and notification cron logs |

All named volumes persist across container restarts and upgrades.

### Health Check

The container includes a health check that pings `http://localhost:3000` every 30 seconds. It waits 40 seconds after startup before the first check and retries 3 times before marking the container unhealthy.

## Container Startup Behavior

When the container starts, `docker-startup.sh` runs the following steps:

1. Creates `/db` directory and symlinks it to `/app/db`
2. Configures timezone if the `TZ` environment variable is set
3. Generates `ENC_HASH` in `.env` if missing (used for AES-256 file encryption)
4. Generates Prisma clients for both the main and log databases
5. Runs database migrations (`prisma migrate deploy`)
6. Seeds the database (safe to run repeatedly, only creates missing data)
7. If `ENABLE_NOTIFICATIONS=true`: generates `NOTIFICATION_CRON_SECRET` if missing, sets up the cron job, and starts the cron daemon. Note: this only makes the notification infrastructure available. Notifications are disabled in the database by default and must be enabled in the Family Manager settings page after SSL certificates are configured.

## Custom Port

Change the host port by setting `PORT` in your environment or `.env`:

```bash
PORT=8080 docker-compose up -d
```

This maps port 8080 on the host to port 3000 in the container.

## Building Locally

To build the image from source instead of pulling from Docker Hub:

```bash
docker-compose build
docker-compose up -d
```

To build with push notifications enabled (enabled by default in docker-compose.yml):

```bash
docker build --build-arg ENABLE_NOTIFICATIONS=true -t sprout-track .
```

## Timezone

Set the `TZ` environment variable to configure the container timezone:

```yaml
environment:
  - TZ=America/New_York
```

This uses Alpine Linux's timezone support via `/usr/share/zoneinfo`.

## Volume Management

### View volumes

```bash
docker volume ls | grep sprout-track
```

### Backup volumes

```bash
# Backup database
docker run --rm -v sprout-track-db:/data -v $(pwd):/backup alpine tar czf /backup/database-backup.tar.gz -C /data .

# Backup environment config
docker run --rm -v sprout-track-env:/data -v $(pwd):/backup alpine tar czf /backup/env-backup.tar.gz -C /data .

# Backup encrypted files
docker run --rm -v sprout-track-files:/data -v $(pwd):/backup alpine tar czf /backup/files-backup.tar.gz -C /data .
```

### Restore volumes

```bash
# Restore database
docker run --rm -v sprout-track-db:/data -v $(pwd):/backup alpine tar xzf /backup/database-backup.tar.gz -C /data

# Restore environment config
docker run --rm -v sprout-track-env:/data -v $(pwd):/backup alpine tar xzf /backup/env-backup.tar.gz -C /data

# Restore encrypted files
docker run --rm -v sprout-track-files:/data -v $(pwd):/backup alpine tar xzf /backup/files-backup.tar.gz -C /data
```

## Viewing Logs

```bash
# Container logs
docker logs sprout-track

# Notification cron logs (if enabled)
tail -f ./logs/notification-cron.log
```

## Related Documentation

- [Environment Variables](environment-variables.md) -- full variable reference
- [Upgrades and Backups](upgrades-and-backups.md) -- upgrade procedures and backup strategies
- [Push Notifications](push-notifications.md) -- notification setup for Docker
