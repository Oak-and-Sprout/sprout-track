# Environment Variables

## Overview

Sprout Track uses a `.env` file for configuration. Key variables are auto-generated during setup:

- **Local deployments**: `./scripts/env-update.sh` creates and updates `.env` in the project root
- **Docker deployments**: `docker-startup.sh` manages `.env` at `/app/env/.env` (persisted in the `sprout-track-env` volume)

Both delegate to `scripts/ensure-env-defaults.js` (`npm run env:ensure`), the single source of truth for defaults and secret generation.

You do not need to create the `.env` file manually. The setup process handles it.

## Variable Reference

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PROVIDER` | `"sqlite"` | Database backend: `"sqlite"` or `"postgresql"`. Controls schema generation and migration strategy. |
| `DATABASE_URL` | `"file:../db/baby-tracker.db"` (local), `"file:/db/baby-tracker.db"` (Docker) | Database connection string. For SQLite: a `file:` path. For PostgreSQL: `postgresql://user:password@host:5432/dbname`. |
| `LOG_DATABASE_URL` | `"file:../db/api-logs.db"` (local), `"file:/db/baby-tracker-logs.db"` (Docker) | Connection string for the API log database. Can point to the same database as `DATABASE_URL` (uses separate tables). |

### Core

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `"production"` (Docker) | Node environment (`development` or `production`) |
| `PORT` | `3000` | Host port mapping (Docker only, set in compose or env) |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | Auto-generated | Secret used to sign JWT auth tokens. Generated automatically if missing. Auth fails closed if unset -- do not delete it. Changing it invalidates all active sessions. |
| `AUTH_LIFE` | `"86400"` (24 hours) | Access token validity period in seconds |
| `REFRESH_TOKEN_LIFE` | `"604800"` (7 days) | Refresh token lifetime in seconds. Uses a sliding window: resets on each refresh. This is the max gap of inactivity before requiring re-login. |
| `IDLE_TIME` | `"604800"` (7 days) | Legacy idle timeout. Aligned with `REFRESH_TOKEN_LIFE` automatically. |
| `COOKIE_SECURE` | `"false"` | Set to `"true"` to require HTTPS for cookies. The app will only work over HTTPS when enabled. |

### Encryption

| Variable | Default | Description |
|----------|---------|-------------|
| `ENC_HASH` | Auto-generated | 64-character hex string used as the AES-256 encryption key for file sensitive database field encryption (vaccine documents). Generated automatically if missing. |

### Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_NOTIFICATIONS` | `"true"` | Build the notification infrastructure (cron daemon, log directories) into the app. This does not enable notifications -- they must be turned on in the Family Manager settings page after SSL is configured. |
| `NOTIFICATION_CRON_SECRET` | Auto-generated | Bearer token securing the notification cron endpoint. Generated automatically if missing (only when `ENABLE_NOTIFICATIONS` is `"true"`). |
| `NOTIFICATION_LOG_RETENTION_DAYS` | `"30"` | Currently unused -- passed through by `docker-compose.yml` but nothing in the app reads it. Log retention is controlled by the notification settings in the Family Manager UI (stored in the database). |
| `APP_URL` | -- | Full base URL for the app (e.g., `https://baby.example.com`). Used by the cron job to call notification APIs. |
| `ROOT_DOMAIN` | -- | Domain name (e.g., `baby.example.com`). Used to construct `APP_URL` if not set directly. |
| `VAPID_PUBLIC_KEY` | -- | VAPID public key (Docker passthrough). Normally managed in the database via the admin UI. |
| `VAPID_PRIVATE_KEY` | -- | VAPID private key (Docker passthrough). Normally managed in the database via the admin UI. |
| `VAPID_SUBJECT` | `"mailto:notifications@sprouttrack.app"` | VAPID subject identifier |
| `FCM_SERVICE_ACCOUNT_JSON` | (unset) | Inline Firebase service-account JSON enabling the **Android** native-push transport (FCM HTTP v1). Unset = native push to Android devices disabled; web push is unaffected. |
| `APNS_AUTH_KEY` | (unset) | APNs auth key (`.p8` contents) enabling the **iOS** native-push transport. PEM newlines may be literal `\n` — the loader unescapes them. |
| `APNS_KEY_ID` | (unset) | Key ID for the APNs auth key above, from the Apple Developer portal. |
| `APNS_TEAM_ID` | (unset) | Apple Developer Team ID; used as the APNs provider JWT issuer. |
| `APNS_BUNDLE_ID` | (unset) | iOS app bundle identifier; sent as the `apns-topic` header on every push. |
| `APNS_PRODUCTION` | `"false"` (unset = sandbox) | `"true"` routes APNs sends to `api.push.apple.com`; anything else (including unset) routes to `api.sandbox.push.apple.com`. **See the sandbox/production trap below.** |
| `APPLE_TEAM_ID` | (unset) | Apple Developer Team ID used to template the `apple-app-site-association` (Universal Links) response as `{APPLE_TEAM_ID}.com.sprouttrack.app`. Not push-related — required for `/setup/*`, `/verify*`, `/passwordreset*` deep links to work on iOS. Often the same value as `APNS_TEAM_ID` (same Apple team) but configured separately since the two concerns are independent. |
| `ANDROID_CERT_SHA256` | (unset) | SHA-256 fingerprint of the Android app signing certificate (Play App Signing), served from `/.well-known/assetlinks.json` to verify Android App Links. Not push-related. |

