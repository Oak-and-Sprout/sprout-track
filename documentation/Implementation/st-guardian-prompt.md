# ST-Guardian: Sprout Track Service Manager

Build a lightweight Node.js sidecar service called `st-guardian` for the Sprout Track application (Next.js). It acts as a reverse proxy, health monitor, maintenance page server, and update orchestrator.

## Architecture

- st-guardian runs on port 3001 (configurable via `ST_GUARDIAN_PORT`)
- Next.js (Sprout Track) runs on its default port 3000 (configurable via `ST_APP_PORT`)
- st-guardian sits in front of the app and proxies all non-management requests to Next.js
- In maintenance mode, st-guardian stops proxying and serves a static maintenance page instead
- Docker-aware: detects `/.dockerenv` and disables update/restart functionality, acts as passthrough proxy only

## Dependencies

- Keep dependencies minimal. Use `http-proxy` for proxying. No frameworks. Single entry point file if possible.

## Management Routes

These routes are intercepted by st-guardian before reaching the proxy. All management routes (except `/status` and `/health`) require authentication via `ST_GUARDIAN_KEY` env var, passed as `?key=` query param or `X-Guardian-Key` header.

### `GET /status`
- Public endpoint
- Returns JSON: app status (up/down/maintenance), current version (read from package.json), uptime, last update timestamp, guardian version

### `GET /health`
- Public endpoint
- Returns 200 if app is up and proxying, 503 if in maintenance mode or app is down
- Designed for external uptime monitors

### `POST /maintenance`
- Authenticated
- Enables maintenance mode: stops proxying, serves maintenance page
- Optional JSON body: `{ "message": "Custom maintenance message" }`

### `DELETE /maintenance`
- Authenticated
- Disables maintenance mode: resumes proxying to Next.js

### `POST /update`
- Authenticated
- Triggers the full update cycle by calling the existing deployment script at `scripts/deployment.sh`
- The deployment script already handles:
  1. Creating a backup (`scripts/backup.sh`)
  2. Stopping the service (`scripts/service.sh stop`)
  3. Deleting the `.next` folder
  4. Updating environment configuration (`scripts/env-update.sh`)
  5. Updating the application (`scripts/update.sh`)
  6. Rollback behavior: if any step fails, it attempts to restart the service before aborting
- Guardian's responsibilities around the deployment script:
  1. Enable maintenance mode before calling the script
  2. Shell out to `scripts/deployment.sh` and capture stdout/stderr in real time
  3. When the script completes, health check the app (poll until responsive or timeout)
  4. If healthy, disable maintenance mode
  5. If unhealthy or script exited non-zero, stay in maintenance mode and log the error
- Optional JSON body: `{ "ref": "v2.1.0" }` to checkout a specific ref before running deployment
- Returns JSON with job status. Should support polling via `GET /update/status`

### `GET /update/status`
- Authenticated
- Returns current/last update job progress: step, status, logs, started_at, completed_at

### `GET /logs`
- Authenticated
- Returns recent stdout/stderr from the Next.js process
- Query param `?lines=100` to control how many lines (default 100)

## Maintenance Page

- Static HTML embedded in the script, no external dependencies
- Sprout Track branded: use the teal/green color scheme
- Shows a spinner or animation and message: "Sprout Track is under maintenance and will be back shortly."
- Support custom messages passed via the `POST /maintenance` body
- Auto-refreshes every 15 seconds, redirects back to the app when maintenance mode ends (poll `/health`)
- Must be lightweight and work without any assets from the Next.js app

## Health Monitoring

- Periodically ping Next.js (configurable interval via `ST_HEALTH_INTERVAL`, default 30 seconds)
- If Next.js is unresponsive for 3 consecutive checks, attempt automatic restart
- Log health events
- If auto-restart fails, flip to maintenance mode and log an error

## Process Management

- st-guardian uses the existing `scripts/service.sh` for process management (start/stop/status)
- Captures stdout/stderr from Next.js for the `/logs` endpoint
- Handles graceful shutdown: SIGTERM/SIGINT should call `scripts/service.sh stop` then exit guardian
- On Next.js crash, attempt restart via `scripts/service.sh start` up to 3 times within 5 minutes before giving up and entering maintenance mode

## Docker Awareness

- On startup, check for `/.dockerenv` file
- If detected, disable: `/update`, `/logs`, process management, auto-restart
- In Docker mode, guardian is proxy + maintenance page only
- Log a message on startup indicating which mode it's running in

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `ST_GUARDIAN_PORT` | 3001 | Port guardian listens on |
| `ST_APP_PORT` | 3000 | Port Next.js runs on |
| `ST_GUARDIAN_KEY` | (required for mgmt routes) | Auth key for management endpoints |
| `ST_HEALTH_INTERVAL` | 30000 | Health check interval in ms |
| `ST_SCRIPTS_DIR` | `./scripts` | Path to Sprout Track scripts directory (deployment.sh, service.sh, backup.sh, etc.) |
| `ST_APP_DIR` | `.` | Working directory for the Next.js app |
| `ST_LOG_BUFFER` | 500 | Number of log lines to retain in memory |

## Logging

- Log to stdout with timestamps
- Prefix logs with `[guardian]` to distinguish from Next.js output
- Log: startup mode (docker/standalone), proxy events, health check failures, maintenance mode changes, update steps

## File Structure

Keep it simple. Suggested:

```
st-guardian/
  index.js          # Main entry point
  maintenance.html   # Maintenance page template (or embedded string)
  st-guardian-setup.sh  # Service installer script
  package.json
  README.md
```

## Setup Script (`st-guardian-setup.sh`)

Create an interactive setup script that installs st-guardian as a systemd service. The script should:

1. Check that it's running as root/sudo
2. Prompt for configuration:
   - `ST_GUARDIAN_KEY` (generate a random one if user hits enter)
   - `ST_APP_DIR` (path to the Sprout Track installation, validate it exists)
   - `ST_GUARDIAN_PORT` (default 3001)
   - `ST_APP_PORT` (default 3000)
3. Detect Docker environment and warn if detected (guardian service doesn't make sense in Docker)
4. Install npm dependencies (`npm install --production`)
5. Create a systemd unit file at `/etc/systemd/system/st-guardian.service`:
   - Set `WorkingDirectory` to the guardian directory
   - Set all `ST_*` environment variables
   - Set `Restart=always` with `RestartSec=5`
   - Run as the current non-root user (not root)
   - Set `After=network.target`
6. Reload systemd, enable the service, and start it
7. Print a summary: service status, management URL, the guardian key, and a reminder to update Nginx to point at the guardian port

The script should also support an `--uninstall` flag that stops the service, disables it, removes the unit file, and reloads systemd.
