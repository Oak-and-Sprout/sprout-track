# Sprout Track

v1.3.1 😁 - A self-hosted Next.js application for tracking baby activities, milestones, and development.

![Docker Stars](https://img.shields.io/docker/stars/sprouttrack/sprout-track) ![Docker Image Size](https://img.shields.io/docker/image-size/sprouttrack/sprout-track) ![Docker Pulls](https://img.shields.io/docker/pulls/sprouttrack/sprout-track)

## Live Demo

Try out Sprout Track at our live demo: **[https://www.sprout-track.com/demo](https://www.sprout-track.com/demo)**

*The demo environment is refreshed every 1 hour.*

- ID: `01`
- PIN: `111111`

## Features

### Activity Tracking & Daily Dashboard

Track sleep, feeding, diapers, bath, measurements, medicine, activities, milestones, and more. The daily dashboard gives you an at-a-glance summary with real-time stats and active session tracking.

<p>
  <img src="public/readme/SproutTrackLogEntryView.png" width="500" alt="Daily Dashboard — Desktop" style="border-radius: 8px;" />
&nbsp;&nbsp;
  <img src="public/readme/SproutTrackLogEntryMobile.png" width="200" alt="Daily Dashboard — Mobile" style="border-radius: 8px;" />
</p>

### Calendar

Browse activity history on a monthly calendar with color-coded indicators by activity type. Tap any day to see a detailed breakdown.

<p>
  <img src="public/readme/CalendarDesktop.png" width="500" alt="Calendar — Desktop" style="border-radius: 8px;" />
  &nbsp;&nbsp;
  <img src="public/readme/CalandarMobile.png" width="200" alt="Calendar — Mobile" style="border-radius: 8px;" />
</p>

### Reporting & Growth Charts

Monthly reports with growth metrics, percentile curves, feeding stats, sleep analysis, and activity breakdowns. Export a monthly report card as a PDF.

<p>
  <img src="public/readme/ReportingMobile1.png" width="200" alt="Growth Report" style="border-radius: 8px;" />
  &nbsp;
  <img src="public/readme/ReportingMobile2.png" width="200" alt="Feeding & Sleep Report" style="border-radius: 8px;" />
  &nbsp;
  <img src="public/readme/ReportingMobile3.png" width="200" alt="Activity Report" style="border-radius: 8px;" />
</p>
<p>
  <img src="public/readme/ReportCardPDF.png" width="500" alt="PDF Report Card" style="border-radius: 8px;" />
</p>

### Full Activity Log & Export

Searchable, filterable activity log with pagination and data export to csv or xlsx.

<p>
  <img src="public/readme/FullLogExport.png" width="500" alt="Full Log & Export" style="border-radius: 8px;" />
</p>

### Nursery Mode

A fullscreen, tap-friendly interface with large buttons — perfect for daycare providers and nighttime use. Configurable background colors and brightness.

<p>
  <img src="public/readme/NurseryMode.png" width="500" alt="Nursery Mode" style="border-radius: 8px;" />
</p>

### Dark Mode

Full dark theme support across the entire application.

<p>
  <img src="public/readme/SproutTrackLogEntryDarkMode.png" width="200" alt="Dark Mode" style="border-radius: 8px;" />
</p>

### Multi-Language Support

Available in English, Spanish, French, German, and Italian. Language preferences are saved per-user.

<p>
  <img src="public/readme/Localized.png" width="200" alt="Language Selection" style="border-radius: 8px;" />
</p>

### Push Notifications

Real-time push notifications keep all caretakers informed when activities are logged.

<p>
  <img src="public/readme/Notification.png" width="200" alt="Push Notification" style="border-radius: 8px;" />
</p>

### API & Integrations

API key management and webhook support for external integrations like Home Assistant, Grafana, and NFC tags.

<p>
  <img src="public/readme/API-Desktop.png" width="420" alt="Daily Dashboard — Desktop" style="border-radius: 8px;" />
&nbsp;&nbsp;
  <img src="public/readme/API-KeyMobile.png" width="200" alt="API & Integrations" style="border-radius: 8px;" />
</p>

### More

- **PWA** — Install on any device with notifications, keep-awake mode, and fullscreen
- **Multi-Family** - Setup separate family dashboards to allow friends and family to privately track their child
- **Multi-Caretaker** — Each family uses individual PINs for parents, grandparents, babysitters, and daycare
- **Family Accounts** — Track multiple babies in a shared family workspace
- **SQLite or PostgreSQL** — Choose the database that fits your setup
- **Self-Hosted** — Full control over your data with Docker deployment
- **Backup & Restore** — Database backup and recovery built in
- **Track Contacts** - Track shared contacts, and tie them to medications, calendar events, or have them readily accessible in app

---

## Quick Start: Docker (SQLite)

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -v sprout-track-db:/db \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

## Quick Start: Docker (PostgreSQL)

Requires an existing PostgreSQL 14+ server. Create the `sprout_track` and `sprout_track_logs` databases, then run:

```bash
docker run -d \
  --name sprout-track \
  --restart unless-stopped \
  -p 3000:3000 \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track" \
  -e LOG_DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track_logs" \
  -v sprout-track-env:/app/env \
  -v sprout-track-files:/app/Files \
  sprouttrack/sprout-track:latest
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Default PIN: `111222`
- Default /family-manager admin password: `admin`

The Setup Wizard will guide you through initial configuration on first access.

See [Docker Deployment](documentation/Admin-Documentation/docker-deployment.md) for docker-compose setup, volumes, custom ports, and container details.

## Quick Start: Local (SQLite)

Requires Node.js 22+, npm 10+, Git, and Bash.

```bash
git clone https://github.com/Oak-and-Sprout/sprout-track.git
cd sprout-track
chmod +x scripts/*.sh
./scripts/setup.sh
npm run start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

PostgreSQL is also supported for local deployments. See [Local Deployment](documentation/Admin-Documentation/local-deployment.md) for PostgreSQL setup, manual setup, available scripts, and service management.

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
- Prisma with SQLite or PostgreSQL
- Tailwind
- Docker