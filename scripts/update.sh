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
# `git stash` exits 0 even with nothing to save, so compare stash counts to know whether
# this run created a stash; otherwise `stash pop` would apply an unrelated older stash.
STASH_COUNT_BEFORE=$(git stash list | wc -l)
git stash
STASHED=false
[ "$(git stash list | wc -l)" -gt "$STASH_COUNT_BEFORE" ] && STASHED=true
HEAD_BEFORE=$(git rev-parse HEAD)

# Pull latest changes from git
echo "Pulling latest changes from git..."
git pull
if [ $? -ne 0 ]; then
    echo "Error: Git pull failed!"
    # Apply stashed changes if there were any
    if [ "$STASHED" = true ]; then
        echo "Applying stashed changes..."
        git stash pop
    fi
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Apply stashed changes if there were any
if [ "$STASHED" = true ]; then
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

# Generate the log Prisma client (separate schema; not produced by prisma:generate)
echo "Generating log Prisma client..."
npm run prisma:generate:log
if [ $? -ne 0 ]; then
    echo "Error: Log Prisma client generation failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Run Prisma migrations. `migrate deploy` only applies committed migrations; never use
# `migrate dev` here (it offers to reset the DB on drift and fails without a TTY, e.g. st-guardian).
echo "Running database migrations..."
npx prisma migrate deploy
if [ $? -ne 0 ]; then
    echo "Error: Prisma migrations failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Sync the log database schema (no migrations; pushed directly, same as setup.sh)
echo "Syncing log database schema..."
npx prisma db push --config prisma/log.config.ts --accept-data-loss
if [ $? -ne 0 ]; then
    echo "Error: Log database schema sync failed!"
    "$SCRIPT_DIR/service.sh" start
    exit 1
fi

# Convert legacy Prisma 6 integer DateTimes to Prisma 7 text (idempotent, SQLite only)
echo "Converting legacy SQLite datetime values..."
node "$SCRIPT_DIR/convert-sqlite-datetimes.js"

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

# Convert legacy solids feeds to food logs (idempotent, safe to rerun)
echo "Converting legacy solids feeds to food logs..."
node "$SCRIPT_DIR/convert-solids-feeds.js"
if [ $? -ne 0 ]; then
    echo "Warning: Solids feed conversion had issues. Continuing deployment."
fi

# Reset changelog seen status so all users see "New Updates" badge
echo "Resetting changelog seen status..."
node "$SCRIPT_DIR/reset-changelog-seen.js"
if [ $? -ne 0 ]; then
    echo "Warning: Failed to reset changelog seen status. Continuing deployment."
fi

# Build the application
echo "Building the application..."
npm run build
BUILD_STATUS=$?
if [ $BUILD_STATUS -ne 0 ]; then
    # .next was removed before the update, so starting the service now would only crash-loop.
    # Leave it stopped (st-guardian keeps serving its maintenance page) and restore from the backup.
    echo "Error: Build failed! Service left stopped; restore from the backup created by deployment.sh."
    exit 1
fi

# Refresh st-guardian if this update changed it. Its restart is delayed so a guardian-driven
# update can finish its post-update health check and report the result first.
if [ -f "$PROJECT_DIR/st-guardian/package.json" ] && \
   ! git diff --quiet "$HEAD_BEFORE" HEAD -- st-guardian 2>/dev/null; then
    echo "Updating st-guardian dependencies..."
    (cd "$PROJECT_DIR/st-guardian" && npm install --omit=dev) || echo "Warning: st-guardian npm install failed."
    if systemctl list-unit-files st-guardian.service >/dev/null 2>&1; then
        echo "Scheduling st-guardian restart in 2 minutes..."
        sudo systemd-run --on-active=120 --unit=st-guardian-restart-$(date +%s) \
            systemctl restart st-guardian >/dev/null || echo "Warning: could not schedule st-guardian restart."
    fi
fi

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
"$SCRIPT_DIR/service.sh" start || exit 1

echo "Update completed successfully!"
