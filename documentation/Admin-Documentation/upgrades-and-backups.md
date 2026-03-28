# Upgrades and Backups

## Before You Upgrade

Always back up before upgrading. The easiest way is through the in-app backup tool (see [Backup from the UI](#from-the-ui) below), which packages both the database and environment file into a single `.zip` download.

## Docker Upgrades

Since v0.94.24+, Docker volumes persist your database and environment configuration across updates automatically.

### Standard Upgrade

```bash
# Stop the current container
docker-compose down

# Pull the latest image
docker pull sprouttrack/sprout-track:latest

# Start with the updated image
docker-compose up -d
```

Your data and settings carry over automatically.

### Upgrading from Pre-v0.94.24

Older Docker deployments did not use persistent volumes. When upgrading:

1. Back up your `.env` file and database before stopping the old container
2. Stop the old container
3. Pull the latest image
4. Update your `docker-compose.yml` to use the current volume structure (see [Docker Deployment](docker-deployment.md))
5. Start the new container
6. Restore any custom environment settings through the Family Manager if needed

### Version-Specific Notes

- **v0.94.89+**: If upgrading from v0.94.24 or earlier, the admin password for Family Manager is automatically reset to `admin`. See [Admin Password Reset](admin-password-reset.md) for details.

## Local Upgrades

Run the deployment script:

```bash
./scripts/deployment.sh
```

This script handles the full process:
1. Creates a backup of the current installation
2. Stops the systemd service
3. Cleans the build cache (`.next` folder)
4. Updates environment configuration
5. Pulls latest code and installs dependencies
6. Runs database migrations and seeds
7. Rebuilds the application
8. Restarts the service

You do not need to re-import your database. The script manages updates in place.

## Backup Methods

### From the UI

The simplest way to back up is through the built-in backup tool, available in both the main app Settings page and the Family Manager settings page. Click **Backup Database** to download a backup.

The backup is a `.zip` file containing:
- **SQLite deployments:** `baby-tracker.db` (the database file) and `.env` (environment configuration)
- **PostgreSQL deployments:** `data.json` (all data exported as JSON) and `.env` (environment configuration)

Both formats include the `ENC_HASH` required to decrypt sensitive data. Backups from either database provider can be restored onto either provider (see [Migrating Between Database Providers](#migrating-between-database-providers)).

### Docker Volume Backup

```bash
# Database (SQLite only)
docker run --rm -v sprout-track-db:/data -v $(pwd):/backup alpine tar czf /backup/database-backup.tar.gz -C /data .

# Environment config
docker run --rm -v sprout-track-env:/data -v $(pwd):/backup alpine tar czf /backup/env-backup.tar.gz -C /data .

# Encrypted files
docker run --rm -v sprout-track-files:/data -v $(pwd):/backup alpine tar czf /backup/files-backup.tar.gz -C /data .
```

### Local Backup Script

```bash
./scripts/backup.sh
```

Creates a timestamped archive of the application and database (excludes `.next` and `node_modules`).

## Restore Procedures

### From the UI

The backup tool in Settings and Family Manager also handles restores. Click **Restore Database** and upload either:

- A `.zip` backup file (contains both the database and `.env` file)
- A standalone `.db` file (database only)

After upload, the app automatically:
1. Detects the backup format and current database provider
2. Imports the data (see format handling below)
3. Checks database version compatibility
4. Runs schema migrations to update to the current version
5. Seeds any missing default data
6. Reloads the application

**Format handling during restore:**

| Backup Contains | Running On | What Happens |
|----------------|------------|--------------|
| `baby-tracker.db` | SQLite | Replaces the database file directly (existing behavior) |
| `baby-tracker.db` | PostgreSQL | Reads the SQLite file and imports all data into PostgreSQL |
| `data.json` | SQLite | Imports JSON data via Prisma |
| `data.json` | PostgreSQL | Imports JSON data via Prisma |

This means you can take a backup from a SQLite instance and restore it onto PostgreSQL (or vice versa) without any manual conversion.

**Database connection parameters are preserved during restore.** When you restore a backup, the `.env` file from the backup is applied, but your current `DATABASE_PROVIDER`, `DATABASE_URL`, and `LOG_DATABASE_URL` values are always kept. This ensures that restoring a backup from a different database provider (e.g., a SQLite backup onto a PostgreSQL instance) does not break your database connection. All other `.env` settings from the backup (such as `ENC_HASH`) are restored normally.

If the restored database is from v0.94.24 or earlier, the Family Manager admin password is automatically reset to `admin` and you will be notified. See [Admin Password Reset](admin-password-reset.md).

**Note**: Restore operations require system administrator authentication.

### Database Import via Setup Wizard

When setting up a fresh instance, you can import a previous backup during the Setup Wizard's family setup step. The wizard accepts both `.zip` and `.db` files and runs the same migration process. This works across database providers -- you can import a SQLite backup into a fresh PostgreSQL instance during setup.

### Docker Volume Restore

For manual volume-level restores (SQLite only):

```bash
# Restore database
docker run --rm -v sprout-track-db:/data -v $(pwd):/backup alpine tar xzf /backup/database-backup.tar.gz -C /data

# Restore environment config
docker run --rm -v sprout-track-env:/data -v $(pwd):/backup alpine tar xzf /backup/env-backup.tar.gz -C /data

# Restore encrypted files
docker run --rm -v sprout-track-files:/data -v $(pwd):/backup alpine tar xzf /backup/files-backup.tar.gz -C /data
```

## Migrating Between Database Providers

You can migrate between SQLite and PostgreSQL at any time using the built-in backup and restore tools. No scripts or command-line tools are required.

### SQLite to PostgreSQL

1. **Back up your SQLite instance.** In the app, go to Settings (or Family Manager) and click **Backup Database**. This downloads a `.zip` file containing your `baby-tracker.db` file and `.env` configuration.

2. **Set up your PostgreSQL server.** Create the databases on your PostgreSQL 14+ server:

   ```sql
   CREATE DATABASE sprout_track;
   CREATE DATABASE sprout_track_logs;
   ```

3. **Start the app with PostgreSQL.** Stop the SQLite container and start with PostgreSQL:

   ```bash
   # Stop the SQLite container
   docker-compose down

   # Start with PostgreSQL (set your connection details)
   DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track" \
   LOG_DATABASE_URL="postgresql://user:password@your-host:5432/sprout_track_logs" \
   docker compose -f docker-compose.postgres.yml up -d
   ```

   The app starts with an empty PostgreSQL database and runs the Setup Wizard.

4. **Restore your backup.** In the Setup Wizard's family setup step (or in Settings after initial setup), click **Restore Database** and upload your SQLite backup `.zip` file.

   The app automatically reads the SQLite `.db` file from the backup, extracts all data, and imports it into PostgreSQL. Your database connection parameters are preserved — the backup's `.env` values for `DATABASE_PROVIDER`, `DATABASE_URL`, and `LOG_DATABASE_URL` will not overwrite your PostgreSQL settings. After import, it runs migrations and seeds to ensure the schema is current.

5. **Verify.** Log in with your existing credentials and confirm your data is present.

### PostgreSQL to SQLite

1. **Back up your PostgreSQL instance.** In the app, go to Settings and click **Backup Database**. This downloads a `.zip` file containing `data.json` (all your data as JSON) and `.env` configuration.

2. **Start a SQLite instance.**

   ```bash
   # Stop the app container
   docker-compose down

   # Start with SQLite (default)
   docker-compose up -d
   ```

3. **Restore your backup.** Upload the PostgreSQL backup `.zip` file via the restore tool. The app imports the JSON data into the SQLite database. Your SQLite connection parameters are preserved — the backup's PostgreSQL settings will not overwrite them.

4. **Verify.** Log in and confirm your data.

### Notes on Migration

- Both directions preserve all data including activity logs, settings, caretakers, babies, and configuration.
- The `.env` file in the backup is restored, which includes your `ENC_HASH` encryption key (required for decrypting vaccine documents and other encrypted files). However, your current database connection parameters (`DATABASE_PROVIDER`, `DATABASE_URL`, `LOG_DATABASE_URL`) are always preserved and never overwritten by the backup's values.
- After migration, your encrypted files volume (`sprout-track-files`) should be preserved or copied to the new deployment.
- Migration can also be done during initial setup via the Setup Wizard's import feature.

## Related Documentation

- [Docker Deployment](docker-deployment.md) -- volume structure and management
- [Admin Password Reset](admin-password-reset.md) -- automatic password reset during upgrades from older versions
