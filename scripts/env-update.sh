#!/bin/bash

# This script checks and updates the .env file:
# - Creates .env file if it doesn't exist
# - Adds default environment variables for local deployment
# - Checks for ENC_HASH and generates one if missing or blank
# - Used for local deployment configuration and data encryption

# Get the project directory (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")

echo "Checking and updating environment configuration..."

# Check and generate ENC_HASH for local deployment encryption
echo "Checking for ENC_HASH in .env file..."
ENV_FILE="$PROJECT_DIR/.env"

# Create .env file if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if ENC_HASH exists and has a value
ENC_HASH_EXISTS=$(grep -E "^ENC_HASH=" "$ENV_FILE" | cut -d '=' -f2)

if [ -z "$ENC_HASH_EXISTS" ]; then
    echo "Adding ENC_HASH to .env file..."
    
    # Generate a secure random hash (64 characters)
    RANDOM_HASH=$(openssl rand -hex 32)
    
    # Add default environment variables and ENC_HASH to .env file
    echo "" >> "$ENV_FILE"
    echo "# Default environment variables for local deployment" >> "$ENV_FILE"
    echo "DATABASE_URL=\"file:../db/baby-tracker.db\"" >> "$ENV_FILE"
    echo "LOG_DATABASE_URL=\"file:../db/api-logs.db\"" >> "$ENV_FILE"
    echo "ENABLE_LOG=false" >> "$ENV_FILE"
    echo "NODE_ENV=development" >> "$ENV_FILE"
    echo "PORT=3000" >> "$ENV_FILE"
    echo "TZ=UTC" >> "$ENV_FILE"
    echo "AUTH_LIFE=86400" >> "$ENV_FILE"
    echo "IDLE_TIME=604800" >> "$ENV_FILE"
    echo "REFRESH_TOKEN_LIFE=604800" >> "$ENV_FILE"
    echo "APP_VERSION=1.0.0" >> "$ENV_FILE"
    echo "COOKIE_SECURE=false" >> "$ENV_FILE"
    echo "# Encryption hash for local deployment data encryption" >> "$ENV_FILE"
    echo "ENC_HASH=\"$RANDOM_HASH\"" >> "$ENV_FILE"
    echo "# Secret for securing the cron trigger endpoint" >> "$ENV_FILE"
    echo "NOTIFICATION_CRON_SECRET=" >> "$ENV_FILE"
    echo "# Enable push notifications (true/false)" >> "$ENV_FILE"
    echo "ENABLE_NOTIFICATIONS=false" >> "$ENV_FILE"
    
    echo "Environment variables and ENC_HASH generated and added to .env file"
else
    echo "ENC_HASH already exists in .env file"
fi

# Check and generate NOTIFICATION_CRON_SECRET for push notification cron security
echo "Checking for NOTIFICATION_CRON_SECRET in .env file..."
CRON_SECRET_EXISTS=$(grep -E "^NOTIFICATION_CRON_SECRET=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')

if [ -z "$CRON_SECRET_EXISTS" ]; then
    echo "NOTIFICATION_CRON_SECRET not found or empty. Generating secure cron secret..."
    # Generate a secure random secret (64 characters hex = 32 bytes)
    CRON_SECRET=$(openssl rand -hex 32)

    # Check if the line exists but is empty
    if grep -q "^NOTIFICATION_CRON_SECRET=" "$ENV_FILE"; then
        # Update existing empty line
        sed -i.bak "s/^NOTIFICATION_CRON_SECRET=.*/NOTIFICATION_CRON_SECRET=\"$CRON_SECRET\"/" "$ENV_FILE"
        rm -f "$ENV_FILE.bak"
    else
        # Add new line
        echo "NOTIFICATION_CRON_SECRET=\"$CRON_SECRET\"" >> "$ENV_FILE"
    fi
    echo "NOTIFICATION_CRON_SECRET generated and added to .env file"
else
    echo "NOTIFICATION_CRON_SECRET already exists in .env file"
fi

# Check and add REFRESH_TOKEN_LIFE for sliding-window refresh token support
echo "Checking for REFRESH_TOKEN_LIFE in .env file..."
REFRESH_TOKEN_EXISTS=$(grep -E "^REFRESH_TOKEN_LIFE=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')

if [ -z "$REFRESH_TOKEN_EXISTS" ]; then
    echo "REFRESH_TOKEN_LIFE not found. Adding with default value (604800 = 7 days)..."
    echo "# Refresh token lifetime in seconds (default 7 days). Sliding window: resets on each refresh." >> "$ENV_FILE"
    echo "REFRESH_TOKEN_LIFE=604800" >> "$ENV_FILE"
    echo "REFRESH_TOKEN_LIFE added to .env file"
else
    echo "REFRESH_TOKEN_LIFE already exists in .env file"
fi

# Update IDLE_TIME to match REFRESH_TOKEN_LIFE (idle timeout is effectively deprecated by refresh tokens)
echo "Checking IDLE_TIME alignment with REFRESH_TOKEN_LIFE..."
IDLE_TIME_VALUE=$(grep -E "^IDLE_TIME=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')
REFRESH_TOKEN_VALUE=$(grep -E "^REFRESH_TOKEN_LIFE=" "$ENV_FILE" | cut -d '=' -f2 | tr -d '"')

if [ -n "$IDLE_TIME_VALUE" ] && [ -n "$REFRESH_TOKEN_VALUE" ] && [ "$IDLE_TIME_VALUE" != "$REFRESH_TOKEN_VALUE" ]; then
    echo "Updating IDLE_TIME ($IDLE_TIME_VALUE) to match REFRESH_TOKEN_LIFE ($REFRESH_TOKEN_VALUE)..."
    sed -i.bak "s/^IDLE_TIME=.*/IDLE_TIME=$REFRESH_TOKEN_VALUE/" "$ENV_FILE"
    rm -f "$ENV_FILE.bak"
    echo "IDLE_TIME updated to $REFRESH_TOKEN_VALUE"
else
    echo "IDLE_TIME already aligned with REFRESH_TOKEN_LIFE"
fi

echo "Environment configuration check completed." 