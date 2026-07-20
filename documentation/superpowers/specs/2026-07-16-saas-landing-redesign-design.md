# SaaS Landing Page Redesign — Design Spec

**Date:** 2026-07-16
**Branch:** `2026-july-5`
**Mockup:** `documentation/temp-development-docs/v1-storybook/` (index.html, features.html, pricing.html, terms.html, privacy.html, style.css, art/, uploads/)

## Goal

Replace the current single-page SaaS-mode landing page (`app/home/page.tsx` + `home.css`) with the "V1 Storybook" redesign: a multi-page marketing site (home, features, pricing, terms, privacy) in a paper-cream design with Literata/Alegreya Sans typography, reusing the existing account modals and form pages, fully localized across all 11 supported languages.

## Decisions (settled during brainstorming)

| Decision | Choice |
|---|---|
| Page structure | Real Next.js routes: `/` (home), `/features`, `/pricing`, `/terms`, `/privacy` |
| Theming | Light-only. Fixed cream/teal/apricot tokens; no `html.dark` overrides; no ThemeToggle in landing nav. Reused modals keep normal app theming. |
| Proof stats | Fetched live (GitHub stars + family count) with hardcoded fallbacks |
| Legal content | English-only; rewrite the two markdown files in `public/` from the mockup |
| Nav auth | Mockup nav + quiet "Log in" text link; logged-in users see the existing `AccountButton` dropdown instead |
| Language selector | Compact `LanguageSelector` in the footer, not the nav |
| Prices | $2.99/month, $19.99 lifetime (display only — Stripe price IDs/env untouched; John wires Stripe during testing) |
| Code structure | Approach A: shared component library in `src/components/landing/` + one `landing.css` |
| Commits | Agents commit locally on `2026-july-5`; never push |

## Architecture

### Routing

- **`app/page.tsx` (SaaS gate) is untouched.** It already renders `./home/page` when `deploymentMode === 'saas'` (lines 58–63, 159–165).
- **`app/home/page.tsx`** is rewritten as a thin composition of landing components. It keeps, verbatim in behavior, the existing URL auto-open logic: `#verify?token=`, `#passwordreset?token=`, `?upgrade=true`, `?login=true` open `AccountModal` in the right mode.
- **`app/home/home.css` is deleted**, replaced by the shared landing stylesheet.
- **New route group `app/(marketing)/`** containing `features/page.tsx`, `pricing/page.tsx`, `terms/page.tsx`, `privacy/page.tsx`. Its `layout.tsx` (client component):
  - wraps children in `LocalizationProvider` + `ThemeProvider` (reused modals need them),
  - renders `LandingNav` and `LandingFooter`,
  - fetches `/api/deployment-config`; when not SaaS mode, `router.replace('/')`,
  - applies the landing font CSS variables.
- `app/home/layout.tsx` keeps its providers; the home page renders its own `LandingNav`/`LandingFooter` (it lives outside the route group because `app/page.tsx` imports it directly).

### Typography & styling

- Fonts via `next/font/google`: **Literata** (display/serif) and **Alegreya Sans** (body), exposed as CSS variables (`--font-literata`, `--font-alegreya`) on the landing wrappers. No external font requests at runtime.
- **`src/components/landing/landing.css`** — single stylesheet adapted from the mockup's `style.css`: tokens (`--paper:#f7f1e2`, `--paper2:#efe6d0`, `--card:#fffdf6`, `--ink:#26382f`, `--body:#3d5044`, `--sub:#6b7a6c`, `--line:#ddd2b8`, `--teal:#0c6b62`, `--teal-deep:#0a544d`, `--apricot:#c2691e`, `--radius:16px`), nav, hero, buttons, kick/lede, section bands, day story, feature rows, chip sets, plan cards, self-host callout, FAQ, pagehead, close CTA, legal typography, footer, sprites, and the mockup's 900px/620px responsive rules. Class names keep a `landing-` or the mockup's semantic naming to avoid colliding with app CSS.
- This intentionally deviates from the CVA/`styles.ts` convention the same way the current landing does; components are one-off marketing sections, not reusable UI primitives.