### Native Push (mobile app, SaaS-only)

`FCM_SERVICE_ACCOUNT_JSON` and the seven `APNS_*`/`APPLE_TEAM_ID`/
`ANDROID_CERT_SHA256` variables above exist **only** to support the companion
Capacitor mobile app (native push notifications and Universal/App Links). This
is a SaaS-only feature — **self-hosted deployments should leave all of these
unset.** There is no self-hosted use case for them: nothing else in the app
reads them, and the mobile app itself gracefully degrades (device-token routes
404, no permission prompt shown, deep links simply don't resolve to the app) with
every one of them unset. See
[NativeAppIntegration.md](../Architecture-Documentation/NativeAppIntegration.md)
for the full architecture.

**`APNS_PRODUCTION` sandbox/production trap.** APNs has two entirely separate
hosts — `api.sandbox.push.apple.com` and `api.push.apple.com` — and a device
token minted under one is rejected (`BadDeviceToken`) by the other. Which host a
token belongs to is determined by how the *app binary* was signed and
distributed, not by anything the server controls:

- Only a **development build** (installed straight from Xcode, debug run) mints
  **sandbox** tokens.
- **TestFlight builds and App Store builds are both signed with an App Store
  distribution profile** (`aps-environment: production` in the entitlements),
  so both mint **production** tokens — TestFlight is not sandbox.

So leaving `APNS_PRODUCTION` unset/`false` against a fleet of TestFlight
testers' or App Store users' devices will send every push into
`BadDeviceToken` failures — and the reverse, setting it `true` against
Xcode-installed development builds, does the same in the other direction. Set
it to match how the *client binaries currently in the field* were built, not
how the server happens to be deployed: `false`/unset only while every device
in the field is an Xcode development install, `true` from the first TestFlight
build onward.

### Logging

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_LOG` | `"false"` | Enable API request/response logging to a separate database |

### Service Management

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVICE_NAME` | -- | Name of the systemd service (local deployments only). Not auto-generated -- add it to `.env` manually; `scripts/service.sh` exits with an error if it is missing. |

### ST-Guardian (Optional)

| Variable | Default | Description |
|----------|---------|-------------|
| `ST_GUARDIAN_KEY` | -- | Access key for the ST-Guardian update service. Setting this enables the "System Updates" section in App Configuration. |
| `ST_GUARDIAN_PORT` | `"3001"` | Port the ST-Guardian service listens on |

### Other

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_VERSION` | `"1.6.4"` | Application version string |
| `TZ` | -- | Timezone for the container (Docker only, e.g., `America/New_York`) |

### SaaS Mode (Not Needed for Self-Hosting)

| Variable | Default | Description |
|----------|---------|-------------|
| `DEPLOYMENT_MODE` | `"selfhosted"` | `"selfhosted"` or `"saas"`. Leave unset for self-hosted deployments. |
| `ENABLE_ACCOUNTS` | `"false"` | Enable account-based (email/password) authentication |
| `ALLOW_ACCOUNT_REGISTRATION` | `"false"` | Allow new account registration |
| `BETA` | -- | Set to `"1"` to enable beta signup features |

SaaS mode additionally uses Stripe variables (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_GIFT_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID`, `NEXT_PUBLIC_STRIPE_LIFETIME_PRICE_ID`) and email from-addresses (`ACCOUNTS_EMAIL`, `VERIFICATION_EMAIL`, `SECURITY_EMAIL`, `PAYMENTS_EMAIL`). None of these are required for a self-hosted deployment.

Every from-address must be a **verified sender** with your email provider. SendGrid rejects a send outright when the from address does not match a verified Sender Identity, and the rejection only appears in a server log — so a wrong address looks exactly like a delivered message. All four are sent with a `Sprout Track <…>` display name, so the verified sender's From Name should match.

