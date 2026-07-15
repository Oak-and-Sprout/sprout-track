#!/bin/sh

# Detect database provider from environment
DB_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
echo "Database provider: $DB_PROVIDER"

# Capture DB settings provided via the container runtime environment (compose /
# docker run -e) before the persisted env file is sourced. The image bakes
# sqlite placeholder URLs into ENV; those are not user intent, so ignore them.
RUNTIME_DATABASE_PROVIDER="$DATABASE_PROVIDER"
RUNTIME_DATABASE_URL="$DATABASE_URL"
RUNTIME_LOG_DATABASE_URL="$LOG_DATABASE_URL"
[ "$RUNTIME_DATABASE_URL" = "file:/db/baby-tracker.db" ] && RUNTIME_DATABASE_URL=""
[ "$RUNTIME_LOG_DATABASE_URL" = "file:/db/baby-tracker-logs.db" ] && RUNTIME_LOG_DATABASE_URL=""

# SQLite-specific setup: create directories and symlinks
if [ "$DB_PROVIDER" = "sqlite" ]; then
  # Ensure the database directory exists
  mkdir -p /db

  # Create a symbolic link from /app/db to /db to ensure both paths point to the same location
  mkdir -p /app
  ln -sf /db /app/db

  # Set default DATABASE_URL if not provided
  if [ -z "$DATABASE_URL" ] || [ "$DATABASE_URL" = "file:/db/baby-tracker.db" ]; then
    export DATABASE_URL="file:/db/baby-tracker.db"
  fi
  if [ -z "$LOG_DATABASE_URL" ] || [ "$LOG_DATABASE_URL" = "file:/db/baby-tracker-logs.db" ]; then
    export LOG_DATABASE_URL="file:/db/baby-tracker-logs.db"
  fi
fi

# Set up timezone for Alpine Linux
if [ -n "$TZ" ]; then
  # Create the timezone file if it doesn't exist
  echo "$TZ" > /etc/TZ
  # Create a symlink to the zoneinfo file if it exists
  if [ -f "/usr/share/zoneinfo/$TZ" ]; then
    ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime
  fi
fi

# Ensure all required environment variables exist with defaults
echo "Ensuring environment defaults..."
npm run env:ensure -- docker /app/env/.env

# Source the env file so vars are available in this shell session
ENV_FILE="/app/env/.env"
set -a
. "$ENV_FILE"
set +a

# Runtime container env takes precedence over the persisted env file for DB
# settings (issue #171): a stale or baked sqlite env file must not clobber a
# PostgreSQL deployment.
[ -n "$RUNTIME_DATABASE_PROVIDER" ] && export DATABASE_PROVIDER="$RUNTIME_DATABASE_PROVIDER"
[ -n "$RUNTIME_DATABASE_URL" ] && export DATABASE_URL="$RUNTIME_DATABASE_URL"
[ -n "$RUNTIME_LOG_DATABASE_URL" ] && export LOG_DATABASE_URL="$RUNTIME_LOG_DATABASE_URL"

# Fail fast on a provider/URL mismatch instead of silently falling back to an
# empty SQLite database (URLs are not echoed: they may contain credentials).
if [ "$DB_PROVIDER" = "postgresql" ]; then
  case "$DATABASE_URL" in
    postgres://*|postgresql://*) ;;
    *)
      echo "ERROR: DATABASE_PROVIDER is postgresql but DATABASE_URL is empty or does not start with postgresql://"
      echo "Set DATABASE_URL to your PostgreSQL connection string (see docker-compose.postgres.yml)."
      exit 1
      ;;
  esac
  case "$LOG_DATABASE_URL" in
    postgres://*|postgresql://*) ;;
    *)
      echo "ERROR: DATABASE_PROVIDER is postgresql but LOG_DATABASE_URL is empty or does not start with postgresql://"
      echo "Set LOG_DATABASE_URL to your PostgreSQL connection string (see docker-compose.postgres.yml)."
      exit 1
      ;;
  esac
fi

echo "Generating Prisma clients..."
npm run prisma:generate
npm run prisma:generate:log

if [ "$DB_PROVIDER" = "postgresql" ]; then
  # PostgreSQL: wait for database to be ready, then push schema
  echo "Waiting for PostgreSQL to be ready..."
  # Extract host and port from DATABASE_URL for pg_isready
  PG_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
  PG_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  PG_PORT="${PG_PORT:-5432}"

  if [ -n "$PG_HOST" ]; then
    RETRIES=30
    until pg_isready -h "$PG_HOST" -p "$PG_PORT" -q 2>/dev/null || [ "$RETRIES" -eq 0 ]; do
      echo "Waiting for PostgreSQL at $PG_HOST:$PG_PORT... ($RETRIES retries left)"
      RETRIES=$((RETRIES - 1))
      sleep 1
    done

    if [ "$RETRIES" -eq 0 ]; then
      echo "WARNING: PostgreSQL may not be ready, attempting to continue..."
    else
      echo "PostgreSQL is ready."
    fi
  fi

  echo "Pushing database schema to PostgreSQL..."
  npx prisma db push --accept-data-loss --skip-generate

  echo "Pushing log database schema to PostgreSQL..."
  npx prisma db push --schema=prisma/log-schema.prisma --accept-data-loss --skip-generate
else
  # SQLite: use migration deploy (existing behavior)
  echo "Running database migrations..."
  npx prisma migrate deploy

  echo "Creating log database schema..."
  npx prisma db push --schema=prisma/log-schema.prisma --accept-data-loss --skip-generate
fi

echo "Seeding database..."
# Seed script has built-in checks for all entities (families, caretakers, settings, units)
# It only creates/updates what doesn't exist, so it's safe to run on every startup
npx prisma db seed

# Notification setup (only if enabled)
if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then
  echo ""
  echo "=== Notification Setup ==="
  echo "Notifications are enabled, setting up notification infrastructure..."

  echo "VAPID keys are generated automatically in the database during seeding."
  echo "✓ NOTIFICATION_CRON_SECRET handled by env:ensure script"

  # Check APP_URL or ROOT_DOMAIN
  APP_URL_CHECK=$(grep -E "^APP_URL=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')
  ROOT_DOMAIN_CHECK=$(grep -E "^ROOT_DOMAIN=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')
  if [ -z "$APP_URL_CHECK" ] && [ -z "$ROOT_DOMAIN_CHECK" ]; then
    echo "⚠ Warning: Neither APP_URL nor ROOT_DOMAIN is set"
    echo "  Cron job will default to http://localhost:3000"
  else
    echo "✓ API URL configuration found"
  fi

  # Setup cron job
  echo "Setting up notification cron job..."
  npm run notification:cron:setup
  if [ $? -eq 0 ]; then
    echo "✓ Cron job setup completed"
  else
    echo "⚠ Warning: Cron job setup failed, but continuing..."
  fi

  # Start cron daemon in background
  echo "Starting cron daemon..."
  crond -f -d 8 &
  CRON_PID=$!
  if [ $? -eq 0 ]; then
    echo "✓ Cron daemon started (PID: $CRON_PID)"
  else
    echo "⚠ Warning: Failed to start cron daemon"
  fi

  echo "=== Notification Setup Complete ==="
  echo ""
else
  echo "Notifications are disabled (ENABLE_NOTIFICATIONS != true)"
fi

echo "Starting application..."
exec "$@"
