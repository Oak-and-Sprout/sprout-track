# SaaS Analytics and Short Links

## Overview

Two SaaS-only, system-administrator-managed features share a common privacy design and telemetry pipeline:

- **Pageview analytics** — cookieless, first-party pageview tracking for the public and auth-funnel pages (landing, pricing, login, setup, etc.).
- **Short links** — a URL shortener with per-click telemetry, served from the public `/go/{slug}` redirect path.

Both are **global, not family-scoped**: their Prisma models (`Pageview`, `ShortLink`, `ShortLinkClick`) have no `familyId`, and their management APIs use `withSysAdminAuth` rather than the family-scoped golden-rule pattern. Both features **hard-`404` in self-hosted mode** — they only exist when `DEPLOYMENT_MODE=saas`. See [Data Model](./DataModel.md#saas-analytics--short-links-global-not-family-scoped) and [API Design Patterns](./APIDesignPatterns.md#saas-gated--public-endpoints).

## Data Model

Three models, none family-scoped (see [DataModel.md](./DataModel.md#saas-analytics--short-links-global-not-family-scoped) for full field lists):

- `ShortLink` — destination (`slug`, `url`, `name`, `description`, `tag`, `enabled`, denormalized `clickCount`).
- `ShortLinkClick` — per-click telemetry, cascade-deleted with its parent link.
- `Pageview` — one row per recorded pageview, telemetry plus a normalized `path`.

`ShortLinkClick` and `Pageview` carry the same telemetry columns: `deviceType`, `browser`, `os`, `referrerDomain`, `country`, `region`, `visitorHash`, `queryString`.

## SaaS Gating

Each feature's route helper exposes a gate that returns a `404` `NextResponse` when the deployment is not SaaS:

- `analyticsSaasGate()` — `app/api/utils/analytics.ts`
- `shortLinkSaasGate()` — `app/api/utils/short-links.ts`

Handlers call the gate first and return its response if non-null. The public redirect (`/go/[slug]`) performs the same check inline and redirects to `/` in self-hosted mode. This mirrors the gift-code "404-in-selfhosted" convention — in a self-hosted deployment the endpoints simply do not exist.

## Pageview Collection Flow

1. `PageviewBeacon` (`src/components/analytics/PageviewBeacon.tsx`) is a client component mounted in the public/funnel layouts only: `(auth)/layout.tsx`, `(marketing)/layout.tsx`, `home/layout.tsx`, and the `family-select`, `setup`, `verify`, `passwordreset`, and `(setup-resume)/[slug]/resume-setup` pages.
2. It reads `isSaasMode`/`isLoading` from `DeploymentProvider` and **no-ops entirely** outside SaaS mode and while deployment config is loading, so web/self-hosted behavior is unchanged.
3. On each route change (deduped against the last path) it fires `navigator.sendBeacon` — falling back to `fetch(..., { keepalive: true })` — to `POST /api/analytics/collect` with `{ path, referrer, query }` (built by the pure `beaconBody()`). Any failure is swallowed so navigation is never broken.
4. `POST /api/analytics/collect` is **unauthenticated by design**. It normalizes the path against an allowlist (`normalizePath`), dropping unknown/garbage paths silently with `204`. It derives device/browser/OS from the user agent, geo from CDN headers, and the visitor hash server-side, then inserts a `Pageview`. The write is wrapped so a failure never breaks the `204` response.

## Short-Link Redirect Flow

`GET /go/[slug]` (`app/go/[slug]/route.ts`) is **unauthenticated by design** — the slug is the only credential:

1. Self-hosted mode, an invalid slug (must match `^[0-9a-f]{8}$`), a missing link, or a disabled link all redirect to `/` (302).
2. Incoming query params are merged onto the destination URL via `mergeQueryParams()` — on key conflict the **destination's own param wins**; the fragment is preserved.
3. Click capture (insert a `ShortLinkClick` and increment `clickCount` in one transaction) runs inside its own try/catch so **logging never breaks the redirect**.
4. The response is a `302` to the merged destination.

## Path Allowlist & Normalization

`normalizePath()` (`src/utils/analytics-utils.ts`) maps a raw client path to a canonical allowlisted route or `null`. It strips query/hash/trailing-slash, lowercases, rejects `..`, and maps `/<slug>/resume-setup` to the templated `/:slug/resume-setup`. Only paths in `ANALYTICS_ALLOWED_PATHS` (plus the resume-setup template) are recorded; everything else is dropped. This keeps analytics to public/funnel routes and prevents family slugs and other user data from being stored as paths.

## Visitor-Hash Privacy Design

There are no cookies and no raw IP is stored. Visitor identity is a **daily-rotating, non-reversible** hash:

```
visitorHash = sha256(JWT_SECRET | UTC-day | ip | userAgent).slice(0, 16)
```

- `JWT_SECRET` is the salt — rotating it (which also logs out all users) rotates every visitor hash.
- The UTC day component means the hash changes at each UTC midnight.

**Uniques caveat:** because the hash rotates daily, cross-day deduplication is impossible. Unique-visitor counts are computed per UTC day and summed — a documented estimate, not an exact distinct-visitor count. This is reflected in `aggregateClicks()` / `aggregatePageviews()`.

## Retention

Pageview rows older than **365 days** are pruned in-code: the collect endpoint runs a `deleteMany` roughly 1 in 500 requests (`shouldPrune(Math.random())`), wrapped so a prune failure never affects the response. There is **no environment variable** for retention — the 365-day window is fixed. (The privacy policy documents the 1-year auto-delete.)

## Stats & CSV Export

Sysadmin-only stats and export endpoints back the family-manager dashboards:

- Short links: `GET /api/short-links/[id]/stats`, `GET /api/short-links/[id]/export`
- Analytics: `GET /api/analytics/stats`, `GET /api/analytics/export`

Filters (day range, device/country/referrer, pagination) are parsed by `parseStatsFilters()` / `parseAnalyticsFilters()` and turned into Prisma `where` clauses. Aggregation (zero-filled daily series, totals, sorted breakdowns, and the coarse page-based conversion funnel) lives in the pure utils. CSV output (`buildClicksCsv` / `buildPageviewsCsv`) is RFC-4180 with CRLF line endings, and `escapeCsvField()` guards against **formula injection** by prefixing any field that begins with `=`, `+`, `-`, `@`, or tab with a single quote.

## Management UI

- `app/family-manager/short-links/page.tsx` — list and create short links.
- `app/family-manager/short-links/[id]/page.tsx` — per-link detail and click stats.
- `app/family-manager/analytics/page.tsx` — pageview analytics dashboard.
- `src/components/familymanager/short-link-qr-dialog.tsx` — renders a scannable QR code for a short link using the `qrcode` dependency.

The admin side navigation (`admin-side-nav`) surfaces SaaS-gated "Short Links" and "Analytics" items with count bubbles fed by `admin-count-context` (`shortLinks`/`pageviews`).

## Key Files

- `prisma/schema.prisma` — `ShortLink`, `ShortLinkClick`, `Pageview` models
- `app/go/[slug]/route.ts` — public short-link redirect (unauthenticated, SaaS-gated)
- `app/api/analytics/collect/route.ts` — public pageview beacon (unauthenticated, SaaS-gated, in-code prune)
- `app/api/analytics/stats/route.ts`, `app/api/analytics/export/route.ts` — sysadmin stats + CSV
- `app/api/short-links/route.ts`, `app/api/short-links/[id]/route.ts`, `[id]/stats/route.ts`, `[id]/export/route.ts` — sysadmin CRUD + stats/CSV
- `app/api/utils/analytics.ts`, `app/api/utils/short-links.ts` — SaaS gates, filter parsing, where-builders
- `app/api/utils/short-link-stats.ts` — click stats filter parsing / where-builder
- `src/utils/analytics-utils.ts` — path allowlist/normalization, pageview aggregation, funnel, CSV
- `src/utils/short-link-utils.ts` — UA parsing, visitor hash, geo/IP header parsing, slug bytes, query merge, click aggregation, CSV escaping
- `src/components/analytics/PageviewBeacon.tsx`, `beacon-body.ts` — client beacon
- `src/components/familymanager/short-link-qr-dialog.tsx` — QR code dialog
