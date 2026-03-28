# Local (Non-Docker) Deployment

## Prerequisites

- Node.js v22 or higher
- npm v10 or higher
- Git
- Bash shell (for setup scripts)
- **PostgreSQL only:** A running PostgreSQL 14+ server

## Quick Setup (SQLite -- Default)

```bash
git clone https://github.com/Oak-and-Sprout/sprout-track.git
cd sprout-track
chmod +x scripts/*.sh
./scripts/setup.sh
```

The setup script will:
- Verify Node.js and npm versions
- Run `env-update.sh` to create/update the `.env` file
- Install npm dependencies
- Generate Prisma clients (main and log databases)
- Run database migrations
- Seed the database with initial data
- Build the Next.js application
- Set up notification infrastructure if enabled

After setup, start the production server:

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

- Default PIN: `111222`
- Default /family-manager admin password: `admin`

## Quick Setup (PostgreSQL)

1. Create PostgreSQL databases:

```sql
CREATE DATABASE sprout_track;
CREATE DATABASE sprout_track_logs;
```

2. Clone and configure:

```bash
git clone https://github.com/Oak-and-Sprout/sprout-track.git
cd sprout-track
chmod +x scripts/*.sh
```

3. Create/edit your `.env` file with the PostgreSQL settings:

```env
DATABASE_PROVIDER="postgresql"
DATABASE_URL="postgresql://user:password@localhost:5432/sprout_track"
LOG_DATABASE_URL="postgresql://user:password@localhost:5432/sprout_track_logs"
```

4. Run setup and start:

```bash
./scripts/setup.sh
npm start
```

The setup script reads `DATABASE_PROVIDER`, `DATABASE_URL`, and `LOG_DATABASE_URL` from your `.env` file automatically and uses `prisma db push` instead of SQLite migrations.

## Manual Setup

If you prefer to set up step-by-step:

```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma clients (configures provider automatically)
npm run prisma:generate
npm run prisma:generate:log

# 3. Run database migrations
#    SQLite:
npm run prisma:migrate
#    PostgreSQL:
#    npx prisma db push --accept-data-loss

# 4. Seed the database
npm run prisma:seed

# 5. Build for production
npm run build

# 6. Start the server
npm start
```

For development with hot reloading:

```bash
npm run dev
```

## Custom Port

Edit the scripts in `package.json` to change the port:

```json
"scripts": {
  "dev": "next dev -p 4000",
  "start": "next start -p 8080"
}
```

## Available Scripts

### Application

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reloading |
| `npm run build` | Build for production |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |

### Database (Main)

| Command | Description |
|---------|-------------|
| `npm run prisma:prepare` | Configure Prisma schema for the active `DATABASE_PROVIDER` |
| `npm run prisma:generate` | Generate Prisma client (runs `prisma:prepare` first) |
| `npm run prisma:migrate` | Create and apply a new migration (SQLite, interactive) |
| `npm run prisma:deploy` | Apply existing migrations (SQLite, non-interactive, for production) |
| `npm run prisma:seed` | Seed the database with initial data |
| `npm run prisma:studio` | Open Prisma Studio to browse/edit data |

For PostgreSQL, use `npx prisma db push` instead of the migrate commands. The `prisma:generate` command automatically configures the schema for the correct provider based on `DATABASE_PROVIDER`.

### Database (Log)

| Command | Description |
|---------|-------------|
| `npm run prisma:generate:log` | Generate log database Prisma client (runs `prisma:prepare` first) |
| `npm run prisma:push:log` | Sync log schema to database (no migrations) |
| `npm run prisma:studio:log` | Open Prisma Studio for the log database |

The log database uses `db push` instead of migrations to avoid conflicts with the main database's migration folder.

### Setup and Deployment Scripts

| Script | Description |
|--------|-------------|
| `./scripts/setup.sh` | Full initial setup |
| `./scripts/env-update.sh` | Create/update `.env` file (generates `ENC_HASH` and `NOTIFICATION_CRON_SECRET` if missing) |
| `./scripts/update.sh` | Pull latest code, install deps, run migrations, rebuild |
| `./scripts/deployment.sh` | Full deployment: backup, stop service, update, restart |
| `./scripts/backup.sh` | Create timestamped backup of the application and database |
| `./scripts/service.sh {start\|stop\|restart\|status}` | Manage the systemd service |

### Admin Scripts

| Script | Description |
|--------|-------------|
| `node scripts/reset-admin-password.js` | Reset the Family Manager admin password |

### Test Data

| Script | Description |
|--------|-------------|
| `./scripts/generate-test-data.sh` | Interactive test data generation |
| `./scripts/generate-test-data-automated.sh` | Automated test data generation (for CI/CD) |

### Database Utilities

| Script | Description |
|--------|-------------|
| `./scripts/family-migration.js` | Migrate data for multi-family support |
| `./scripts/family-update.sh` | Update database after multi-family migration |
| `./scripts/ensure-utc-dates-improved.js` | Convert all database dates to UTC format |

## Service Management

For production deployments, you can run Sprout Track as a systemd service.

The `SERVICE_NAME` variable in `.env` controls the service name (default: `baby-tracker`).

```bash
# Start the service
./scripts/service.sh start

# Stop the service
./scripts/service.sh stop

# Restart the service
./scripts/service.sh restart

# Check status
./scripts/service.sh status
```

## Updating

Run the deployment script to update to the latest version:

```bash
./scripts/deployment.sh
```

This script handles:
1. Creating a backup
2. Stopping the service
3. Cleaning the build cache
4. Updating environment configuration
5. Pulling latest code and installing dependencies
6. Running database migrations
7. Rebuilding the application
8. Restarting the service

See [Upgrades and Backups](upgrades-and-backups.md) for more details.

## Directory Structure

After setup, key directories include:

| Path | Purpose |
|------|---------|
| `db/` | SQLite database files (`baby-tracker.db`, `api-logs.db`) -- SQLite only |
| `prisma/` | Schema definitions and migrations |
| `.env` | Environment configuration (auto-generated) |
| `logs/` | Application and notification logs |
| `Files/` | Encrypted file storage (vaccine documents) |

When using PostgreSQL, the `db/` directory is not used -- data is stored in your PostgreSQL server.

## Switching Database Providers

You can switch between SQLite and PostgreSQL at any time using the built-in backup and restore tools. See [Migrating Between Database Providers](upgrades-and-backups.md#migrating-between-database-providers) for step-by-step instructions.

> **ⓘ To migrate:**  
> Create a new instance of Sprout Track configured for your desired database provider, then restore your database using a backup from your previous instance.  
> All your data will be imported into the new database provider, but your environment files (`.env`) will retain the current connection settings.

## Related Documentation

- [Environment Variables](environment-variables.md) -- full variable reference
- [Initial Setup](initial-setup.md) -- Setup Wizard and first-time configuration
- [Upgrades and Backups](upgrades-and-backups.md) -- upgrade procedures
