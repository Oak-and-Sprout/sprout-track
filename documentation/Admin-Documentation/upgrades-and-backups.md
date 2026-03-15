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

Since v0.94.89+, the backup is a `.zip` file containing both:
- `baby-tracker.db` -- the application database
- `.env` -- your environment configuration (encryption keys, secrets)

This ensures you have everything needed for a full restore, including the `ENC_HASH` required to decrypt sensitive data.

### Docker Volume Backup

```bash
# Database
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
1. Replaces the current database (and `.env` if included in the zip)
2. Checks database version compatibility
3. Runs schema migrations to update to the current version
4. Seeds any missing default data
5. Reloads the application

If the restored database is from v0.94.24 or earlier, the Family Manager admin password is automatically reset to `admin` and you will be notified. See [Admin Password Reset](admin-password-reset.md).

**Note**: Restore operations require system administrator authentication.

### Database Import via Setup Wizard

When setting up a fresh instance, you can import a previous backup during the Setup Wizard's family setup step. The wizard accepts both `.zip` and `.db` files and runs the same migration process.

### Docker Volume Restore

For manual volume-level restores:

```bash
# Restore database
docker run --rm -v sprout-track-db:/data -v $(pwd):/backup alpine tar xzf /backup/database-backup.tar.gz -C /data

# Restore environment config
docker run --rm -v sprout-track-env:/data -v $(pwd):/backup alpine tar xzf /backup/env-backup.tar.gz -C /data

# Restore encrypted files
docker run --rm -v sprout-track-files:/data -v $(pwd):/backup alpine tar xzf /backup/files-backup.tar.gz -C /data
```

## Related Documentation

- [Docker Deployment](docker-deployment.md) -- volume structure and management
- [Admin Password Reset](admin-password-reset.md) -- automatic password reset during upgrades from older versions