| Variable | Default | Used for |
|---|---|---|
| `ACCOUNTS_EMAIL` | `accounts@sprout-track.com` | Account lifecycle: verification, password reset, welcome, closure |
| `PAYMENTS_EMAIL` | `payments@sprout-track.com` | Payment mail: gift codes (receipts later) |
| `ADMIN_EMAIL` | `admin@sprout-track.com` | Feedback correspondence, both directions |
| `NO_REPLY_EMAIL` | `no-reply@sprout-track.com` | Notifications nobody should reply to |

`VERIFICATION_EMAIL` and `SECURITY_EMAIL` are **no longer read**. They previously defaulted to `accounts@` and `passwordreset@` respectively; the latter was never a verified sender, so password-reset mail was being rejected silently. Account mail now goes through `ACCOUNTS_EMAIL`.

Every outgoing message states that its mailbox is unmonitored and directs the reader to the in-app Feedback thread. Account, payment, no-reply and admin-facing feedback mail carry a shared footer; the two user-facing feedback templates already carried their own prominent version of the same notice and were left as-is rather than stating it twice.

## Security-Sensitive Variables

**`ENC_HASH`**: This key encrypts files stored in the application (vaccine documents). If you lose this value, encrypted files and admin access to Sprout Track cannot be decrypted. Do not modify it after data has been encrypted. Always back up your `.env` file before updates. When using the backup tool in the /family-manager settings page the `.env` file is included.

**`JWT_SECRET`**: Signs all JWT auth tokens. Auto-generated; never falls back to a shared default -- authentication fails if it is unset. Changing it logs out all users. Back it up with the rest of your `.env`.

**`NOTIFICATION_CRON_SECRET`**: Protects the notification timer endpoint from unauthorized access. Auto-generated (32 random bytes, hex-encoded). Uses timing-safe comparison.

**`ST_GUARDIAN_KEY`**: Controls access to the update service. Only set this if you are running ST-Guardian.

## Auto-Generation

The following variables are automatically generated if missing by `scripts/ensure-env-defaults.js` (invoked by `env-update.sh` locally and `docker-startup.sh` in Docker):

| Variable | Method |
|----------|--------|
| `ENC_HASH` | 32 random bytes, hex-encoded (`crypto.randomBytes`) |
| `JWT_SECRET` | 32 random bytes, hex-encoded (`crypto.randomBytes`) |
| `NOTIFICATION_CRON_SECRET` | 32 random bytes, hex-encoded (only when `ENABLE_NOTIFICATIONS` is `"true"`) |
| `AUTH_LIFE` | Default value `86400` |
| `IDLE_TIME` | Default value `604800` matched to `REFRESH_TOKEN_LIFE` |
| `REFRESH_TOKEN_LIFE` | Default value `604800` |

## PostgreSQL Configuration

When using PostgreSQL (`DATABASE_PROVIDER="postgresql"`), set `DATABASE_URL` to a PostgreSQL connection string:

```
DATABASE_URL="postgresql://user:password@host:5432/sprout_track"
```

The `LOG_DATABASE_URL` can point to the same database — Prisma uses separate table names so there is no conflict:

```
LOG_DATABASE_URL="postgresql://user:password@host:5432/sprout_track"
```

Or use a separate database if preferred:

```
LOG_DATABASE_URL="postgresql://user:password@host:5432/sprout_track_logs"
```

The `docker-compose.postgres.yml` file does not bundle a PostgreSQL service -- it requires an existing PostgreSQL 14+ server. `DATABASE_URL` and `LOG_DATABASE_URL` are required and the compose file refuses to start without them (set them in your shell environment or a `.env` file next to the compose file).

If you run your own PostgreSQL container, `scripts/init-pg-databases.sh` can be mounted into `docker-entrypoint-initdb.d` to create the log database automatically (it honors `POSTGRES_LOG_DB`, default `sprout_track_logs`).

## Docker vs. Local

| Aspect | Docker | Local |
|--------|--------|-------|
| `.env` location | `/app/env/.env` (persisted in `sprout-track-env` volume) | Project root `.env` |
| Auto-generation | `docker-startup.sh` on every container start | `./scripts/env-update.sh` during setup/deployment |
| Port configuration | `PORT` env var in compose file | `-p` flag in package.json scripts |
| Timezone | `TZ` env var | System timezone |
| Database provider | `DATABASE_PROVIDER` env var (default: `sqlite`) | `DATABASE_PROVIDER` in `.env` (default: `sqlite`) |
