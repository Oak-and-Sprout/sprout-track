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
    echo "IDLE_TIME=28800" >> "$ENV_FILE"
    echo "APP_VERSION=0.97.2" >> "$ENV_FILE"
    echo "COOKIE_SECURE=false" >> "$ENV_FILE"
    echo "# Encryption hash for local deployment data encryption" >> "$ENV_FILE"
    echo "ENC_HASH=\"$RANDOM_HASH\"" >> "$ENV_FILE"
    echo "# VAPID keys for Web Push protocol (generated during setup)" >> "$ENV_FILE"
    echo "VAPID_PUBLIC_KEY=" >> "$ENV_FILE"
    echo "VAPID_PRIVATE_KEY=" >> "$ENV_FILE"
    echo "VAPID_SUBJECT=mailto:notifications@<yourdomain.tld>" >> "$ENV_FILE"
    echo "# Secret for securing the cron trigger endpoint" >> "$ENV_FILE"
    echo "NOTIFICATION_CRON_SECRET=" >> "$ENV_FILE"
    
    echo "Environment variables and ENC_HASH generated and added to .env file"
else
    echo "ENC_HASH already exists in .env file"
fi

# Check and generate VAPID keys for push notifications
echo "Checking for VAPID keys in .env file..."
if ! grep -q "^VAPID_PUBLIC_KEY=" "$ENV_FILE" || [ -z "$(grep -E "^VAPID_PUBLIC_KEY=" "$ENV_FILE" | cut -d '=' -f2)" ]; then
    echo "VAPID keys not found or empty. Generating VAPID keys..."
    if command -v ts-node &> /dev/null; then
        ts-node "$(dirname "$(readlink -f "$0")")/setup-vapid-keys.ts"
    else
        echo "⚠️  ts-node not found. Please run 'npm run setup:vapid' manually to generate VAPID keys."
    fi
else
    echo "VAPID keys already exist in .env file"
fi

echo "Environment configuration check completed." 