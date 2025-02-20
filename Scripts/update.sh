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

# Pull latest changes from git
echo "Pulling latest changes from git..."
cd "$PROJECT_DIR" || exit 1
git pull
if [ $? -ne 0 ]; then
    echo "Error: Git pull failed!"
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

# Build the application
echo "Building the application..."
npm run build
BUILD_STATUS=$?

# Start the service after update
echo "Starting service after update..."
"$SCRIPT_DIR/service.sh" start

if [ $BUILD_STATUS -eq 0 ]; then
    echo "Update completed successfully!"
else
    echo "Error: Build failed!"
    exit 1
fi
