# Admin Password Reset -- v0.94.89

## Overview

Starting with version 0.94.89, Sprout Track includes an automatic admin password reset system for compatibility when upgrading from older versions (v0.94.24 and earlier) or importing older database backups.

## What Changed?

### Docker Environment File Improvements

Admin passwords for the Family Manager page are encrypted by a hash in the environment file. In version 0.94.24+, Docker deployments gained persistent environment files across container updates. The automatic password reset ensures smooth upgrades for users whose environment files were lost during that upgrade process.

Backups created on v0.94.89+ include both the database and environment file.

### Automatic Password Reset

When upgrading or restoring from an older database backup, the system will:

1. Detect if the database is from an older version (pre-v0.94.89)
2. Automatically reset the Family Manager admin password to the default
3. Show a prominent modal dialog before any redirects
4. Wait for your acknowledgment before proceeding

## When Does This Happen?

The admin password is reset to `admin` in these scenarios:

### Upgrading from v0.94.24 or Earlier
- The first database migration after upgrade triggers the reset
- You will see the notification modal when accessing Family Manager settings

### Importing Older Database Backups
- During initial setup: when importing a database backup in the Setup Wizard
- In Family Manager: when restoring a database backup from the settings page
- The pre-migration check detects the older database version and resets the password

## Default Admin Password

After the reset, the Family Manager admin password is:

```
admin
```

This is the same default password used in fresh installations.

## FAQ

### Will this affect my caretaker PINs?
No. Only the Family Manager admin password is reset. Caretaker authentication is unchanged.

### What if I already changed my admin password?
This only affects databases from older versions. If your database is already on v0.94.89+, no reset occurs and your existing admin password is retained.

### Can I prevent this reset?
No, the reset is automatic for compatibility. You can immediately change the password back to your preferred value in Family Manager settings.

### Will this happen on every upgrade?
No. Only when upgrading from v0.94.24 or earlier, or when importing older database backups. Once your database is migrated to v0.94.89+, future upgrades will not trigger a reset.

### Is my data safe during this process?
Yes. Only the admin password field is affected. All other data (families, babies, activities, events, etc.) remains intact.

## Docker Notes

- Your `.env` file and database are persistent across container updates (v0.94.24+)
- The password reset notification appears once on the first upgrade to v0.94.89
- After acknowledging and changing your password, it persists across future updates
- Always back up your database before major upgrades

### Docker Volume Structure

Since v0.94.24+:
- `sprout-track-db`: Persistent database storage
- `sprout-track-env`: Persistent environment configuration

Admin password changes are stored in the database and persist across container updates.

## Manual Password Reset

If you need to reset the admin password outside of the upgrade flow:

```bash
node scripts/reset-admin-password.js
```

Run this from the project root directory. It will prompt you for the new password.

## Support

If you encounter issues with the admin password reset:

1. Verify you are using the default `admin` password
2. Ensure you are accessing `/family-manager` (not the main login)
3. Review the [CHANGELOG.md](../../CHANGELOG.md) for version-specific notes
4. Open an issue on [GitHub](https://github.com/Oak-and-Sprout/sprout-track/issues) if problems persist

## Related Documentation

- [Initial Setup](initial-setup.md) -- Setup Wizard and first-time configuration
- [Upgrades and Backups](upgrades-and-backups.md) -- upgrade procedures
