#!/bin/bash

# This script manages the service operations (start/stop)
# The service name should be configured in the .env file

# Get the directory name of the project (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")

# Read service name from .env file
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Error: .env file not found!"
    exit 1
fi

SERVICE_NAME=$(grep "SERVICE_NAME" "$PROJECT_DIR/.env" | cut -d '"' -f 2)
if [ -z "$SERVICE_NAME" ]; then
    echo "Error: SERVICE_NAME not found in .env file!"
    exit 1
fi

# Function to start the service
start_service() {
    echo "Starting $SERVICE_NAME service..."
    sudo systemctl start "$SERVICE_NAME" || { echo "Error: failed to start $SERVICE_NAME!"; return 1; }
    echo "Service started successfully!"
}

# Function to stop the service
stop_service() {
    echo "Stopping $SERVICE_NAME service..."
    sudo systemctl stop "$SERVICE_NAME" || { echo "Error: failed to stop $SERVICE_NAME!"; return 1; }
    echo "Service stopped successfully!"
}

# Function to show service status
status_service() {
    echo "Checking $SERVICE_NAME service status..."
    sudo systemctl status "$SERVICE_NAME"
}

# Check command line arguments
case "$1" in
    start)
        start_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service && start_service
        ;;
    status)
        status_service
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        exit 1
        ;;
esac

# Propagate the systemctl result so callers (deployment.sh, update.sh, st-guardian) see failures
exit $?
