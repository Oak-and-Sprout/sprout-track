#!/bin/bash
# Creates additional PostgreSQL databases needed by Sprout Track.
# This script runs automatically on first PostgreSQL container startup
# via the docker-entrypoint-initdb.d mechanism.

set -e

LOG_DB="${POSTGRES_LOG_DB:-sprout_track_logs}"

echo "Creating log database: $LOG_DB"
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE "$LOG_DB"'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$LOG_DB')\gexec
EOSQL
echo "Log database ready."
