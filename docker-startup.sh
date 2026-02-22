#!/bin/sh

# Ensure the database directory exists
mkdir -p /db

# Create a symbolic link from /app/db to /db to ensure both paths point to the same location
mkdir -p /app
ln -sf /db /app/db

# Set up timezone for Alpine Linux
if [ -n "$TZ" ]; then
  # Create the timezone file if it doesn't exist
  echo "$TZ" > /etc/TZ
  # Create a symlink to the zoneinfo file if it exists
  if [ -f "/usr/share/zoneinfo/$TZ" ]; then
    ln -sf "/usr/share/zoneinfo/$TZ" /etc/localtime
  fi
fi

# Check and generate ENC_HASH if missing
echo "Checking for ENC_HASH in .env file..."
ENV_FILE="/app/env/.env"

# Check if ENC_HASH exists and has a value
ENC_HASH_EXISTS=$(grep -E "^ENC_HASH=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')

if [ -z "$ENC_HASH_EXISTS" ]; then
    echo "ENC_HASH not found. Generating unique ENC_HASH for this container..."
    
    # Generate a secure random hash (64 characters)
    RANDOM_HASH=$(openssl rand -hex 32)
    
    # Add ENC_HASH to .env file
    echo "" >> "$ENV_FILE"
    echo "# Encryption hash for data encryption (generated at container startup)" >> "$ENV_FILE"
    echo "ENC_HASH=\"$RANDOM_HASH\"" >> "$ENV_FILE"
    
    echo "ENC_HASH generated and added to .env file"
else
    echo "ENC_HASH already exists in .env file"
fi

echo "Generating Prisma clients..."
DATABASE_URL="file:/db/baby-tracker.db" npm run prisma:generate
LOG_DATABASE_URL="file:/db/baby-tracker-logs.db" npm run prisma:generate:log

echo "Running database migrations..."
# Deploy main database migrations
DATABASE_URL="file:/db/baby-tracker.db" npx prisma migrate deploy

echo "Creating log database schema..."
# Create/update log database schema
LOG_DATABASE_URL="file:/db/baby-tracker-logs.db" npx prisma db push --schema=prisma/log-schema.prisma --accept-data-loss --skip-generate

echo "Seeding database..."
# Seed script has built-in checks for all entities (families, caretakers, settings, units)
# It only creates/updates what doesn't exist, so it's safe to run on every startup
DATABASE_URL="file:/db/baby-tracker.db" npx prisma db seed

# Notification setup (only if enabled)
if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then
  echo ""
  echo "=== Notification Setup ==="
  echo "Notifications are enabled, setting up notification infrastructure..."
  
  # Check and generate VAPID keys if missing
  echo "Checking for VAPID keys..."
  VAPID_PUBLIC_EXISTS=$(grep -E "^VAPID_PUBLIC_KEY=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')
  VAPID_PRIVATE_EXISTS=$(grep -E "^VAPID_PRIVATE_KEY=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')
  
  if [ -z "$VAPID_PUBLIC_EXISTS" ] || [ -z "$VAPID_PRIVATE_EXISTS" ]; then
    echo "VAPID keys not found. Generating new VAPID keypair..."
    DATABASE_URL="file:/db/baby-tracker.db" npm run setup:vapid
    if [ $? -eq 0 ]; then
      echo "✓ VAPID keys generated successfully"
    else
      echo "⚠ Warning: VAPID key generation failed, but continuing..."
    fi
  else
    echo "✓ VAPID keys already exist"
  fi
  
  # Validate required environment variables
  echo "Validating notification environment variables..."
  NOTIFICATION_CRON_SECRET_CHECK=$(grep -E "^NOTIFICATION_CRON_SECRET=" "$ENV_FILE" 2>/dev/null | cut -d '=' -f2 | tr -d '"')
  if [ -z "$NOTIFICATION_CRON_SECRET_CHECK" ]; then
    echo "⚠ Warning: NOTIFICATION_CRON_SECRET is not set in .env file"
    echo "  Timer notifications will not work without this secret"
  else
    echo "✓ NOTIFICATION_CRON_SECRET is set"
  fi
  
  # Set default log retention if not specified
  if ! grep -q "^NOTIFICATION_LOG_RETENTION_DAYS=" "$ENV_FILE" 2>/dev/null; then
    echo "NOTIFICATION_LOG_RETENTION_DAYS=30" >> "$ENV_FILE"
    echo "✓ Set default NOTIFICATION_LOG_RETENTION_DAYS=30"
  fi
  
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
  DATABASE_URL="file:/db/baby-tracker.db" npm run notification:cron:setup
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
