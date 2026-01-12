#!/bin/bash

# This script helps with Docker setup and management for Sprout Track
# It provides commands for building, starting, stopping, and managing the Docker containers

# Get the project directory (one level up from the script location)
PROJECT_DIR=$(dirname "$(dirname "$(readlink -f "$0")")")
cd "$PROJECT_DIR" || exit 1

# Function to display usage information
show_usage() {
    echo "Sprout Track Docker Management Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build the Docker image"
    echo "  start       Start the Docker containers"
    echo "  stop        Stop the Docker containers"
    echo "  restart     Restart the Docker containers"
    echo "  update      Update the container with latest code and run migrations"
    echo "  backup      Create a backup of the database volume"
    echo "  logs        View container logs"
    echo "  status      Check container status"
    echo "  clean       Remove containers, images, and volumes (caution: data loss)"
    echo "  setup-notifications  Setup notification features (VAPID keys, cron)"
    echo "  test-notifications   Test notification endpoint"
    echo "  notification-logs    View notification cron logs"
    echo "  notification-status  Check notification configuration status"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PORT        Port to expose the application (default: 3000)"
    echo "  ENABLE_NOTIFICATIONS  Enable push notifications (default: false)"
    echo "  NOTIFICATION_CRON_SECRET  Secret for cron endpoint"
    echo "  APP_URL     Base URL for API calls"
    echo ""
    echo "See documentation/PushNotifications-README.md for full notification setup"
    echo ""
    echo "Examples:"
    echo "  $0 build    # Build the Docker image"
    echo "  PORT=8080 $0 start  # Start containers with custom port"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed or not in PATH"
        echo "Please install Docker and try again"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo "Error: docker-compose is not installed or not in PATH"
        echo "Please install docker-compose and try again"
        exit 1
    fi
}

# Build the Docker image
build_image() {
    echo "Building Sprout Track Docker image..."
    docker-compose build
}

# Start the Docker containers
start_containers() {
    echo "Starting Sprout Track containers..."
    docker-compose up -d
    echo "Containers started. The application should be available at:"
    echo "  http://localhost:${PORT:-3000}"
}

# Stop the Docker containers
stop_containers() {
    echo "Stopping Sprout Track containers..."
    docker-compose down
}

# Restart the Docker containers
restart_containers() {
    echo "Restarting Sprout Track containers..."
    docker-compose restart
}

# View container logs
view_logs() {
    echo "Viewing Sprout Track container logs..."
    docker-compose logs -f
}

# Check container status
check_status() {
    echo "Checking Sprout Track container status..."
    docker-compose ps
}

# Create a backup of the database volume
backup_database() {
    echo "Creating backup of the database volume..."
    
    # Get current timestamp for backup filename
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR="${PROJECT_DIR}/backups"
    BACKUP_FILE="${BACKUP_DIR}/sprout-track-db-${TIMESTAMP}.tar"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Check if the container is running
    if docker-compose ps | grep -q "sprout-track"; then
        # Create a temporary container to access the volume and create a backup
        echo "Creating backup from volume..."
        docker run --rm \
            --volumes-from sprout-track \
            -v "${BACKUP_DIR}:/backup" \
            alpine \
            tar -cf "/backup/sprout-track-db-${TIMESTAMP}.tar" /db
        
        if [ $? -eq 0 ]; then
            echo "Backup completed successfully!"
            echo "Backup location: $BACKUP_FILE"
        else
            echo "Error: Backup failed!"
            return 1
        fi
    else
        echo "Error: Container is not running. Start the container first."
        return 1
    fi
    
    return 0
}

# Update the container with latest code and run migrations
update_container() {
    echo "Updating Sprout Track container..."
    
    # Pull latest changes from git
    echo "Pulling latest changes from git..."
    cd "$PROJECT_DIR" || exit 1
    git pull
    if [ $? -ne 0 ]; then
        echo "Error: Git pull failed!"
        return 1
    fi
    
    # Create a backup before updating
    echo "Creating backup before update..."
    backup_database
    if [ $? -ne 0 ]; then
        echo "Warning: Backup failed, but continuing with update..."
    fi
    
    # Rebuild the Docker image with the latest code
    echo "Rebuilding Docker image..."
    docker-compose build
    if [ $? -ne 0 ]; then
        echo "Error: Docker build failed!"
        return 1
    fi
    
    # Stop the container
    echo "Stopping container..."
    docker-compose down
    if [ $? -ne 0 ]; then
        echo "Error: Failed to stop container!"
        return 1
    fi
    
    # Start the container with the new image
    # This will automatically run migrations on startup due to our entrypoint script
    echo "Starting container with new image..."
    docker-compose up -d
    if [ $? -ne 0 ]; then
        echo "Error: Failed to start container!"
        return 1
    fi
    
    echo "Update completed successfully!"
    echo "The application should be available at:"
    echo "  http://localhost:${PORT:-3000}"
    echo "Check logs with: $0 logs"
    
    return 0
}

