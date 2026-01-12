#!/bin/bash

# Script to trigger notification cron check via API
# This script is called by system cron every minute

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from .env file if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
  # Export variables from .env file (simple parsing, handles quoted values)
  set -a
  source "$PROJECT_DIR/.env" 2>/dev/null || true
  set +a
fi

# Check if notifications are enabled
if [ "$ENABLE_NOTIFICATIONS" != "true" ]; then
  exit 0  # Silently exit if notifications are disabled
fi

# Check if cron secret is set
if [ -z "$NOTIFICATION_CRON_SECRET" ]; then
  echo "$(date): ERROR: NOTIFICATION_CRON_SECRET is not set" >&2
  exit 1
fi

# Determine API URL
if [ -n "$APP_URL" ]; then
  API_URL="$APP_URL"
elif [ -n "$ROOT_DOMAIN" ]; then
  # Determine protocol based on environment
  if [ "$NODE_ENV" = "production" ]; then
    PROTOCOL="https"
  else
    PROTOCOL="http"
  fi
  API_URL="$PROTOCOL://$ROOT_DOMAIN"
else
  # Default to localhost for development
  API_URL="http://localhost:3000"
fi

# Construct full endpoint URL
ENDPOINT_URL="$API_URL/api/notifications/cron"

# Make the API call
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$ENDPOINT_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $NOTIFICATION_CRON_SECRET" \
  --max-time 30 \
  --connect-timeout 10)

# Extract HTTP status code (last line)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
# Extract response body (all but last line)
RESPONSE_BODY=$(echo "$RESPONSE" | sed '$d')

# Check if request was successful
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  # Success - exit silently (cron will only log errors)
  exit 0
else
  # Error - log to stderr
  echo "$(date): ERROR: API call failed with HTTP $HTTP_CODE" >&2
  echo "$(date): Response: $RESPONSE_BODY" >&2
  exit 1
fi
