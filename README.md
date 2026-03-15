# Sprout Track

v1.0.0 :) - A self-hosted Next.js application for tracking baby activities, milestones, and development.

![Docker Stars](https://img.shields.io/docker/stars/sprouttrack/sprout-track) ![Docker Image Size](https://img.shields.io/docker/image-size/sprouttrack/sprout-track) ![Docker Pulls](https://img.shields.io/docker/pulls/sprouttrack/sprout-track)

<img src="public/st-header-image-readme.jpg" width="100%" alt="Sprout Track" style="border-radius: 12px;" />

## Live Demo

Try out Sprout Track at our live demo: **[https://www.sprout-track.com/demo](https://www.sprout-track.com/demo)**

*The demo environment is refreshed every 1 hour.*

- ID: `01`
- PIN: `111111`

## Quick Start: Docker

```bash
docker pull sprouttrack/sprout-track:latest
docker-compose up -d
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Default PIN: `111222`
- Default /family-manager admin password: `admin`

The Setup Wizard will guide you through initial configuration on first access.

See [Docker Deployment](documentation/Admin-Documentation/docker-deployment.md) for volumes, custom ports, and container details.

## Quick Start: Local

Requires Node.js 22+, npm 10+, Git, and Bash.

```bash
git clone https://github.com/Oak-and-Sprout/sprout-track.git
cd sprout-track
chmod +x scripts/*.sh
./scripts/setup.sh
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

See [Local Deployment](documentation/Admin-Documentation/local-deployment.md) for manual setup, available scripts, and service management.

## First-Time Setup

On first access, the Setup Wizard walks you through:

1. **Family Setup** -- family name, URL slug, optional data import
2. **Security Setup** -- system-wide PIN or individual caretaker PINs
3. **Baby Setup** -- name, birth date, feed/diaper warning thresholds

The **Family Manager** at `/family-manager` (default password: `admin`) provides admin controls for domain settings, HTTPS, email, database backups, and push notifications.

See [Initial Setup](documentation/Admin-Documentation/initial-setup.md) for details.

## Documentation

| Guide | Description |
|-------|-------------|
| [Docker Deployment](documentation/Admin-Documentation/docker-deployment.md) | Volumes, ports, container startup, building locally |
| [Local Deployment](documentation/Admin-Documentation/local-deployment.md) | Manual setup, scripts reference, systemd service |
| [Initial Setup](documentation/Admin-Documentation/initial-setup.md) | Setup Wizard, default credentials, Family Manager |
| [Environment Variables](documentation/Admin-Documentation/environment-variables.md) | Full variable reference, auto-generation, security notes |
| [Upgrades and Backups](documentation/Admin-Documentation/upgrades-and-backups.md) | Upgrade procedures, backup/restore for Docker and local |
| [Push Notifications](documentation/Admin-Documentation/push-notifications.md) | VAPID keys, cron setup, per-user configuration |
| [Webhook API](documentation/Admin-Documentation/webhook-api.md) | External integrations (Home Assistant, Grafana, NFC, etc.) |
| [API Logging](documentation/Admin-Documentation/api-logging.md) | Optional request/response logging |
| [Admin Password Reset](documentation/Admin-Documentation/admin-password-reset.md) | Automatic reset when upgrading from older versions |

## Tech Stack

- Next.js with App Router
- TypeScript
- Prisma with SQLite
- TailwindCSS
- Docker
- PWA with Push Notifications, Keep Awake, and Full Screen (on supported devices)
