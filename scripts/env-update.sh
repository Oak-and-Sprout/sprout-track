#!/bin/bash

# This script checks and updates the .env file:
# - Creates .env file if it doesn't exist
# - Adds default environment variables for local deployment
# - Checks for ENC_HASH and generates one if missing or blank
# - Used for local deployment configuration and data encryption

# Get the project directory (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")

echo "Checking and updating environment configuration..."

# Use the centralized ensure-env-defaults script (single source of truth)
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
node "$SCRIPT_DIR/ensure-env-defaults.js" local "$PROJECT_DIR/.env"

echo "Environment configuration check completed." 