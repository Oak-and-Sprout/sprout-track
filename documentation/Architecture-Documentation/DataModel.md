# Data Model

## Overview

Sprout Track uses Prisma ORM with SQLite by default; PostgreSQL is also supported — `scripts/prisma-provider.js` rewrites the datasource provider in place based on the `DATABASE_PROVIDER` env var, so all schema and queries must remain compatible with both. The schema defines 40+ models centered around the Family entity. Every piece of user data — babies, caretakers, activity logs, settings — is scoped to a family. The one exception is the SaaS analytics and short-link tables (`ShortLink`, `ShortLinkClick`, `Pageview`), which are global (no `familyId`) and sysadmin-managed — see [SaaS Analytics & Short Links](#saas-analytics--short-links-global-not-family-scoped) below. The default SQLite database file lives at `db/baby-tracker.db`. A second schema, `prisma/log-schema.prisma`, defines a separate API logging database with a single `ApiLog` model (URL from `LOG_DATABASE_URL`).

## Entity Relationship Overview

```
Account (optional, SaaS)
  └── 1:1 Family
         ├── has many Babies
         ├── has many Caretakers
         ├── has many Settings
         ├── has many Activity Logs (all types)
         ├── has many CalendarEvents
         ├── has many Contacts
         ├── has many PushSubscriptions
         └── has many ApiKeys

Baby
  ├── has many Activity Logs (all types)
  ├── has many NotificationPreferences
  └── has many CalendarEvents (via BabyEvent junction)

Caretaker
  ├── has many Activity Logs (all types)
  ├── has many CalendarEvents (via CaretakerEvent junction)
  ├── optional 1:1 Account link
  └── has many FamilyMembers
```

## Core Entities

### Family
The central organizing entity. All data access is scoped by `familyId`.

| Field | Purpose |
|-------|---------|
| `id` | Primary key (cuid) |
| `slug` | URL-friendly identifier (unique), used in route paths |
| `name` | Display name |
| `isActive` | Soft-disable flag |
| `accountId` | Optional link to Account (SaaS mode) |

### Account
Email/password authentication for SaaS mode. Optional — self-hosted deployments use PIN-only auth.

Key fields: `email`, `password` (hashed), `verified`, `betaparticipant`, `closed`, `stripeCustomerId`, `planType`, `planExpires`, `trialEnds`, `language`

One-to-one with Family and Caretaker.

### Caretaker
PIN-based authentication entity. Every user who logs activities is a caretaker.

| Field | Purpose |
|-------|---------|
| `loginId` | Two-digit identifier for quick PIN login (system caretaker = '00') |
| `securityPin` | Hashed PIN for authentication |
| `type` | Role description: parent, nanny, grandparent, daycare, etc. |
| `role` | Authorization level: `USER` or `ADMIN` |
| `language` | Per-caretaker language preference |
| `familyId` | Family this caretaker belongs to |
| `accountId` | Optional link to Account |

### Baby
The subject of all activity tracking.

| Field | Purpose |
|-------|---------|
| `firstName`, `lastName` | Name |
| `birthDate` | Used for age calculations and growth charts |
| `gender` | `MALE` or `FEMALE` (optional) |
| `inactive` | Soft-disable (graduated/grown) |
| `feedWarningTime` | Timer threshold for feed alerts (default "03:00") |
| `diaperWarningTime` | Timer threshold for diaper alerts (default "02:00") |
| `feedTimerFrom` | Count feed timer from "start" or "end" of feeding (default "start") |
| `familyId` | Family scope |

## The Activity Log Pattern

All activity tracking models share a common structure. This consistency is critical for the timeline, reports, and notification systems.

**Shared fields across all activity logs:**

| Field | Type | Purpose |
|-------|------|---------|
| `id` | String (uuid) | Primary key |
| `babyId` | String | Which baby this activity is for |
| `caretakerId` | String? | Who logged it (nullable for system entries) |
| `familyId` | String? | Family scope for authorization |
| `createdAt` | DateTime | Record creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft delete (null = active) |

**Time field convention:** Activities use either `time` (point-in-time events like diaper changes) or `startTime`/`endTime`/`duration` (duration-based events like sleep, feeds, play).

### Activity Models

| Model | Time Pattern | Key Fields |
|-------|-------------|------------|
| `SleepLog` | start/end/duration | `type` (NAP, NIGHT_SLEEP), `quality`, `location` |
| `FeedLog` | time + optional start/end | `type` (BREAST, BOTTLE, SOLIDS), `amount`, `unitAbbr`, `side`, `food`, `bottleType` (mixed feeds store `"Formula/Breast"`), `breastMilkAmount`, `sessionId` (groups breast feeds into one nursing session), `pauseDuration` (total session pause in seconds, same value on both rows of a session; null on older records) |
| `DiaperLog` | time | `type` (WET, DIRTY, BOTH, DRY), `condition`, `color`, `blowout`, `creamApplied` |
| `BathLog` | time | `bathType` ("Full Bath", "Sponge Bath", "Wipe Down", or custom), `soapUsed`, `shampooUsed` |
| `PlayLog` | start/end/duration | `type` (TUMMY_TIME, INDOOR_PLAY, OUTDOOR_PLAY, WALK, CUSTOM) |
| `PumpLog` | start/end/duration | `leftAmount`, `rightAmount`, `totalAmount`, `unitAbbr`, `pumpAction` |
| `MoodLog` | time | `mood` (HAPPY, CALM, FUSSY, CRYING), `intensity` (1-5) |
| `Note` | time | `content`, `category` |
| `Milestone` | date | `title`, `description`, `category` (MOTOR, COGNITIVE, SOCIAL, LANGUAGE, CUSTOM) |
| `Measurement` | date | `type` (HEIGHT, WEIGHT, HEAD_CIRCUMFERENCE, TEMPERATURE), `value`, `unit` |
| `MedicineLog` | time | `medicineId`, `doseAmount`, `unitAbbr` |
| `VaccineLog` | time | `vaccineName`, `doseNumber`, has `VaccineDocument[]` |

### Breast Milk Inventory
Three models work together for breast milk tracking:
- `PumpLog` — Records pumping sessions with `pumpAction` (STORED, FED, DISCARDED)
- `BreastMilkAdjustment` — Manual inventory changes (initial stock, expired, spilled, donated)
- `ActiveBreastFeed` — Persistent breastfeeding session state (one per baby, tracks side, per-side durations, accumulated `pauseDuration`/`pausedAt`, and `firstSide` — used to lay out the per-side `FeedLog` spans when the session ends)

### Active Play Sessions
- `ActiveActivity` — Persistent play session state (one per baby, tracks play type, duration, pause state), the play-activity counterpart of `ActiveBreastFeed`

## Supporting Entities

### Medicine
Medicine definitions (not administration logs):
- `name`, `typicalDoseSize`, `unitAbbr`, `doseMinTime` (minimum time between doses)
- `isSupplement` flag to distinguish vitamins/supplements from medicines
- Related to `MedicineLog` for administration records

### Calendar Events
- `CalendarEvent` — Appointments, schedules, reminders with optional recurrence
- Many-to-many with babies (`BabyEvent`), caretakers (`CaretakerEvent`), and contacts (`ContactEvent`)
- Supports: `RecurrencePattern` (DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY, CUSTOM)

### Contact
External contacts (doctors, teachers, family members):
- Junction tables: `ContactEvent`, `ContactMedicine`, `ContactVaccine`

### Unit
Measurement unit definitions with `unitAbbr` (unique), `unitName`, and `activityTypes` (comma-separated list of applicable activities).

## Configuration Models

### Settings (per-family)
- `familyName`, `securityPin` (for system caretaker auth)
- Default units: `defaultBottleUnit`, `defaultSolidsUnit`, `defaultHeightUnit`, `defaultWeightUnit`, `defaultTempUnit`
- JSON config strings: `activitySettings`, `sleepLocationSettings`, `bathTypeSettings`, `nurseryModeSettings`
- Feature toggles: `enableBreastMilkTracking`, `includeSolidsInFeedTimer`
- Display formats: `dateFormat` (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD), `timeFormat` (12h/24h)
- Debug flags: `enableDebugTimer`, `enableDebugTimezone`

### AppConfig (global, single row)
- `adminPass` — Sitewide admin password
- `rootDomain` — Application domain
- `enableHttps` — HTTPS flag
- `adminEmail` — Admin email for feedback

### NotificationConfig (global, single row)
- VAPID keys (private key encrypted with AES-256-GCM)
- `enabled` flag, `logRetentionDays`

### EmailConfig (global, single row)
- Provider type: SENDGRID, SMTP2GO, or MANUAL_SFTP
- Provider-specific credentials

## Notification Models

- `PushSubscription` — Browser push subscription with endpoint, keys, `failureCount`
- `DeviceToken` — Native (iOS/Android) push token for the mobile app: unique `token`, `platform`, owner (`accountId` or `caretakerId`), `familyId`, plus the same `failureCount` / `lastFailureAt` / `lastSuccessAt` lifecycle fields as `PushSubscription`. See [Native App Integration](./NativeAppIntegration.md).
- `NotificationPreference` — Per-subscription, per-baby, per-event-type preferences
- `NotificationLog` — Delivery tracking (success/failure, HTTP status, payload) — web push only

## CDC Growth Data

Reference data tables for growth chart percentile calculations:
- `CdcWeightForAge` — Weight percentiles (0-36 months)
- `CdcLengthForAge` — Length/height percentiles (0-36 months)
- `CdcHeadCircumferenceForAge` — Head circumference percentiles (0-36 months)

All use the LMS method (L, M, S parameters) with pre-calculated percentile columns (P3-P97).

## External Integration

### ApiKey
For webhook/Home Assistant integration:
- `keyPrefix` (display), `keyHash` (SHA-256 for lookup)
- `scopes` — JSON array of permissions (read, write)
- Optional: `babyId` restriction, `expiresAt`

### FamilySetup
Token-based family creation invitations:
- `token` (unique), `password` (hashed), `expiresAt`
- Links `createdBy` caretaker to resulting family

## Feedback and Platform Models

- `Feedback` / `FeedbackAttachment` — User feedback and support threads (replies via self-relation `parentId`), with image attachments stored encrypted
- `DemoTracker` — Tracks the auto-regenerated demo family
- `BetaSubscriber`, `BetaCampaign`, `BetaCampaignEmail` — Beta signup and email campaign tracking

## SaaS Analytics & Short Links (global, not family-scoped)

These three models are **not** scoped to a family — they have no `familyId`. They exist only in SaaS mode (`DEPLOYMENT_MODE=saas`) and are managed by the system administrator, not by families. See [SaaS Analytics and Short Links](./SaasAnalyticsAndShortLinks.md) for the full feature architecture.

### ShortLink
System-admin URL shortener destinations:
- `slug` — 8 hex-char unique identifier (e.g. `a1b2c3d4`), used in the public `/go/{slug}` redirect path
- `url` — absolute http/https destination
- `name`, `description`, `tag` (campaign grouping, indexed)
- `enabled` — soft-disable flag (disabled links redirect to `/`)
- `clickCount` — denormalized running total, incremented per redirect
- Has many `ShortLinkClick`

### ShortLinkClick
Per-click telemetry, cascade-deleted with its parent `ShortLink`:
- `deviceType` (mobile/tablet/desktop/bot/unknown), `browser`, `os`, `referrerDomain`, `country`, `region`
- `visitorHash` — daily-rotating truncated sha256 (no raw IP; see below)
- `queryString` — incoming query string (UTM etc.), capped at 1024 chars

### Pageview
Cookieless first-party pageview record (no `familyId`):
- `path` — normalized, allowlisted route (no query, no trailing slash)
- Same telemetry fields as `ShortLinkClick` (`deviceType`/`browser`/`os`/`referrerDomain`/`country`/`region`/`visitorHash`/`queryString`)
- Indexed on `timestamp` and `[path, timestamp]`

**Privacy & retention:** `visitorHash` is `sha256(JWT_SECRET | UTC-day | ip | userAgent)` truncated to 16 hex characters — no raw IP is stored, and the hash rotates every UTC day (so cross-day unique-visitor dedup is not possible; unique counts are per-day estimates). Rows older than 365 days are pruned in-code (there is no retention env var). Rotating `JWT_SECRET` rotates all visitor hashes.

## Database Provider & Prisma 7 Notes

The app supports **SQLite** and **PostgreSQL** from one schema, and runs on
**Prisma 7** (upgraded from Prisma 6 with the Next 15→16 jump in 1.6.6). The
provider is chosen at runtime via `DATABASE_PROVIDER`; `scripts/prisma-provider.js`
rewrites the datasource block, and the Docker image regenerates the client at
container startup. Several Prisma 7 breaking changes affect how the database is
built, migrated, and connected — the ones that have bitten this codebase:

- **Driver adapters are mandatory.** Prisma 7 removes the built-in engine
  connection; every client is constructed with a driver adapter —
  `@prisma/adapter-pg` for PostgreSQL, `@prisma/adapter-better-sqlite3` for
  SQLite (`app/api/db.ts`, `prisma/db.ts`, `prisma/log-db.ts`). A bare
  `new PrismaClient()` throws. One-off scripts must pass an adapter too.
- **`activeProvider` is frozen into the generated client** at `prisma generate`
  time and cannot come from an env var. Because a single Docker image is built for
  sqlite and switched at runtime, `next.config.ts` marks the Prisma clients and
  driver adapters as `serverExternalPackages` so Turbopack does not inline the
  build-time client — otherwise a PostgreSQL container loads the stale sqlite
  client and throws `PrismaClientInitializationError` (issue #266). See
  `documentation/Admin-Documentation/docker-deployment.md`.
- **Schema sync differs by provider.** SQLite uses versioned migration files
  (`prisma migrate deploy`); PostgreSQL has no migration files and syncs with
  `prisma db push`. The DB routes branch on `isPostgreSQL()`
  (`app/api/database/migrate/route.ts`, `migrate-initial/route.ts`).
- **`prisma db push` dropped the `--skip-generate` flag.** In Prisma 7 the flag
  is unknown and aborts the command (`! unknown or unexpected option:
  --skip-generate`). This surfaced during **backup restore on PostgreSQL**: the
  data restore succeeds, then the schema push fails and the UI reports “Database
  may be incompatible,” masking a CLI-flag problem as a data problem. The correct
  call is a bare `npx prisma db push --accept-data-loss` (the routes generate the
  client in a prior step; Prisma 7 `db push` no longer auto-generates).
  `tests/db-migrate-prisma7-flags.test.ts` is the regression guard.
- **Two generated clients, config-file driven.** The main client and a
  separately-generated **log client** (`.prisma/log-client`, custom `output`, used
  by `prisma/log-db.ts`) are configured through `prisma.config.ts` and
  `prisma/log.config.ts`; `db push` reads the datasource URL from the config file
  (override with `--url`).

**Lesson:** when a Prisma CLI command fails with “unknown or unexpected option,”
check the flag against the installed Prisma major version before suspecting the
schema or the data — Prisma 7 removed flags that Prisma 6 accepted.

## Key Files

- `prisma/schema.prisma` — Complete schema definition
- `prisma/log-schema.prisma` — Separate schema for the API logging database (`ApiLog` model)
- `scripts/prisma-provider.js` — Switches datasource provider between SQLite and PostgreSQL
- `app/api/db.ts` — Prisma client singleton
- `app/api/types.ts` — API request/response type definitions for all models
