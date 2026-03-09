#!/bin/bash

# This script updates the application:
# - Pulls latest changes from git
# - Runs Prisma operations
# - Builds the application

# Get the directory name of the project (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

# Stop the service before update
echo "Stopping service before update..."
"$SCRIPT_DIR/service.sh" stop
if [ $? -ne 0 ]; then
    echo "Error: Failed to stop service!"
    exit 1
fi

# Stash any local changes before pulling
echo "Stashing any local changes..."
cd "$PROJECT_DIR" || exit 1
git stash
STASH_RESULT=$?

# Pull latest changes from git
echo "Pulling latest changes from git..."
git pull
if [ $? -ne 0 ]; then
    echo "Error: Git pull failed!"
    # Apply stashed changes if there were any
    if [ $STASH_RESULT -eq 0 ]; then
        echo "Applying stashed changes..."
        git stash pop
    fi
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Apply stashed changes if there were any
if [ $STASH_RESULT -eq 0 ]; then
    echo "Applying stashed changes..."
    git stash pop
    # Note: We continue even if there are conflicts
fi

# Install dependencies
echo "Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: npm install failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Generate Prisma client
echo "Generating Prisma client..."
npm run prisma:generate
if [ $? -ne 0 ]; then
    echo "Error: Prisma client generation failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Run Prisma migrations
echo "Running database migrations..."
npm run prisma:migrate
if [ $? -ne 0 ]; then
    echo "Error: Prisma migrations failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Run the family update script for multi-family support
echo "Running family data update for multi-family support..."
"$SCRIPT_DIR/family-update.sh"
if [ $? -ne 0 ]; then
    echo "Error: Family data update failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Seed the database with any new data
echo "Seeding the database with any new settings and units..."
npm run prisma:seed
if [ $? -ne 0 ]; then
    echo "Error: Database seeding failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Build the application
echo "Building the application..."
npm run build
BUILD_STATUS=$?

# Re-verify notification setup (if enabled)
echo "Checking notification configuration..."
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    set +a
fi

if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then
    echo "  Notifications are enabled. Re-verifying notification infrastructure..."

    # Ensure VAPID keys exist
    echo "  - Verifying VAPID keys..."
    npm run setup:vapid
    if [ $? -ne 0 ]; then
        echo "  Warning: VAPID key setup had issues."
    fi

    # Re-verify cron job (in case script path changed after update)
    echo "  - Verifying notification cron job..."
    npm run notification:cron:setup
    if [ $? -ne 0 ]; then
        echo "  Warning: Notification cron setup had issues."
    fi
else
    echo "  Notifications are disabled. Skipping notification setup."
fi

# Start the service after update
echo "Starting service after update..."
"$SCRIPT_DIR/service.sh" start

if [ $BUILD_STATUS -eq 0 ]; then
    echo "Update completed successfully!"
else
    echo "Error: Build failed!"
    exit 1
fi
