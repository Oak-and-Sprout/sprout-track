# Data Model

## Overview

Sprout Track uses Prisma ORM with SQLite. The schema defines 40+ models centered around the Family entity. Every piece of user data — babies, caretakers, activity logs, settings — is scoped to a family. The database file lives at `db/baby-tracker.db`.

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
| `FeedLog` | time + optional start/end | `type` (BREAST, BOTTLE, SOLIDS), `amount`, `unitAbbr`, `side`, `food`, `bottleType`, `breastMilkAmount` |
| `DiaperLog` | time | `type` (WET, DIRTY, BOTH), `condition`, `color`, `blowout`, `creamApplied` |
| `BathLog` | time | `soapUsed`, `shampooUsed` |
| `PlayLog` | start/end/duration | `type` (TUMMY_TIME, INDOOR_PLAY, OUTDOOR_PLAY, WALK, CUSTOM) |
| `PumpLog` | start/end/duration | `leftAmount`, `rightAmount`, `totalAmount`, `unitAbbr`, `pumpAction` |
| `MoodLog` | time | `mood` (HAPPY, CALM, FUSSY, CRYING), `intensity` (1-5) |
| `Note` | time | `content`, `category` |
| `Milestone` | date | `title`, `description`, `category` (MOTOR, COGNITIVE, SOCIAL, LANGUAGE, CUSTOM) |
| `Measurement` | date | `type` (HEIGHT, WEIGHT, HEAD_CIRCUMFERENCE, TEMPERATURE), `value`, `unit` |
| `MedicineLog` | time | `medicineId`, `doseAmount`, `unitAbbr` |
| `VaccineLog` | time | `vaccineName`, `doseNumber`, has `VaccineDocument[]` |

### Breast Milk Inventory
Two models work together for breast milk tracking:
- `PumpLog` — Records pumping sessions with `pumpAction` (STORED, FED, DISCARDED)
- `BreastMilkAdjustment` — Manual inventory changes (initial stock, expired, spilled, donated)
- `ActiveBreastFeed` — Persistent breastfeeding session state (one per baby, tracks side, duration, pause state)

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
- JSON config strings: `activitySettings`, `sleepLocationSettings`, `nurseryModeSettings`
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
- `NotificationPreference` — Per-subscription, per-baby, per-event-type preferences
- `NotificationLog` — Delivery tracking (success/failure, HTTP status, payload)

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

## Key Files

- `prisma/schema.prisma` — Complete schema definition
- `app/api/db.ts` — Prisma client singleton
- `app/api/types.ts` — API request/response type definitions for all models
