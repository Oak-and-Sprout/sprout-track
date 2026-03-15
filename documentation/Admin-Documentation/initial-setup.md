# Initial Setup

## First Access

When you first open Sprout Track in your browser, the Setup Wizard guides you through the essential configuration.

## Setup Wizard

### Step 1: Family Setup

- Enter your family name and URL slug
- Optionally import data from a previous installation by uploading the old `*.db` file from the `/db` folder

### Step 2: Security Setup

Choose one of two authentication modes:

- **System-wide PIN**: A single 6-10 digit PIN shared by all users
- **Individual caretaker PINs**: Each caretaker gets their own 2-character login ID and 6-10 digit PIN
  - The first caretaker will automatically be assigned the admin role

### Step 3: Baby Setup

- Enter baby's name, birth date, and gender
- Configure warning thresholds for feed and diaper timers
- Defaults: feed warning at 2 hours, diaper warning at 3 hours

## Default Credentials

After a fresh installation or database seed:

| Credential | Default Value |
|------------|---------------|
| Login PIN | `111222` |
| Family Manager admin password | `admin` |

Change both of these immediately after your first login.

## Family Manager

The Family Manager is an admin interface at `/family-manager`. Log in with the admin password (default: `admin`).

From the Family Manager you can:

- Set your domain and configure HTTPS
- Configure email settings
- Download a backup of the database
- Generate and manage VAPID keys for push notifications
- View and manage families

**Note**: API keys for external integrations (webhooks) are managed separately by caretakers with the admin role, in the main app under **Settings > Admin > Integrations**. See [Webhook API](webhook-api.md) for details.

## Multi-Family Support

Sprout Track supports multiple families in a single instance. Each family:

- Has its own URL slug for routing
- Has isolated data (all queries are scoped by family ID)
- Can have its own caretakers, babies, and settings

Add families through the Family Manager interface.

## Importing Data from a Previous Version

During the Setup Wizard (Step 1), you can import a database backup from an older Sprout Track installation:

1. Locate the `baby-tracker.db` file from your previous installation's `db/` folder
2. Upload it during the family setup step
3. The wizard will migrate the data to the current schema

If upgrading from v0.94.24 or earlier, see [Admin Password Reset](admin-password-reset.md) for important notes about automatic password resets during migration.

## Next Steps

- [Push Notifications](push-notifications.md) -- enable activity and timer notifications
- [Webhook API](webhook-api.md) -- set up external integrations (Home Assistant, etc.)
- [Environment Variables](environment-variables.md) -- customize authentication timeouts, HTTPS, and more
