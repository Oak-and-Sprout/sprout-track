# Project Structure

## Overview

Sprout Track is a Next.js baby tracking application using the App Router. The codebase is organized into two main areas: `app/` for routing, pages, and API endpoints, and `src/` for shared components, hooks, context, and utilities. The application is deployed via Docker with SQLite as the default database; PostgreSQL is also supported (`docker-compose.postgres.yml`, `DATABASE_PROVIDER` env var), and all Prisma queries must be compatible with both.

## Directory Tree

```
/
├── app/                         # Next.js App Router (pages, layouts, API)
│   ├── (app)/[slug]/            # Main authenticated app (family-scoped)
│   ├── (auth)/                  # Login/auth pages
│   ├── (nursery)/[slug]/        # Nursery mode (tablet-optimized)
│   ├── (setup-resume)/[slug]/   # Resume an in-progress family setup
│   ├── account/                 # Account management pages
│   ├── api/                     # All API routes (~50 route folders)
│   ├── context/                 # App-level context providers
│   ├── family-manager/          # System admin family management
│   ├── family-select/           # Family selection page
│   ├── home/                    # Landing/home page
│   ├── setup/                   # Token-based family setup
│   ├── layout.tsx               # Root layout (provider hierarchy)
│   ├── page.tsx                 # Root page (redirects)
│   └── globals.css              # Global styles
├── src/                         # Shared application code
│   ├── components/              # All React components
│   ├── constants/               # Application constants (vaccines)
│   ├── context/                 # Shared context providers
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Libraries (email, notifications, utils)
│   ├── localization/            # Translation files and config
│   └── utils/                   # Utility functions
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma            # Main database schema
│   ├── log-schema.prisma        # Separate logging database schema
│   ├── migrations/              # Migration files
│   └── seed.ts                  # Database seeding
├── public/                      # Static assets (icons, tutorial/demo videos)
│   ├── sw.js                    # Service worker (push notifications)
│   └── manifest.json            # PWA manifest
├── scripts/                     # Utility scripts
├── tests/                       # Tests (Vitest)
├── db/                          # SQLite database files (Docker volume)
├── Dockerfile                   # Multi-stage Docker build
├── docker-compose.yml           # Container orchestration (SQLite)
├── docker-compose.postgres.yml  # Container orchestration (PostgreSQL)
├── CLAUDE.md                    # Development rules and conventions
└── tailwind.config.js           # Tailwind configuration
```

## Route Groups

All authenticated routes use a `[slug]` dynamic segment for family scoping. The slug identifies which family's data to display.

### `(app)/[slug]/` — Main Application
The primary user experience after login:
- `page.tsx` — Dashboard home (daily stats, activity tiles, baby selector)
- `calendar/page.tsx` — Monthly calendar with activity indicators
- `full-log/page.tsx` — Complete activity timeline with filtering
- `log-entry/page.tsx` — Activity logging form
- `reports/page.tsx` — Reports and growth charts
- `layout.tsx` — App shell with side navigation, mobile menu, providers

### `(auth)/` — Authentication
- `login/page.tsx` — Login page (PIN-based or account-based)

### `(nursery)/[slug]/` — Nursery Mode
- `nursery-mode/page.tsx` — Simplified tablet interface for daycare/nursery use
- Separate layout optimized for wall-mounted tablets

### `(setup-resume)/[slug]/` — Setup Resume
- `resume-setup/page.tsx` — Resume a partially completed family setup

### Other Page Routes
- `account/` — Account management (family setup, payment success/cancelled)
- `family-manager/` — System admin interface for managing all families
- `family-select/` — Family selection (for users with access to multiple families)
- `setup/` — Token-based family setup (invited users)

## API Route Organization

API routes live under `app/api/` and are organized by domain. Each folder contains a `route.ts` file exporting named HTTP method handlers (GET, POST, PUT, DELETE).

### Core Domains
| Domain | Route Prefix | Purpose |
|--------|-------------|---------|
| Authentication | `/api/auth/` | Login, logout, token refresh, IP lockout |
| Accounts | `/api/accounts/` | Registration, verification, password management, payments |
| Family | `/api/family/` | Family CRUD, slug management, setup invites |
| Baby | `/api/baby/` | Baby CRUD, last activities, upcoming events |
| Caretaker | `/api/caretaker/` | Caretaker management, system caretaker |

