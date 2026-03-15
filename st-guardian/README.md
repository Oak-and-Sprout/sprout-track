# ST-Guardian

Lightweight Node.js sidecar service for Sprout Track. Acts as a reverse proxy, health monitor, maintenance page server, and update orchestrator.

## Quick Start

### Systemd Installation (recommended for production)

```bash
sudo bash st-guardian-setup.sh
```

The setup script will prompt for configuration and install st-guardian as a systemd service.

### Manual / Development

```bash
cd st-guardian
npm install
ST_GUARDIAN_KEY=your-secret-key ST_APP_DIR=/path/to/sprout-track node index.js
```

## How It Works

- Listens on port 3001 (configurable) and proxies all requests to the Next.js app on port 3000
- Management routes (`/status`, `/health`, `/maintenance`, `/update`, `/logs`) are intercepted before reaching the proxy
- In maintenance mode, a branded status page is served instead of proxying
- Health checks ping the app periodically; if it goes down, guardian attempts automatic restart
- Docker-aware: when running in Docker, update/restart/log features are disabled (proxy + maintenance only)

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ST_GUARDIAN_PORT` | `3001` | Port guardian listens on |
| `ST_APP_PORT` | `3000` | Port the Next.js app runs on |
| `ST_GUARDIAN_KEY` | *(required)* | API key for authenticated management endpoints |
| `ST_HEALTH_INTERVAL` | `30000` | Health check interval in milliseconds |
| `ST_SCRIPTS_DIR` | `./scripts` | Path to Sprout Track scripts directory |
| `ST_APP_DIR` | `.` | Path to the Sprout Track installation |
| `ST_LOG_BUFFER` | `500` | Max log lines retained for `/logs` and update output |

## API Reference

### Public Endpoints

**GET /status**
```bash
curl http://localhost:3001/status
```
Returns: `{ "status": "up|down|maintenance", "version": "...", "guardianVersion": "1.0.0", "uptime": 3600, "dockerMode": false }`

**GET /health**
```bash
curl http://localhost:3001/health
```
Returns 200 `{"status":"healthy"}` or 503 `{"status":"unhealthy"}`

### Authenticated Endpoints

Pass the key as a query parameter or header:

```bash
# Query parameter
curl -X POST "http://localhost:3001/maintenance?key=YOUR_KEY"

# Header
curl -X POST http://localhost:3001/maintenance -H "X-Guardian-Key: YOUR_KEY"
```

**POST /maintenance** — Enable maintenance mode
```bash
curl -X POST "http://localhost:3001/maintenance?key=KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Updating to v2.0..."}'
```

**DELETE /maintenance** — Disable maintenance mode
```bash
curl -X DELETE "http://localhost:3001/maintenance?key=KEY"
```

**POST /update** — Trigger deployment
```bash
curl -X POST "http://localhost:3001/update?key=KEY"
```
Returns 202 with `{"pollUrl": "/update/status"}`. Automatically enters maintenance mode, runs `deployment.sh`, and exits maintenance when the app is healthy.

**GET /update/status** — Check update progress
```bash
curl "http://localhost:3001/update/status?key=KEY"
```

**GET /logs** — Read application logs
```bash
curl "http://localhost:3001/logs?key=KEY&lines=50"
```

## Docker Mode

When `/.dockerenv` is detected, the following endpoints return 403:
- `POST /update`
- `GET /logs`

Auto-restart and process management are also disabled. Guardian operates as a proxy and maintenance page server only.

## Uninstall

```bash
sudo bash st-guardian-setup.sh --uninstall
```

This stops the service, removes the systemd unit, and cleans up the sudoers configuration.

## Troubleshooting

- **"ST_GUARDIAN_KEY not configured"** — Set the `ST_GUARDIAN_KEY` environment variable
- **"SERVICE_NAME not found"** — Ensure the Sprout Track `.env` file has `SERVICE_NAME="your-service"`
- **Logs endpoint returns errors** — The user running guardian needs to be in the `systemd-journal` group
- **Service management fails** — Check that `/etc/sudoers.d/st-guardian` exists and grants the correct permissions