### Component inventory — `src/components/landing/`

Each component is small (<200 lines), typed, presentational, and takes localized strings/data via props or calls `t()` directly:

| Component | Role |
|---|---|
| `LandingNav` | Sticky nav: logo, Features, Pricing, GitHub, "Log in" link (opens `AccountModal` login), teal "Start my free trial" button (opens register). Logged-in: `AccountButton` dropdown replaces both. Mobile: text links hidden per mockup breakpoints. |
| `LandingFooter` | Links (Features, Pricing, Demo, GitHub, Terms, Privacy), compact `LanguageSelector`, "© 2025–2026 Open Glades LLC · Kansas City". |
| `LandingHero` | Home hero: kick, headline with italic `em`, lede, CTA row (trial button + demo ghost button with "ID: 01 · PIN: 111111" note), assurance line, live proof stats, browser-frame screenshot, butterfly/teddy sprites, lifestyle-photo background. |
| `DayStory` | "One Tuesday, tracked together" timeline: five entries with activity icon, caretaker chip (mom/dad/gma/nanny colorways), note, time. |
| `FeatureRow` | Split text + figure with `flip` variant, heading, paragraph, check-list items. |
| `FeatureChips` | Rounded chip grid; used for the 15 tracking-type chips (icon + label, per mockup) and the 11 language chips (text-only). |
| `PlanCard` | Pricing card: tag ("Most popular"/"Best value"), title, price + unit, sub-line, check list, CTA. `hot` variant = teal border/shadow. |
| `SelfHostCallout` | Dashed "Self-host, free forever" box with GitHub button. |
| `FaqAccordion` | `<details>/<summary>` list from a typed `{question, answer}[]`. |
| `PageHead` | Features/pricing page header: kick, h1, lede, lifestyle/porch photo background variants. |
| `CloseCta` | Closing CTA band: heading, optional sub-line, trial button, assurance line, optional sprite. |
| `LegalPage` | Fetches a markdown file from `public/` and renders it with the same markdown rendering approach as the existing `TermsOfUseModal`/`PrivacyPolicyModal`; page-styled (not modal) typography. |

Static data (plans, FAQ entries, day-story rows, chip lists) lives in typed constant modules beside the components (e.g., `landing-data.ts`) so shapes are unit-testable and pages stay thin.

## Pages & content

Copy comes straight from the mockup (English source keys):

- **Home `/`**: hero ("Everyone who loves your baby, *on the same page.*") → day story → three feature rows (Log anything in two taps / The whole day at a glance / Nursery mode) with "See every feature" link → shield band ("Your baby's data isn't a product.") → pricing teaser ($2.99/month, $19.99 once, self-hosting free; "See pricing" link) → "From the maker" Kansas City band → closing CTA ("Start tonight. The 3 am shift will thank you.").
- **Features `/features`**: porch-photo pagehead ("Everything a newborn throws at you…") → "Track all of it" chip grid (icons from existing `public/*-256.png` / `breastfeed-128.png` / `photo-192.png`) → feature rows: care team, "In grandma's language too" (11 language chips), pediatrician answers, vaccines with attachments, solid foods / first-100-foods → open source band → closing CTA.
- **Pricing `/pricing`**: photo pagehead ("Cheaper than one canister of formula.") → plan cards: Hosted Monthly $2.99/mo (hot, "after a 14-day free trial") and Lifetime $19.99 once ("pays for itself in 7 months") → self-host callout → "Fair questions" FAQ (6 items from mockup) → closing CTA. Plan CTAs open `AccountModal` register.
- **Terms `/terms` & Privacy `/privacy`**: `LegalPage` rendering rewritten `public/terms_of_use.md` and `public/privacy_policy.md`, converted from the mockup HTML (Effective Date July 17, 2026; Open Glades LLC; Kansas governing law; GDPR/CCPA sections; contact sprout-track@jroverton.com). The existing in-app modals fetch these same files, so they serve the new content with no modal changes.

All "Start my free trial" CTAs open `AccountModal` in `register` mode. GitHub links → `https://github.com/Oak-and-Sprout/sprout-track`. Demo links → `/demo`.