### Activity Logging
| Route | Activity |
|-------|----------|
| `/api/sleep-log/` | Sleep and nap tracking |
| `/api/feed-log/` | Feeding (breast, bottle, solids) |
| `/api/diaper-log/` | Diaper changes |
| `/api/bath-log/` | Bath logging |
| `/api/play-log/` | Play and tummy time |
| `/api/pump-log/` | Breast pump sessions |
| `/api/measurement-log/` | Height, weight, temperature |
| `/api/medicine-log/` | Medicine administration |
| `/api/milestone-log/` | Developmental milestones |
| `/api/vaccine-log/` | Vaccine tracking with document uploads |

### Supporting APIs
| Route | Purpose |
|-------|---------|
| `/api/settings/` | Family settings, units, activity config |
| `/api/notifications/` | Push subscription, preferences, VAPID |
| `/api/calendar-event/` | Calendar events with recurrence |
| `/api/timeline/` | Aggregated activity timeline |
| `/api/localization/` | Language preferences |
| `/api/hooks/v1/` | External webhook API (Home Assistant) |
| `/api/database/` | Migration and backup management |

### Shared API Infrastructure
- `app/api/db.ts` — Prisma client singleton
- `app/api/types.ts` — Shared API type definitions
- `app/api/utils/` — Auth middleware, timezone, encryption, logging, and more

## Component Organization

```
src/components/
├── ui/                    # 39 base UI primitives
│   ├── button/            # Each has: index.tsx, styles.ts, .css, types.ts, README.md
│   ├── input/
│   ├── modal/
│   ├── card/
│   ├── select/
│   ├── dialog/
│   ├── table/
│   ├── toast/
│   └── ... (31 more)
├── forms/                 # Form components (one per activity type)
│   ├── FeedForm/
│   ├── SleepForm/
│   ├── DiaperForm/
│   └── ... (18 more)
├── modals/                # Modal components
├── Calendar/              # Feature components at root level
├── Timeline/
├── Reports/
├── DailyStats/
├── BabySelector/
├── SetupWizard/
├── account-manager/       # Account management UI
├── familymanager/         # System admin family management
├── reporting/             # Report visual components
└── features/              # Feature-specific utilities (nursery-mode)
```

## Localization

All user-facing strings (including `aria-label`s) go through `t()` from the `useLocalization` hook (`@/src/context/localization`).

- `src/localization/translations/` — per-language JSON files (10 languages); flat key-value structure where keys are the exact English text and `en.json` is the fallback
- `src/localization/supported-languages.json` — supported language configuration
- `scripts/check-missing-translations.js` — adds missing keys to all non-English files and sorts them; run after adding keys to `en.json`

## Docker Deployment

The application runs in a Docker container built from `node:22-alpine`:

**Volumes:**
- `/db` — SQLite database files (persistent)
- `/app/env` — Environment configuration files
- `/app/Files` — Encrypted vaccine document storage

(`/app/logs` is created inside the image for notification logs but is not a mounted volume.)

**Key Environment Variables:**
- `DEPLOYMENT_MODE` — `saas` or `selfhosted` (code checks for `'saas'`)
- `JWT_SECRET` — JWT signing key
- `AUTH_LIFE` — Access token lifetime (seconds)
- `IDLE_TIME` — Client idle timeout (seconds)
- `ENABLE_NOTIFICATIONS` — Push notification feature flag
- `COOKIE_SECURE` — Secure cookie flag for HTTPS

**Startup:** `docker-startup.sh` runs Prisma migrations and starts the Next.js server.

## Key Files

- `app/layout.tsx` — Root layout with provider hierarchy
- `app/api/db.ts` — Prisma client singleton
- `app/api/utils/auth.ts` — Authentication middleware (see AuthenticationAndAuthorization.md)
- `prisma/schema.prisma` — Complete data model (see DataModel.md)
- `CLAUDE.md` — Development conventions and rules
- `tailwind.config.js` — Tailwind theme configuration (`darkMode: 'class'`)
- `public/sw.js` — Service worker for push notifications
