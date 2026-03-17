# Docker Deployment

## Quick Start

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

## Volumes

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `sprout-track-db` | `/db` | SQLite database files |
| `sprout-track-env` | `/app/env` | Environment configuration (`.env` file, encryption keys) |
| `sprout-track-files` | `/app/Files` | Encrypted file storage (vaccine documents) |

All named volumes persist across container restarts and upgrades. Your data, configuration, and encryption keys are preserved automatically when pulling a new image.

## Environment Configuration

The container automatically manages the `.env` file stored in the `sprout-track-env` volume:

- **First run:** Creates a complete `.env` with all required defaults and generates encryption keys (`ENC_HASH`)
- **Upgrades:** Adds any new environment variables introduced in newer versions without overwriting your existing settings
- **Backup restore:** Fills in any missing variables after restoring a `.env` from an older backup

Your `ENC_HASH` (used for file encryption) is never overwritten once generated. See [Environment Variables](environment-variables.md) for the full reference.

## What Happens at Startup

Each time the container starts, it automatically:

1. Ensures the `.env` file is complete (generates missing secrets, adds new defaults)
2. Runs database migrations
3. Seeds the database with defaults (safe to run repeatedly)
4. Sets up the notification cron job (if notifications are enabled)

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
docker-compose build
docker-compose up -d
```

## Related Documentation

- [Environment Variables](environment-variables.md) -- full variable reference
- [Upgrades and Backups](upgrades-and-backups.md) -- upgrade procedures and backup strategies
- [Push Notifications](push-notifications.md) -- notification setup
