#!/bin/bash

# Example script for automated test data generation
# This script can be used in cron jobs or automated deployments

# Set the script directory
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

# Example 1: Generate test data for development environment
echo "Generating test data for development environment..."

# Set environment variables for automation
export FAMILY_COUNT=5
export DAYS_COUNT=60
export CLEAR_DATA=true

# Run the test data generator
bash "$SCRIPT_DIR/generate-test-data.sh"

# Example 2: For staging environment (commented out)
# echo "Generating test data for staging environment..."
# export FAMILY_COUNT=5
# export DAYS_COUNT=30
# export CLEAR_DATA=false
# bash "$SCRIPT_DIR/generate-test-data.sh"

# Example 3: For quick testing (commented out)
# echo "Generating minimal test data..."
# export FAMILY_COUNT=1
# export DAYS_COUNT=7
# export CLEAR_DATA=true
# bash "$SCRIPT_DIR/generate-test-data.sh"

echo "Automated test data generation completed!" 