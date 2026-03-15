#!/bin/bash

# ST-Guardian Setup Script
# Installs st-guardian as a systemd service for Sprout Track

set -e

GUARDIAN_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
TEAL='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${TEAL}"
    echo "╔══════════════════════════════════════╗"
    echo "║     ST-Guardian Setup                ║"
    echo "║     Sprout Track Service Manager     ║"
    echo "╚══════════════════════════════════════╝"
    echo -e "${NC}"
}

# --uninstall flag
if [ "$1" = "--uninstall" ]; then
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}Error: Please run with sudo${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Uninstalling st-guardian...${NC}"

    if systemctl is-active --quiet st-guardian 2>/dev/null; then
        echo "Stopping st-guardian service..."
        systemctl stop st-guardian
    fi

    if systemctl is-enabled --quiet st-guardian 2>/dev/null; then
        echo "Disabling st-guardian service..."
        systemctl disable st-guardian
    fi

    if [ -f /etc/systemd/system/st-guardian.service ]; then
        echo "Removing systemd unit file..."
        rm /etc/systemd/system/st-guardian.service
    fi

    if [ -f /etc/sudoers.d/st-guardian ]; then
        echo "Removing sudoers configuration..."
        rm /etc/sudoers.d/st-guardian
    fi

    systemctl daemon-reload

    echo -e "${GREEN}st-guardian has been uninstalled.${NC}"
    exit 0
fi

# Check root/sudo
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run with sudo${NC}"
    echo "Usage: sudo bash $0"
    exit 1
fi

print_header

# Detect Docker
if [ -f /.dockerenv ]; then
    echo -e "${YELLOW}WARNING: Docker environment detected.${NC}"
    echo "Running st-guardian as a systemd service inside Docker is not recommended."
    echo "In Docker, st-guardian should be started directly (node index.js)."
    read -p "Continue anyway? (y/N): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Detect the non-root user
if [ -n "$SUDO_USER" ]; then
    RUN_USER="$SUDO_USER"
else
    RUN_USER=$(logname 2>/dev/null || echo "")
fi

if [ -z "$RUN_USER" ] || [ "$RUN_USER" = "root" ]; then
    echo -e "${YELLOW}Could not detect non-root user.${NC}"
    read -p "Enter the user to run st-guardian as: " RUN_USER
    if [ -z "$RUN_USER" ]; then
        echo -e "${RED}Error: A non-root user is required.${NC}"
        exit 1
    fi
fi

echo -e "Service will run as user: ${GREEN}${RUN_USER}${NC}"
echo ""

# Prompt for ST_APP_DIR
DEFAULT_APP_DIR="$(dirname "$GUARDIAN_DIR")"
read -p "Sprout Track installation directory [$DEFAULT_APP_DIR]: " ST_APP_DIR
ST_APP_DIR="${ST_APP_DIR:-$DEFAULT_APP_DIR}"

# Validate
if [ ! -f "$ST_APP_DIR/package.json" ]; then
    echo -e "${RED}Error: package.json not found in $ST_APP_DIR${NC}"
    exit 1
fi
echo -e "App directory: ${GREEN}${ST_APP_DIR}${NC}"

# Prompt for ports
read -p "Guardian port [3001]: " ST_GUARDIAN_PORT
ST_GUARDIAN_PORT="${ST_GUARDIAN_PORT:-3001}"

read -p "App port [3000]: " ST_APP_PORT
ST_APP_PORT="${ST_APP_PORT:-3000}"

# Prompt for guardian key
read -p "Guardian API key (leave blank to auto-generate): " ST_GUARDIAN_KEY
if [ -z "$ST_GUARDIAN_KEY" ]; then
    ST_GUARDIAN_KEY=$(openssl rand -hex 32)
    echo -e "Generated key: ${GREEN}${ST_GUARDIAN_KEY}${NC}"
fi

# Prompt for health interval
read -p "Health check interval in ms [30000]: " ST_HEALTH_INTERVAL
ST_HEALTH_INTERVAL="${ST_HEALTH_INTERVAL:-30000}"

echo ""
echo "Configuration:"
echo "  App directory:    $ST_APP_DIR"
echo "  Guardian port:    $ST_GUARDIAN_PORT"
echo "  App port:         $ST_APP_PORT"
echo "  Health interval:  ${ST_HEALTH_INTERVAL}ms"
echo "  Run as user:      $RUN_USER"
echo ""
read -p "Proceed with installation? (Y/n): " CONFIRM
if [ "$CONFIRM" = "n" ] || [ "$CONFIRM" = "N" ]; then
    echo "Aborted."
    exit 0
fi

# Install npm dependencies
echo ""
echo -e "${TEAL}Installing dependencies...${NC}"
cd "$GUARDIAN_DIR"
sudo -u "$RUN_USER" npm install --omit=dev

# Read SERVICE_NAME from app .env for sudoers
SERVICE_NAME=""
if [ -f "$ST_APP_DIR/.env" ]; then
    SERVICE_NAME=$(grep 'SERVICE_NAME' "$ST_APP_DIR/.env" | cut -d '"' -f 2)
fi

# Configure sudoers for service management
if [ -n "$SERVICE_NAME" ]; then
    echo -e "${TEAL}Configuring sudo permissions for service management...${NC}"
    SYSTEMCTL_PATH=$(which systemctl)
    cat > /etc/sudoers.d/st-guardian << SUDOERS
# Allow st-guardian to manage the Sprout Track service
${RUN_USER} ALL=(ALL) NOPASSWD: ${SYSTEMCTL_PATH} start ${SERVICE_NAME}
${RUN_USER} ALL=(ALL) NOPASSWD: ${SYSTEMCTL_PATH} stop ${SERVICE_NAME}
${RUN_USER} ALL=(ALL) NOPASSWD: ${SYSTEMCTL_PATH} restart ${SERVICE_NAME}
${RUN_USER} ALL=(ALL) NOPASSWD: ${SYSTEMCTL_PATH} status ${SERVICE_NAME}
SUDOERS
    chmod 0440 /etc/sudoers.d/st-guardian
    echo "Sudoers configured for service: $SERVICE_NAME"
else
    echo -e "${YELLOW}WARNING: SERVICE_NAME not found in $ST_APP_DIR/.env${NC}"
    echo "Sudoers configuration skipped. Service management may require manual sudo setup."
fi

# Add user to systemd-journal group for log access
if getent group systemd-journal > /dev/null 2>&1; then
    echo -e "${TEAL}Adding $RUN_USER to systemd-journal group...${NC}"
    usermod -aG systemd-journal "$RUN_USER"
fi

# Detect node path
NODE_PATH=$(which node)

# Create systemd unit file
echo -e "${TEAL}Creating systemd service...${NC}"
cat > /etc/systemd/system/st-guardian.service << UNIT
[Unit]
Description=ST-Guardian - Sprout Track Service Manager
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${GUARDIAN_DIR}
ExecStart=${NODE_PATH} index.js
Restart=always
RestartSec=5
Environment=ST_GUARDIAN_PORT=${ST_GUARDIAN_PORT}
Environment=ST_APP_PORT=${ST_APP_PORT}
Environment=ST_GUARDIAN_KEY=${ST_GUARDIAN_KEY}
Environment=ST_HEALTH_INTERVAL=${ST_HEALTH_INTERVAL}
Environment=ST_SCRIPTS_DIR=${ST_APP_DIR}/scripts
Environment=ST_APP_DIR=${ST_APP_DIR}
Environment=ST_LOG_BUFFER=500

[Install]
WantedBy=multi-user.target
UNIT

# Enable and start
echo -e "${TEAL}Starting st-guardian...${NC}"
systemctl daemon-reload
systemctl enable st-guardian
systemctl start st-guardian

# Wait a moment then check status
sleep 2

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     ST-Guardian Installed!            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# Show status
systemctl status st-guardian --no-pager || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  Status URL:  ${TEAL}http://localhost:${ST_GUARDIAN_PORT}/status${NC}"
echo -e "  Health URL:  ${TEAL}http://localhost:${ST_GUARDIAN_PORT}/health${NC}"
echo ""
echo -e "  Guardian Key: ${YELLOW}${ST_GUARDIAN_KEY}${NC}"
echo -e "  ${RED}Save this key! It's required for management endpoints.${NC}"
echo ""
echo -e "  ${YELLOW}Reminder:${NC} Update your Nginx/reverse proxy to point"
echo -e "  at port ${ST_GUARDIAN_PORT} instead of ${ST_APP_PORT}."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To uninstall: sudo bash $0 --uninstall"
