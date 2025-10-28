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
# Explicitly set DATABASE_URL for migrations
DATABASE_URL="file:/db/baby-tracker.db" npx prisma migrate deploy

echo "Checking if database needs seeding..."
# Use the same DATABASE_URL for checking settings
SETTINGS_COUNT=$(DATABASE_URL="file:/db/baby-tracker.db" node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function checkSettings() {
  try {
    const count = await prisma.settings.count();
    console.log(count);
  } catch (error) {
    console.log(0);
  } finally {
    await prisma.\$disconnect();
  }
}
checkSettings();
")

if [ "$SETTINGS_COUNT" = "0" ] || [ -z "$SETTINGS_COUNT" ]; then
  echo "Settings table is empty. Running seed script..."
  DATABASE_URL="file:/db/baby-tracker.db" npx prisma db seed
else
  echo "Database already seeded. Skipping seed script."
fi

echo "Starting application..."
exec "$@"
