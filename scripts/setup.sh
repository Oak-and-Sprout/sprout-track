#!/bin/bash

# This script performs the initial setup for the Sprout Track application:
# 1. Checks for Node.js installation (must be installed beforehand)
# 2. Sets up environment configuration (.env file, ENC_HASH, VAPID keys, cron secret)
# 3. Installs dependencies
# 4. Generates the Prisma clients (main and log)
# 5. Runs database migrations (creates the database schemas for main and log databases)
# 6. Seeds the database with initial data (creates default family, system caretaker with PIN 111222, and units)
# 7. Builds the Next.js application
# 8. Sets up push notification infrastructure (if ENABLE_NOTIFICATIONS=true)

# Get the project directory (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
cd "$PROJECT_DIR" || exit 1

echo "Starting Sprout Track setup..."

# Step 1: Check if Node.js is installed
echo "Step 1: Checking for Node.js installation..."

# Check if node is installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "Node.js is installed (${NODE_VERSION})."
    
    # Check if npm is installed
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo "npm is installed (${NPM_VERSION})."
    else
        echo "Error: npm is not installed! Please install npm before running this script."
        exit 1
    fi
else
    echo "Error: Node.js is not installed! Please install Node.js (v22 recommended) before running this script."
    echo "Visit https://nodejs.org/ for installation instructions."
    exit 1
fi

# Step 2: Update environment configuration
echo "Step 2: Setting up environment configuration..."
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
"$SCRIPT_DIR/env-update.sh"
if [ $? -ne 0 ]; then
    echo "Error: Environment setup failed! Setup aborted."
    exit 1
fi

# Load database configuration from .env (only DB vars, to avoid interfering with the build)
if [ -f "$PROJECT_DIR/.env" ]; then
    _db_provider=$(grep -m1 '^DATABASE_PROVIDER=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
    _db_url=$(grep -m1 '^DATABASE_URL=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
    _log_db_url=$(grep -m1 '^LOG_DATABASE_URL=' "$PROJECT_DIR/.env" | cut -d= -f2- | tr -d '"' | tr -d "'")
    [ -n "$_db_provider" ] && export DATABASE_PROVIDER="$_db_provider"
    [ -n "$_db_url" ] && export DATABASE_URL="$_db_url"
    [ -n "$_log_db_url" ] && export LOG_DATABASE_URL="$_log_db_url"
    echo "Database configuration loaded (provider: ${DATABASE_PROVIDER:-sqlite})."
fi

# Step 3: Install dependencies
echo "Step 3: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "Error: npm install failed! Setup aborted."
    exit 1
fi
echo "Dependencies installed successfully."

# Disable Next.js telemetry
echo "Disabling Next.js telemetry..."
npm exec next telemetry disable
echo "Next.js telemetry disabled."

# Step 4: Generate Prisma clients (main and log)
echo "Step 4: Generating Prisma clients..."

echo "  - Generating main Prisma client..."
npm run prisma:generate
if [ $? -ne 0 ]; then
    echo "Error: Main Prisma client generation failed! Setup aborted."
    exit 1
fi
echo "  - Main Prisma client generated successfully."

echo "  - Generating log Prisma client..."
npx prisma generate --schema=prisma/log-schema.prisma
if [ $? -ne 0 ]; then
    echo "Error: Log Prisma client generation failed! Setup aborted."
    exit 1
fi
echo "  - Log Prisma client generated successfully."

echo "Prisma clients generated successfully."

# Detect database provider
DB_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
echo "Database provider: $DB_PROVIDER"

# Step 5: Run database migrations (main and log)
echo "Step 5: Running database migrations..."

if [ "$DB_PROVIDER" = "postgresql" ]; then
    echo "  - Pushing main database schema to PostgreSQL..."
    npx prisma db push --accept-data-loss --skip-generate
    if [ $? -ne 0 ]; then
        echo "Error: PostgreSQL schema push failed! Setup aborted."
        exit 1
    fi
    echo "  - Main database schema pushed successfully."

    echo "  - Pushing log database schema to PostgreSQL..."
    npx prisma db push --schema=prisma/log-schema.prisma --accept-data-loss --skip-generate
    if [ $? -ne 0 ]; then
        echo "Error: Log database schema push failed! Setup aborted."
        exit 1
    fi
    echo "  - Log database schema pushed successfully."
else
    echo "  - Deploying main database migrations..."
    npx prisma migrate deploy
    if [ $? -ne 0 ]; then
        echo "Error: Main database migrations failed! Setup aborted."
        exit 1
    fi
    echo "  - Main database migrations deployed successfully."

    echo "  - Creating log database schema..."
    npx prisma db push --schema=prisma/log-schema.prisma --accept-data-loss
    if [ $? -ne 0 ]; then
        echo "Error: Log database creation failed! Setup aborted."
        exit 1
    fi
    echo "  - Log database schema created successfully."
fi

echo "Database migrations deployed successfully."

# Step 6: Seed the database (creates default family, system caretaker, settings, and units)
echo "Step 6: Seeding the database with default family, system caretaker (PIN: 111222), and units..."
npm run prisma:seed
if [ $? -ne 0 ]; then
    echo "Error: Database seeding failed! Setup aborted."
    exit 1
fi
echo "Database seeded successfully with default family, system caretaker (PIN: 111222), and units."

# Step 7: Build the Next.js application
echo "Step 7: Building the Next.js application..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Build process failed! Setup aborted."
    exit 1
fi
echo "Next.js application built successfully."

# Step 8: Notification setup (if enabled)
echo "Step 8: Checking notification configuration..."

# Source .env to get current values
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env" 2>/dev/null || true
    set +a
fi

if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then
    echo "  Notification infrastructure is enabled."
    echo "  VAPID keys are generated automatically in the database during seeding."

    # Set up the cron job for timer notifications
    echo "  - Setting up notification cron job..."
    npm run notification:cron:setup
    if [ $? -ne 0 ]; then
        echo "  Warning: Notification cron setup had issues, but setup will continue."
        echo "  You can run 'npm run notification:cron:setup' manually later."
    else
        echo "  Notification cron job configured successfully."
    fi

    echo ""
    echo "  Manage notification settings via App Configuration in the admin UI."
else
    echo "  Notification infrastructure is disabled (ENABLE_NOTIFICATIONS is not 'true')."
    echo "  To enable, set ENABLE_NOTIFICATIONS=true in .env and re-run setup."
    echo "  Notification settings are managed via App Configuration in the admin UI."
fi

echo "-------------------------------------"
echo "Sprout Track setup completed successfully!"
echo "Default security PIN: 111222"
echo "Default family: My Family (my-family)"
echo ""
if [ "$ENABLE_NOTIFICATIONS" = "true" ]; then
    echo "Push notifications: INFRASTRUCTURE ENABLED"
    echo "  - VAPID keys: auto-generated in database"
    echo "  - Cron job: configured (runs every minute)"
    echo "  - Settings: manage via App Configuration in admin UI"
    echo ""
fi
echo "Navigate to the application and use PIN 111222 to complete setup."
echo ""
echo "To run the development server:"
echo "  npm run dev"
echo ""
echo "To run the production server:"
echo "  npm run start"
echo "-------------------------------------"

exit 0
