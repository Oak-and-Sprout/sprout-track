#!/bin/bash

# This script performs the initial setup for the Sprout Track application:
# 1. Checks for Node.js installation (must be installed beforehand)
# 2. Installs dependencies
# 3. Generates the Prisma clients (main and log)
# 4. Runs database migrations (creates the database schemas for main and log databases)
# 5. Seeds the database with initial data (creates default family, system caretaker with PIN 111222, and units)
# 6. Builds the Next.js application

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

# Step 5: Run database migrations (main and log)
echo "Step 5: Running database migrations..."

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

echo "-------------------------------------"
echo "Sprout Track setup completed successfully!"
echo "Default security PIN: 111222"
echo "Default family: My Family (my-family)"
echo ""
echo "Navigate to the application and use PIN 111222 to complete setup."
echo ""
echo "To run the development server:"
echo "  npm run dev"
echo ""
echo "To run the production server:"
echo "  npm run start"
echo "-------------------------------------"

exit 0