# Clean up Docker resources
clean_resources() {
    echo "WARNING: This will remove all Sprout Track Docker resources, including data volumes."
    read -p "Are you sure you want to continue? (y/N): " confirm
    
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo "Removing Sprout Track containers, images, and volumes..."
        docker-compose down -v
        docker rmi sprout-track
        echo "Cleanup completed."
    else
        echo "Cleanup cancelled."
    fi
}

# Setup notification features
setup_notifications() {
    echo "Setting up notification features..."
    
    if [ "$ENABLE_NOTIFICATIONS" != "true" ]; then
        echo "Error: ENABLE_NOTIFICATIONS is not set to 'true'"
        echo "Set ENABLE_NOTIFICATIONS=true in your .env file or environment"
        return 1
    fi
    
    echo "Running notification setup inside container..."
    docker-compose exec app npm run notification:cron:setup
    
    if [ $? -eq 0 ]; then
        echo "✓ Notification setup completed"
    else
        echo "⚠ Warning: Notification setup may have failed"
        return 1
    fi
}

# Test notification endpoint
test_notifications() {
    echo "Testing notification cron endpoint..."
    
    if [ -z "$NOTIFICATION_CRON_SECRET" ]; then
        echo "Error: NOTIFICATION_CRON_SECRET is not set"
        echo "Set NOTIFICATION_CRON_SECRET in your .env file"
        return 1
    fi
    
    APP_URL="${APP_URL:-http://localhost:3000}"
    echo "Testing endpoint: $APP_URL/api/notifications/cron"
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$APP_URL/api/notifications/cron" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $NOTIFICATION_CRON_SECRET" \
        --max-time 30)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        echo "✓ Test successful (HTTP $http_code)"
        echo "Response: $body"
    else
        echo "✗ Test failed (HTTP $http_code)"
        echo "Response: $body"
        return 1
    fi
}

# View notification logs
view_notification_logs() {
    echo "Viewing notification cron logs..."
    
    if [ -f "./logs/notification-cron.log" ]; then
        tail -n 100 ./logs/notification-cron.log
    else
        echo "Log file not found: ./logs/notification-cron.log"
        echo "Logs may be in the container. Try: docker-compose exec app cat /app/logs/notification-cron.log"
    fi
}

# Check notification status
check_notification_status() {
    echo "Checking notification configuration status..."
    echo ""
    
    echo "Environment Variables:"
    echo "  ENABLE_NOTIFICATIONS: ${ENABLE_NOTIFICATIONS:-not set}"
    echo "  NOTIFICATION_CRON_SECRET: ${NOTIFICATION_CRON_SECRET:+set (hidden)}${NOTIFICATION_CRON_SECRET:-not set}"
    echo "  APP_URL: ${APP_URL:-not set}"
    echo "  ROOT_DOMAIN: ${ROOT_DOMAIN:-not set}"
    echo ""
    
    if docker-compose ps | grep -q "sprout-track.*Up"; then
        echo "Container Status: Running"
        echo ""
        echo "Checking cron job..."
        docker-compose exec app crontab -l 2>/dev/null | grep -q "notification-cron" && echo "  ✓ Cron job installed" || echo "  ✗ Cron job not found"
        echo ""
        echo "Checking cron daemon..."
        docker-compose exec app pgrep crond > /dev/null 2>&1 && echo "  ✓ Cron daemon running" || echo "  ✗ Cron daemon not running"
    else
        echo "Container Status: Not running"
        echo "Start the container first with: $0 start"
    fi
}

# Main script logic
check_docker

case "$1" in
    build)
        build_image
        ;;
    start)
        start_containers
        ;;
    stop)
        stop_containers
        ;;
    restart)
        restart_containers
        ;;
    update)
        update_container
        ;;
    backup)
        backup_database
        ;;
    logs)
        view_logs
        ;;
    status)
        check_status
        ;;
    clean)
        clean_resources
        ;;
    setup-notifications)
        setup_notifications
        ;;
    test-notifications)
        test_notifications
        ;;
    notification-logs)
        view_notification_logs
        ;;
    notification-status)
        check_notification_status
        ;;
    help|*)
        show_usage
        ;;
esac

exit 0
