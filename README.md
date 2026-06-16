# Sprout Track

v1.3.4 😁 - A self-hosted Next.js application for tracking baby activities, milestones, and development.

![Docker Image Size](https://img.shields.io/docker/image-size/sprouttrack/sprout-track) ![Docker Pulls](https://img.shields.io/docker/pulls/sprouttrack/sprout-track)

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

- **PWA** — Install on any device with notifications, keep-awake mode, and fullscreen. For the best experience, use Chrome, Edge, or Safari to add the app to your home screen from the family login screen. Firefox does not fully support PWA features (icons, theme colors, and standalone mode may not work correctly).
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




# Local switch hosting from original to fork

Perfect! Let's set up automatic Git-based updates using GitHub Container Registry (GHCR) + Podman's native auto-update. This way, when you push to your fork's main branch, the server auto-pulls and restarts.
🎯 Architecture Overview
1234567
📦 Step 1: Publish Your Fork to GHCR
Option A: Quick Manual Push (Test First)
bash
123456789101112131415161718
Option B: Automated GitHub Actions (Recommended)
Create .github/workflows/publish.yml in your fork:
yaml
12345678910111213141516171819202122232425262728293031323334353637383940414243444546474849
🔐 Secrets: No extra setup needed — GITHUB_TOKEN is auto-provided. Ensure your repo allows Actions (Settings → Actions → Enable).
⚙️ Step 2: Update Your Systemd Service for Auto-Update
Edit your existing service file:
bash
1
Update the ExecStart line:
ini
1234567891011121314151617
✅ Key changes:
Image: ghcr.io/stefanhalus/sprout-track:latest (instead of docker.io or localhost)
Added --label "io.containers.autoupdate=registry" — this tells Podman to auto-update from registry
Optional: -e FORK_SOURCE=... for easy identification in logs
🔄 Step 3: Enable Podman Auto-Update
bash
1234567891011
Check auto-update logs:
bash
1
🧪 Step 4: Test the Full Flow
Simulate an update:
bash
123456789101112131415161718
Verify your accessibility improvements:
bash
1234
🔐 GHCR Authentication on Server (One-Time Setup)
Podman needs to authenticate to pull from GHCR:
bash
1234567891011
💡 Security Tip: Use a fine-scoped GitHub PAT (Settings → Developer settings → Personal access tokens → Fine-grained tokens) with only:
Repository: stefanhalus/sprout-track
Permissions: Contents: read, Packages: read
📋 Auto-Update Configuration Summary
Component
Setting
Purpose
GitHub Actions
publish.yml workflow
Builds & pushes image on git push
Image Label
io.containers.autoupdate=registry
Tells Podman to auto-update from registry
Systemd Timer
podman-auto-update.timer
Checks for updates hourly
Container Label
--label "io.containers.autoupdate=registry"
Marks container for auto-update
Auth
~/.config/containers/auth.json
Allows Podman to pull from GHCR
🚨 Troubleshooting Auto-Updates
Container not updating?
bash
12345678910
GitHub Actions failing?
Check Actions tab in your fork for build logs
Ensure GITHUB_TOKEN has package write permissions
Verify Dockerfile builds locally first: podman build -t test .
🔄 Update Frequency Control
By default, podman-auto-update.timer runs hourly. To customize:
bash
12
Add:
ini
1234
Then reload:
bash
12
✅ Final Checklist
Task
Command
Done
✅ Publish first image to GHCR
podman push ghcr.io/stefanhalus/sprout-track:latest
☐
✅ Add io.containers.autoupdate=registry label to image & container
podman inspect ...
☐
✅ Update systemd ExecStart to use GHCR image
grep ExecStart /etc/systemd/system/container-sprouttrack.service
☐
✅ Enable auto-update timer
systemctl is-active podman-auto-update.timer
☐
✅ Test push → auto-deploy flow
Push small change, watch logs
☐
✅ Verify accessibility improvements live
Browser test at baby.halus.eu
☐
💡 Bonus: Add Update Notifications
Want to know when an auto-update happens? Add a webhook to your GitHub Actions:
yaml
1234567
Set DEPLOY_WEBHOOK in repo secrets (e.g., Discord, Slack, or a simple logging endpoint).
Your setup will now:
✅ Auto-build on git push
✅ Auto-deploy via Podman
✅ Preserve all data (volumes untouched)
✅ Keep your accessibility improvements always up-to-date
Let me know if you'd like help:
Drafting the GitHub Actions workflow file
Setting up fine-grained GitHub PAT permissions
Adding a healthcheck endpoint to verify post-update success


https://chat.qwen.ai/s/t_3b4bff5a-22e7-4bbf-b4e1-affb973f9284?fev=0.2.45