## Data: landing stats API

- **`GET /api/landing-stats`** (public, no auth): returns `{ success, data: { families: number, stars: number } }`.
- Families: Prisma `family.count` (filtered to active families if the `Family` model has an active/`isActive` flag, otherwise total count; query must be SQLite- and PostgreSQL-compatible).
- Stars: GitHub REST API `GET /repos/Oak-and-Sprout/sprout-track` `stargazers_count`.
- Server-side cache ~1 hour (module-level timestamped cache, same pattern as other simple caches in the repo). Any failure → fallback `{ families: 70, stars: 322 }`.
- Display: families floored to nearest 10 with "+" (74 → "70+"); stars shown as-is. Formatting + fallback logic extracted to a pure helper (`src/utils/landing-stats.ts` or route-adjacent helper) for unit tests.

## Assets

Copied into **`public/landing/`**:

- Art sprites from `v1-storybook/art/`: `butterfly.svg`, `teddy.svg`, `kitten.svg`, `star.svg`, `rocket.svg`, `family-porch-flipped.png`.
- App screenshots from `v1-storybook/uploads/`: hero shot (`pasted-1784247683193-0.png`), log feeding (`SCR-20260716-qyxi.png`), daily log (`pasted-1784248426816-0.png`), nursery mode (`SCR-20260716-rvqx.png`), caretaker form (`pasted-1784250264745-0.png`), report card (`pasted-1784250336189-0.png`), vaccine tracker (`SCR-20260716-rnpn.png`), food tracker (`SCR-20260716-rqbo.png`) — renamed to descriptive names (e.g., `hero-daily-log.png`, `log-feeding.png`).
- Lifestyle photos `photorealistic-lifestyle-photography--shot-on-35mm.png` / `-2.png` **compressed** to web-friendly JPEGs (~2000px wide, ~quality 70; target well under 500 KB each) — e.g., via `sips`.
- Chip icons are NOT copied — they reference existing `public/*-256.png` files directly.
- Old demo videos (`*.mp4`) remain in `public/` but are no longer referenced.

## Pricing display updates

- Landing pricing page/teaser/assurance lines: $2.99/month, $19.99 lifetime, 14-day free trial, no card required.
- `src/components/account-manager/PaymentModal.tsx`: displayed plan prices updated $2.00 → $2.99 and $12.00 → $19.99 (labels/features text only). `stripePriceId` wiring and env vars untouched.

## Localization

- Every user-facing landing string wrapped in `t()` with the English text as key, added to `src/localization/translations/en.json` first.
- Run `node scripts/check-missing-translations.js` to propagate keys and sort files.
- Best-effort translation pass fills the new keys in all 10 non-English files: de, es, fr, it, nl, pl, nb, pt-PT, pt-BR, ro.
- Language chips on the features page come from `src/localization/supported-languages.json` (names render as-is, not translated).
- Legal markdown stays English-only.

## Testing (Vitest, `tests/`)

- `landing-stats` helper: fallback on fetch/DB failure, families floor-formatting (0, 9, 10, 74, 105 boundaries), cache expiry behavior.
- Landing data shapes: plans (two plans, correct prices), FAQ (6 entries, non-empty), day story (5 rows), chip lists non-empty.
- Legal content: `public/terms_of_use.md` and `public/privacy_policy.md` exist, non-empty, and contain expected markers (e.g., "Effective Date", "Open Glades LLC").
- Translation integrity: new en.json keys exist in all language files after the check script (or reuse/extend existing translation-consistency test if present).
- UI sections are presentational composition — verified by `npm run build` (which runs ESLint in Next 16) + manual review, matching current repo practice.

## Cleanup / out of scope

- Removed: old `app/home/page.tsx` sections (videos, old pricing, old hero), `app/home/home.css`.
- Out of scope: Stripe checkout wiring for new prices (John, during testing); dark-mode landing variant; translating legal content; deleting old demo videos from `public/`.

## Execution notes

- Work happens on branch `2026-july-5` via subagents; local commits allowed, **no pushes**.
- Implementation plan to be written with the writing-plans skill after spec approval.
