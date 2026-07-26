# SaaS Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SaaS-mode landing page with the "V1 Storybook" multi-page redesign (home, /features, /pricing, /terms, /privacy) per `documentation/superpowers/specs/2026-07-16-saas-landing-redesign-design.md`.

**Architecture:** Shared component library in `src/components/landing/` + one `landing.css` (paper-cream, light-only). `app/home/page.tsx` is rewritten as the home page (the SaaS gate in `app/page.tsx` is untouched). New route group `app/(marketing)/` hosts features/pricing/terms/privacy with a shared layout that redirects non-SaaS deployments to `/`.

**Tech Stack:** Next.js App Router, TypeScript, plain CSS (landing-scoped), `next/font/google` (Literata + Alegreya Sans), Prisma, Vitest, lucide-react icons.

## Global Constraints

- Branch: `2026-july-5`. Commit locally after each task. **NEVER push.**
- Mockup source of truth: `documentation/temp-development-docs/v1-storybook/` (`index.html`, `features.html`, `pricing.html`, `terms.html`, `privacy.html`, `style.css`). All copy comes from these files verbatim.
- Every user-facing string is wrapped in `t()` from `useLocalization` (`@/src/context/localization`). Keys ARE the English text. New keys go in `src/localization/translations/en.json` (Task 12).
- Light-only design: NO `html.dark` overrides in `landing.css`, NO `dark:` Tailwind classes anywhere in landing code, no ThemeToggle in the landing nav.
- Prices: **$2.99/month** and **$19.99 lifetime**. Do NOT touch Stripe price IDs, env vars, or checkout logic.
- All landing CSS classes are prefixed `ld-` and typography rules are scoped under `.landing-root` to avoid colliding with app styles.
- Components stay under ~200 lines. API responses use `{ success, data?, error? }` (`ApiResponse` from `app/api/types`).
- Prisma queries must work on SQLite and PostgreSQL.
- Tests: Vitest, files in top-level `tests/*.test.ts`, node environment, `@/` alias = repo root. Run with `npx vitest run tests/<file>.test.ts` or `npm test`.
- `next lint` doesn't exist (Next 16): ESLint runs via `npm run build`.

---

### Task 1: Landing assets in `public/landing/`

**Files:**
- Create: `public/landing/` (copied/compressed images)

**Interfaces:**
- Produces: image paths used by later tasks: `/landing/butterfly.svg`, `/landing/teddy.svg`, `/landing/kitten.svg`, `/landing/star.svg`, `/landing/rocket.svg`, `/landing/family-porch.jpg`, `/landing/hero-photo.jpg`, `/landing/pricing-photo.jpg`, `/landing/hero-daily-log.png`, `/landing/log-feeding.png`, `/landing/daily-log.png`, `/landing/nursery-mode.png`, `/landing/add-caretaker.png`, `/landing/report-card.png`, `/landing/vaccine-tracker.png`, `/landing/food-tracker.png`

- [ ] **Step 1: Copy and compress assets**

```bash
cd /Users/johnoverton/Development/docker_builds/sprout-track_old
SB=documentation/temp-development-docs/v1-storybook
mkdir -p public/landing
cp $SB/art/butterfly.svg $SB/art/teddy.svg $SB/art/kitten.svg $SB/art/star.svg $SB/art/rocket.svg public/landing/
cp $SB/uploads/pasted-1784247683193-0.png public/landing/hero-daily-log.png
cp $SB/uploads/SCR-20260716-qyxi.png      public/landing/log-feeding.png
cp $SB/uploads/pasted-1784248426816-0.png public/landing/daily-log.png
cp $SB/uploads/SCR-20260716-rvqx.png      public/landing/nursery-mode.png
cp $SB/uploads/pasted-1784250264745-0.png public/landing/add-caretaker.png
cp $SB/uploads/pasted-1784250336189-0.png public/landing/report-card.png
cp $SB/uploads/SCR-20260716-rnpn.png      public/landing/vaccine-tracker.png
cp $SB/uploads/SCR-20260716-rqbo.png      public/landing/food-tracker.png
sips -Z 2000 -s format jpeg -s formatOptions 70 "$SB/uploads/photorealistic-lifestyle-photography--shot-on-35mm.png"   --out public/landing/hero-photo.jpg
sips -Z 2000 -s format jpeg -s formatOptions 70 "$SB/uploads/photorealistic-lifestyle-photography--shot-on-35mm-2.png" --out public/landing/pricing-photo.jpg
sips -Z 2000 -s format jpeg -s formatOptions 80 "$SB/art/family-porch-flipped.png" --out public/landing/family-porch.jpg
```

- [ ] **Step 2: Verify sizes**

Run: `ls -la public/landing/`
Expected: 16 files; `hero-photo.jpg`, `pricing-photo.jpg`, `family-porch.jpg` each **under 600 KB**. If a jpg is over 600 KB, re-run its `sips` with `-s formatOptions 60`.

- [ ] **Step 3: Commit**

```bash
git add public/landing && git commit -m "Add landing page image assets"
```

---

### Task 2: Fonts + `landing.css`

**Files:**
- Create: `src/components/landing/fonts.ts`
- Create: `src/components/landing/landing.css`

**Interfaces:**
- Produces: `literata`, `alegreyaSans` (next/font objects with `.variable`); CSS classes `ld-*` and root wrapper class `landing-root`. Later tasks wrap pages in `<div className={`${literata.variable} ${alegreyaSans.variable} landing-root`}>`.

- [ ] **Step 1: Create `src/components/landing/fonts.ts`**

```ts
import { Literata, Alegreya_Sans } from 'next/font/google';

export const literata = Literata({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  variable: '--font-literata',
});

export const alegreyaSans = Alegreya_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-alegreya',
});
```

- [ ] **Step 2: Create `src/components/landing/landing.css`**

Port `documentation/temp-development-docs/v1-storybook/style.css` with these transformations — the full mapping, applied consistently:

1. Every class gains the `ld-` prefix: `.nav`→`.ld-nav`, `.wrap`→`.ld-wrap`, `.btn`→`.ld-btn`, `.btn.big`→`.ld-btn.ld-big`, `.btn.ghost`→`.ld-btn.ld-ghost`, `.logo`→`.ld-logo`, `.nav-links`→`.ld-nav-links`, `.hero`→`.ld-hero`, `.kick`→`.ld-kick`, `.lede`→`.ld-lede`, `.cta-row`→`.ld-cta-row`, `.assure`→`.ld-assure`, `.proof`→`.ld-proof`, `.frame`→`.ld-frame`, `.frame-bar`→`.ld-frame-bar`, `.hero-shot`→`.ld-hero-shot`, `.sprite`→`.ld-sprite`, `.sect-head`→`.ld-sect-head`, `.alt`→`.ld-alt`, `.day`→`.ld-day`, `.day-row`→`.ld-day-row`, `.day-ic`→`.ld-day-ic`, `.who`→`.ld-who`, `.w-mom/.w-dad/.w-gma/.w-nanny`→`.ld-w-mom/...`, `.feat`→`.ld-feat`, `.feat.flip`→`.ld-feat.ld-flip`, `.fig`→`.ld-fig`, `.shot`→`.ld-shot`, `.plans`→`.ld-plans`, `.plan`→`.ld-plan`, `.plan.hot`→`.ld-plan.ld-hot`, `.tag`→`.ld-tag`, `.price`→`.ld-price`, `.per`→`.ld-per`, `.selfhost`→`.ld-selfhost`, `.faq`→`.ld-faq`, `.close-cta`→`.ld-close-cta`, `footer`→`.ld-footer`, `.chipset`→`.ld-chipset`, `.fchip`→`.ld-fchip`, `.pagehead`→`.ld-pagehead`, `.feathero`→`.ld-feathero`, `.legal`→`.ld-legal`.
2. Element selectors (`body`, `h1,h2,h3`, `a`, `section`, `footer`) are scoped: `body{...}` becomes `.landing-root{...}`, `h1,h2,h3` becomes `.landing-root h1,.landing-root h2,.landing-root h3`, `a{...}` becomes `.landing-root a{...}`, `section` becomes `.landing-root section`, `footer{...}` merges into `.ld-footer`. Do NOT keep `*{box-sizing...}` or `html{scroll-behavior}` (the app already resets); keep `:root` token block but rename to `.landing-root` so tokens don't leak app-wide.
3. Font families: `"Alegreya Sans",Georgia,serif` → `var(--font-alegreya),Georgia,sans-serif`; `"Literata",Georgia,serif` / `"Literata",serif` → `var(--font-literata),Georgia,serif`.
4. Background image URLs: hero `url("../uploads/photorealistic...")` → `url("/landing/hero-photo.jpg")`. Skip the `.app-head/.app-acts/.app-stats/.tl*` block entirely (browser-frame demo UI not used — the hero uses a real screenshot).
5. Append the page-level `<style>` blocks from the mockup's `features.html` (`.chipset`, `.fchip`, `.pagehead`, `.feathero` → porch image `url("/landing/family-porch.jpg")`), `pricing.html` (`.pagehead` variant → create `.ld-pagehead-photo` with `url("/landing/pricing-photo.jpg")`), and `terms.html`/`privacy.html` (`.legal` typography, scoped as `.ld-legal h1` etc.), all with the same prefix/scoping rules.
6. Keep both responsive blocks (`@media(max-width:900px)`, `@media(max-width:620px)`) with prefixed selectors, plus the trailing fixes (`.nav-links a.btn` → `.ld-nav-links a.ld-btn`, `img.day-ic` → `img.ld-day-ic`, `.hero-shot` height rules).
7. Add one new rule for the nav login link:

```css
.ld-nav-login{background:none;border:none;padding:0;cursor:pointer;font-weight:600;font-size:15.5px;color:var(--body);font-family:inherit}
.ld-nav-login:hover{color:var(--teal)}
```

NO `html.dark` selectors anywhere in this file.

- [ ] **Step 3: Verify the CSS parses and the app builds**

Run: `npm run build 2>&1 | tail -20`
Expected: build succeeds (nothing imports the CSS yet; this catches syntax errors early via the css pipeline in later tasks — if build is slow, `npx tsc --noEmit` plus visual inspection is acceptable here).

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/fonts.ts src/components/landing/landing.css
git commit -m "Add landing fonts and paper-cream stylesheet"
```

---

### Task 3: Landing stats helper + API route (TDD)

**Files:**
- Create: `src/utils/landing-stats.ts`
- Create: `app/api/landing-stats/route.ts`
- Test: `tests/landingStats.test.ts`

**Interfaces:**
- Consumes: `prisma` from `app/api/db` (default export), `ApiResponse` from `app/api/types`.
- Produces: `interface LandingStats { families: number; stars: number }`, `LANDING_STATS_FALLBACK: LandingStats`, `formatFamilyCount(count: number): string`, `resolveLandingStats(families: number | null, stars: number | null): LandingStats`, route `GET /api/landing-stats` → `ApiResponse<LandingStats>`.

- [ ] **Step 1: Write the failing test `tests/landingStats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  formatFamilyCount,
  resolveLandingStats,
  LANDING_STATS_FALLBACK,
} from '@/src/utils/landing-stats';

describe('formatFamilyCount', () => {
  it('floors to the nearest 10 with a plus', () => {
    expect(formatFamilyCount(74)).toBe('70+');
    expect(formatFamilyCount(105)).toBe('100+');
    expect(formatFamilyCount(10)).toBe('10+');
  });

  it('shows small counts as-is without a plus', () => {
    expect(formatFamilyCount(0)).toBe('0');
    expect(formatFamilyCount(9)).toBe('9');
  });
});

describe('resolveLandingStats', () => {
  it('uses real values when present', () => {
    expect(resolveLandingStats(84, 400)).toEqual({ families: 84, stars: 400 });
  });

  it('falls back per-field when null', () => {
    expect(resolveLandingStats(null, 400)).toEqual({
      families: LANDING_STATS_FALLBACK.families,
      stars: 400,
    });
    expect(resolveLandingStats(84, null)).toEqual({
      families: 84,
      stars: LANDING_STATS_FALLBACK.stars,
    });
    expect(resolveLandingStats(null, null)).toEqual(LANDING_STATS_FALLBACK);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/landingStats.test.ts`
Expected: FAIL — cannot resolve `@/src/utils/landing-stats`.

- [ ] **Step 3: Create `src/utils/landing-stats.ts`**

```ts
export interface LandingStats {
  families: number;
  stars: number;
}

export const LANDING_STATS_FALLBACK: LandingStats = { families: 70, stars: 322 };

/**
 * Formats a family count for the hero proof line: floored to the nearest 10
 * with a trailing "+" (74 -> "70+"). Counts under 10 render as-is.
 */
export function formatFamilyCount(count: number): string {
  const floored = Math.floor(count / 10) * 10;
  if (floored < 10) return String(count);
  return `${floored}+`;
}

/** Per-field fallback so one failed source doesn't blank the other. */
export function resolveLandingStats(
  families: number | null,
  stars: number | null
): LandingStats {
  return {
    families: families ?? LANDING_STATS_FALLBACK.families,
    stars: stars ?? LANDING_STATS_FALLBACK.stars,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/landingStats.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create `app/api/landing-stats/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '../types';
import prisma from '../db';
import { LandingStats, resolveLandingStats } from '@/src/utils/landing-stats';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cache: { data: LandingStats; fetchedAt: number } | null = null;

/**
 * GET /api/landing-stats — public, no auth.
 * Live proof stats for the landing hero: active family count + GitHub stars.
 * Cached in-process for an hour; falls back to static values on any failure.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<LandingStats>>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, data: cache.data });
  }

  let families: number | null = null;
  let stars: number | null = null;

  try {
    families = await prisma.family.count({ where: { isActive: true } });
  } catch (error) {
    console.error('landing-stats: family count failed', error);
  }

  try {
    const res = await fetch(
      'https://api.github.com/repos/Oak-and-Sprout/sprout-track',
      {
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const repo = await res.json();
      if (typeof repo.stargazers_count === 'number') {
        stars = repo.stargazers_count;
      }
    }
  } catch (error) {
    console.error('landing-stats: GitHub fetch failed', error);
  }

  const data = resolveLandingStats(families, stars);
  cache = { data, fetchedAt: Date.now() };
  return NextResponse.json({ success: true, data });
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: no new errors (pre-existing errors, if any, are unrelated — compare with `git stash && npx tsc --noEmit | head -5 && git stash pop` if unsure).

- [ ] **Step 7: Commit**

```bash
git add src/utils/landing-stats.ts app/api/landing-stats/route.ts tests/landingStats.test.ts
git commit -m "Add landing stats helper and public API route"
```

---

### Task 4: Landing data module (TDD)

**Files:**
- Create: `src/components/landing/landing-data.ts`
- Test: `tests/landingData.test.ts`

**Interfaces:**
- Produces (all strings are ENGLISH copy that render sites pass through `t()`):

```ts
export interface DayStoryRow { icon: string; title: string; who: string; whoClass: 'ld-w-mom' | 'ld-w-dad' | 'ld-w-gma' | 'ld-w-nanny'; note: string; time: string; }
export interface TrackingChip { icon: string; label: string; }
export interface LandingPlan { id: 'monthly' | 'lifetime'; tag: string; name: string; price: string; priceUnit: string; per: string; features: string[]; cta: string; hot: boolean; }
export interface FaqItem { question: string; answer: string; }
export const DAY_STORY_ROWS: DayStoryRow[];   // 5 rows
export const TRACKING_CHIPS: TrackingChip[];  // 15 chips
export const LANDING_PLANS: LandingPlan[];    // 2 plans
export const FAQ_ITEMS: FaqItem[];            // 6 items
export const GITHUB_URL = 'https://github.com/Oak-and-Sprout/sprout-track';
export const DEMO_URL = '/demo';
```

- [ ] **Step 1: Write the failing test `tests/landingData.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  DAY_STORY_ROWS,
  TRACKING_CHIPS,
  LANDING_PLANS,
  FAQ_ITEMS,
} from '@/src/components/landing/landing-data';

describe('landing data', () => {
  it('has 5 day-story rows with icons and caretaker chips', () => {
    expect(DAY_STORY_ROWS).toHaveLength(5);
    for (const row of DAY_STORY_ROWS) {
      expect(row.icon.startsWith('/')).toBe(true);
      expect(row.title.length).toBeGreaterThan(0);
      expect(row.whoClass).toMatch(/^ld-w-(mom|dad|gma|nanny)$/);
    }
  });

  it('has 15 tracking chips pointing at existing public icons', () => {
    expect(TRACKING_CHIPS).toHaveLength(15);
    for (const chip of TRACKING_CHIPS) {
      expect(chip.icon).toMatch(/^\/[\w-]+\.(png|svg)$/);
      expect(chip.label.length).toBeGreaterThan(0);
    }
  });

  it('has the two plans with mockup prices', () => {
    expect(LANDING_PLANS).toHaveLength(2);
    const monthly = LANDING_PLANS.find((p) => p.id === 'monthly');
    const lifetime = LANDING_PLANS.find((p) => p.id === 'lifetime');
    expect(monthly?.price).toBe('$2.99');
    expect(monthly?.hot).toBe(true);
    expect(monthly?.features).toHaveLength(4);
    expect(lifetime?.price).toBe('$19.99');
    expect(lifetime?.features).toHaveLength(4);
  });

  it('has 6 FAQ items with non-empty answers', () => {
    expect(FAQ_ITEMS).toHaveLength(6);
    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/landingData.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/components/landing/landing-data.ts`**

Copy ALL strings verbatim from the mockup (decode HTML entities: `&rsquo;`→’, `&ldquo;/&rdquo;`→“”, `&amp;`→&). Sources: day story = `index.html` lines 62-68; chips = `features.html` line 44; plans = `pricing.html` lines 34-61; FAQ = `pricing.html` lines 71-78.

```ts
export interface DayStoryRow {
  icon: string;
  title: string;
  who: string;
  whoClass: 'ld-w-mom' | 'ld-w-dad' | 'ld-w-gma' | 'ld-w-nanny';
  note: string;
  time: string;
}

export interface TrackingChip {
  icon: string;
  label: string;
}

export interface LandingPlan {
  id: 'monthly' | 'lifetime';
  tag: string;
  name: string;
  price: string;
  priceUnit: string;
  per: string;
  features: string[];
  cta: string;
  hot: boolean;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const GITHUB_URL = 'https://github.com/Oak-and-Sprout/sprout-track';
export const DEMO_URL = '/demo';

export const DAY_STORY_ROWS: DayStoryRow[] = [
  { icon: '/bottle-256.png', title: 'Bottle, 5.5 oz', who: 'Tom', whoClass: 'ld-w-dad', note: 'Logged before the coffee finished brewing.', time: '6:05 am' },
  { icon: '/crib-256.png', title: 'Nap started', who: 'Priya', whoClass: 'ld-w-nanny', note: 'Betty watches the sleep timer tick from her desk at work.', time: '9:40 am' },
  { icon: '/diaper-256.png', title: 'Wet diaper', who: 'Grandma', whoClass: 'ld-w-gma', note: 'Zero “did anyone change him?” texts sent today.', time: '12:15 pm' },
  { icon: '/food-256.png', title: 'First avocado', who: 'Betty', whoClass: 'ld-w-mom', note: 'Marked as a milestone, photo attached for the grandparents.', time: '3:30 pm' },
  { icon: '/bath-256.png', title: 'Bath and bedtime', who: 'Tom', whoClass: 'ld-w-dad', note: 'Tomorrow morning, whoever wakes up first picks up right here.', time: '7:55 pm' },
];

export const TRACKING_CHIPS: TrackingChip[] = [
  { icon: '/crib-256.png', label: 'Sleep & naps' },
  { icon: '/bottle-256.png', label: 'Bottle feeds' },
  { icon: '/breastfeed-128.png', label: 'Breastfeeding' },
  { icon: '/food-256.png', label: 'Solid foods' },
  { icon: '/diaper-256.png', label: 'Diapers' },
  { icon: '/pump-256.png', label: 'Pumping' },
  { icon: '/med-256.png', label: 'Medicine & vitamins' },
  { icon: '/bath-256.png', label: 'Baths' },
  { icon: '/milestone-256.png', label: 'Milestones' },
  { icon: '/measurement-256.png', label: 'Measurements' },
  { icon: '/vaccine-256.png', label: 'Vaccines' },
  { icon: '/activity-256.png', label: 'Activities & tummy time' },
  { icon: '/note-256.png', label: 'Notes' },
  { icon: '/photo-192.png', label: 'Photos' },
  { icon: '/breastfeed-128.png', label: 'Breast milk storage' },
];

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: 'monthly',
    tag: 'Most popular',
    name: 'Hosted Monthly',
    price: '$2.99',
    priceUnit: '/month',
    per: 'after a 14-day free trial',
    features: [
      'Every feature, nothing gated',
      'Unlimited caretakers and babies',
      'Hosting, backups, and updates handled',
      'Cancel anytime, export everything',
    ],
    cta: 'Start my free trial',
    hot: true,
  },
  {
    id: 'lifetime',
    tag: 'Best value',
    name: 'Lifetime',
    price: '$19.99',
    priceUnit: 'once',
    per: 'pays for itself in 7 months',
    features: [
      'Everything in Hosted Monthly',
      'One payment, yours for good',
      'Covers future babies too',
      'All updates included',
    ],
    cta: 'Get lifetime access',
    hot: false,
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What happens when the trial ends?',
    answer: 'You’ll get a heads-up before day 14. If you don’t subscribe, your account pauses; nothing is deleted, and you can export your data or pick a plan whenever you’re ready.',
  },
  {
    question: 'Do grandparents and nannies cost extra?',
    answer: 'No. One plan covers your whole family: unlimited caretakers and unlimited babies, always.',
  },
  {
    question: 'Can I take my data with me?',
    answer: 'Yes, always. Export your full history anytime. And because Sprout Track is open source, you can move from our hosting to your own server and keep everything.',
  },
  {
    question: 'What does Lifetime actually include?',
    answer: 'Everything, forever: hosting, all features, and all future updates, for one $19.99 payment. If you track more than seven months, it’s the cheaper option.',
  },
  {
    question: 'How is the hosted version different from self-hosting?',
    answer: 'The software is identical. With hosting we run the server, keep backups, and apply updates, so it just works from any device. Self-hosting is the same app on your own machine, free.',
  },
  {
    question: 'Is my baby’s data private?',
    answer: 'Yes. No ads, no trackers, no selling data. The code is public on GitHub, so you don’t have to take our word for it.',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/landingData.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/landing/landing-data.ts tests/landingData.test.ts
git commit -m "Add landing content data module"
```

---

### Task 5: LandingNav + LandingFooter

**Files:**
- Create: `src/components/landing/LandingNav.tsx`
- Create: `src/components/landing/LandingFooter.tsx`

**Interfaces:**
- Consumes: `AccountButton` (`@/src/components/ui/account-button` — check `account-button.types.ts` for the exact `onOpenAccountModal` mode union and match it), `LanguageSelector` (`@/src/components/ui/side-nav/language-selector`, no props), `GITHUB_URL`/`DEMO_URL` from `./landing-data`.
- Produces: `LandingNav({ onOpenAccountModal, onAccountManagerOpen })`, `LandingFooter()` — used by the marketing layout (Task 8) and home page (Task 9).

- [ ] **Step 1: Create `src/components/landing/LandingNav.tsx`**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { AccountButton } from '@/src/components/ui/account-button';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL } from './landing-data';

export type LandingModalMode = 'login' | 'register' | 'verify' | 'reset-password';

interface LandingNavProps {
  onOpenAccountModal: (mode: LandingModalMode) => void;
  onAccountManagerOpen: () => void;
}

/**
 * Sticky landing nav: logo, Features, Pricing, GitHub, quiet "Log in" link,
 * and the teal trial button. Logged-in users get the AccountButton dropdown
 * (the trial button hides itself via hideWhenLoggedIn).
 */
export function LandingNav({ onOpenAccountModal, onAccountManagerOpen }: LandingNavProps) {
  const { t } = useLocalization();

  return (
    <header className="ld-nav">
      <div className="ld-wrap">
        <Link className="ld-logo" href="/">
          <img src="/sprout-256.png" alt="" width={26} height={26} style={{ borderRadius: '50%' }} />
          <span>{t('Sprout Track')}</span>
        </Link>
        <nav className="ld-nav-links">
          <Link href="/features">{t('Features')}</Link>
          <Link href="/pricing">{t('Pricing')}</Link>
          <a href={GITHUB_URL} rel="noopener">GitHub</a>
          <AccountButton
            label={t('Log in')}
            showIcon={false}
            variant="link"
            initialMode="login"
            className="ld-nav-login"
            onOpenAccountModal={onOpenAccountModal}
            onAccountManagerOpen={onAccountManagerOpen}
          />
          <AccountButton
            label={t('Start my free trial')}
            showIcon={false}
            initialMode="register"
            className="ld-btn"
            hideWhenLoggedIn={true}
            onOpenAccountModal={onOpenAccountModal}
          />
        </nav>
      </div>
    </header>
  );
}
```

NOTE for implementer: mirror the prop pattern from the old nav (view with `git show HEAD~1:app/home/page.tsx`, lines 234-255) — the login AccountButton doubles as the logged-in dropdown (it takes `onAccountManagerOpen`); the register one hides when logged in. If `AccountButton`'s `variant` union lacks a value used here, or its default button styling fights `.ld-btn`, adjust `className`/`variant` until the rendered element matches the mockup button; do not modify `account-button` itself.

- [ ] **Step 2: Create `src/components/landing/LandingFooter.tsx`**

```tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { LanguageSelector } from '@/src/components/ui/side-nav/language-selector';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL, DEMO_URL } from './landing-data';

/** Landing footer: page links, language selector, Open Glades copyright. */
export function LandingFooter() {
  const { t } = useLocalization();

  return (
    <footer className="ld-footer">
      <div className="ld-wrap">
        <Link className="ld-logo" href="/" style={{ fontSize: 17 }}>
          <img src="/sprout-256.png" alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
          <span>{t('Sprout Track')}</span>
        </Link>
        <nav>
          <Link href="/features">{t('Features')}</Link>
          <Link href="/pricing">{t('Pricing')}</Link>
          <a href={DEMO_URL} rel="noopener">{t('Demo')}</a>
          <a href={GITHUB_URL} rel="noopener">GitHub</a>
          <Link href="/terms">{t('Terms')}</Link>
          <Link href="/privacy">{t('Privacy')}</Link>
        </nav>
        <div className="ld-footer-meta">
          <LanguageSelector />
          <span>
            © 2025–2026{' '}
            <a href="https://www.openglades.com" rel="noopener">Open Glades LLC</a>
            {' '}· Kansas City
          </span>
        </div>
      </div>
    </footer>
  );
}
```

Add to `landing.css` (footer-meta wasn't in the mockup because the mockup had no language selector):

```css
.ld-footer-meta{display:flex;align-items:center;gap:14px;flex-shrink:0}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/landing/LandingNav.tsx src/components/landing/LandingFooter.tsx src/components/landing/landing.css
git commit -m "Add landing nav and footer components"
```

---

### Task 6: Section components — FeatureRow, FeatureChips, PageHead, CloseCta, DayStory

**Files:**
- Create: `src/components/landing/FeatureRow.tsx`
- Create: `src/components/landing/FeatureChips.tsx`
- Create: `src/components/landing/PageHead.tsx`
- Create: `src/components/landing/CloseCta.tsx`
- Create: `src/components/landing/DayStory.tsx`

**Interfaces:**
- Consumes: `DAY_STORY_ROWS` from `./landing-data`; `Check` from `lucide-react`; `cn` from `@/src/lib/utils`.
- Produces (all text props receive ALREADY-TRANSLATED strings; components do not call `t()` except `DayStory`, which owns its data):

```ts
FeatureRow({ title, paragraph, items?, figure, flip? }: { title: string; paragraph: string; items?: string[]; figure: React.ReactNode; flip?: boolean })
FeatureChips({ chips, center? }: { chips: { icon?: string; label: string }[]; center?: boolean })
PageHead({ kick, title, lede, photoClass }: { kick: string; title: string; lede: string; photoClass?: string })
CloseCta({ heading, sub?, assure?, ctaLabel, onCtaClick, sprite? }: { heading: string; sub?: string; assure?: string; ctaLabel: string; onCtaClick: () => void; sprite?: React.ReactNode })
DayStory()  // renders DAY_STORY_ROWS via t()
```

- [ ] **Step 1: Create `src/components/landing/FeatureRow.tsx`**

```tsx
'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';

interface FeatureRowProps {
  title: string;
  paragraph: string;
  items?: string[];
  figure: React.ReactNode;
  flip?: boolean;
}

/** Split feature row: text + checklist on one side, figure on the other. */
export function FeatureRow({ title, paragraph, items = [], figure, flip = false }: FeatureRowProps) {
  return (
    <div className={cn('ld-feat', flip && 'ld-flip')}>
      <div>
        <h3>{title}</h3>
        <p>{paragraph}</p>
        {items.length > 0 && (
          <ul>
            {items.map((item) => (
              <li key={item}>
                <Check size={18} strokeWidth={2} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="ld-fig">{figure}</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/landing/FeatureChips.tsx`**

```tsx
'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface FeatureChipsProps {
  chips: { icon?: string; label: string }[];
  center?: boolean;
}

/** Rounded chip grid (tracking types, languages). Labels arrive pre-translated. */
export function FeatureChips({ chips, center = false }: FeatureChipsProps) {
  return (
    <div className={cn('ld-chipset', center && 'ld-chipset-center')}>
      {chips.map((chip) => (
        <span className="ld-fchip" key={chip.label}>
          {chip.icon && (
            <img src={chip.icon} alt="" width={22} height={22} style={{ borderRadius: '50%' }} />
          )}
          {chip.label}
        </span>
      ))}
    </div>
  );
}
```

Add to `landing.css`: `.ld-chipset-center{justify-content:center}`

- [ ] **Step 3: Create `src/components/landing/PageHead.tsx`**

```tsx
'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface PageHeadProps {
  kick: string;
  title: string;
  lede: string;
  photoClass?: string; // e.g. 'ld-pagehead-photo' (pricing) — features wraps in .ld-feathero instead
  centered?: boolean;
}

/** Interior page header band with optional lifestyle-photo background. */
export function PageHead({ kick, title, lede, photoClass, centered = false }: PageHeadProps) {
  return (
    <section className={cn('ld-pagehead', photoClass, centered && 'ld-pagehead-center')}>
      <div className="ld-wrap">
        <span className="ld-kick">{kick}</span>
        <h1>{title}</h1>
        <p>{lede}</p>
      </div>
    </section>
  );
}
```

Add to `landing.css`: `.ld-pagehead-center{text-align:center}` and ensure `.ld-pagehead-center p{margin:0 auto}` (pricing head is centered; features head is left-aligned per mockup).

- [ ] **Step 4: Create `src/components/landing/CloseCta.tsx`**

```tsx
'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';

interface CloseCtaProps {
  heading: string;
  sub?: string;
  assure?: string;
  ctaLabel: string;
  onCtaClick: () => void;
  sprite?: React.ReactNode;
  alt?: boolean;
}

/** Closing CTA band: heading, optional sub-line, trial button, assurance line. */
export function CloseCta({ heading, sub, assure, ctaLabel, onCtaClick, sprite, alt = false }: CloseCtaProps) {
  return (
    <section className={cn('ld-close-cta', alt && 'ld-alt')}>
      <div className="ld-wrap">
        {sprite}
        <h2>{heading}</h2>
        {sub && <p>{sub}</p>}
        <div className="ld-cta-row">
          <button type="button" className="ld-btn ld-big" onClick={onCtaClick}>
            {ctaLabel}
          </button>
        </div>
        {assure && <p className="ld-assure">{assure}</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create `src/components/landing/DayStory.tsx`**

```tsx
'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { DAY_STORY_ROWS } from './landing-data';

/** "One Tuesday, tracked together" — the day timeline from the mockup. */
export function DayStory() {
  const { t } = useLocalization();

  return (
    <div className="ld-day">
      {DAY_STORY_ROWS.map((row) => (
        <div className="ld-day-row" key={row.title}>
          <img className="ld-day-ic" src={row.icon} alt="" width={40} height={40} />
          <span className="ld-t">
            <b>{t(row.title)}</b>
            <span className={`ld-who ${row.whoClass}`}>{t(row.who)}</span>
            <p>{t(row.note)}</p>
          </span>
          <time>{t(row.time)}</time>
        </div>
      ))}
    </div>
  );
}
```

NOTE: the mockup's `.day-row .t` selector becomes `.ld-day-row .ld-t` in landing.css — verify Task 2 renamed the bare `.t` inner selectors (`.day-row .t b`, `.day-row .t p`) accordingly; fix them now if missed.

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | head -5` — no new errors.

```bash
git add src/components/landing/FeatureRow.tsx src/components/landing/FeatureChips.tsx src/components/landing/PageHead.tsx src/components/landing/CloseCta.tsx src/components/landing/DayStory.tsx src/components/landing/landing.css
git commit -m "Add landing section components"
```

---

### Task 7: Pricing components + LegalPage + markdown util

**Files:**
- Create: `src/components/landing/PlanCard.tsx`
- Create: `src/components/landing/SelfHostCallout.tsx`
- Create: `src/components/landing/FaqAccordion.tsx`
- Create: `src/utils/landing-markdown.tsx`
- Create: `src/components/landing/LegalPage.tsx`

**Interfaces:**
- Consumes: `LandingPlan`, `FaqItem`, `GITHUB_URL` from `./landing-data`; `Check` from `lucide-react`.
- Produces:

```ts
PlanCard({ plan, onSelect }: { plan: LandingPlan; onSelect: () => void })   // calls t() on plan strings
SelfHostCallout()
FaqAccordion({ items }: { items: FaqItem[] })                               // calls t() on q/a
renderMarkdown(content: string): React.ReactNode                            // from landing-markdown
LegalPage({ file }: { file: string })                                       // fetches public md, renders
```

- [ ] **Step 1: Create `src/components/landing/PlanCard.tsx`**

```tsx
'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { LandingPlan } from './landing-data';

interface PlanCardProps {
  plan: LandingPlan;
  onSelect: () => void;
}

/** Pricing card. Prices ($2.99 / $19.99) render as-is; labels localize. */
export function PlanCard({ plan, onSelect }: PlanCardProps) {
  const { t } = useLocalization();

  return (
    <div className={cn('ld-plan', plan.hot && 'ld-hot')}>
      <span className="ld-tag">{t(plan.tag)}</span>
      <h3>{t(plan.name)}</h3>
      <div className="ld-price">
        {plan.price}
        <small> {t(plan.priceUnit)}</small>
      </div>
      <p className="ld-per">{t(plan.per)}</p>
      <ul>
        {plan.features.map((feature) => (
          <li key={feature}>
            <Check size={18} strokeWidth={2} aria-hidden="true" />
            {t(feature)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={cn('ld-btn', 'ld-big', !plan.hot && 'ld-ghost')}
        onClick={onSelect}
      >
        {t(plan.cta)}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/landing/SelfHostCallout.tsx`**

```tsx
'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { GITHUB_URL } from './landing-data';

/** Dashed "Self-host, free forever" box under the plan cards. */
export function SelfHostCallout() {
  const { t } = useLocalization();

  return (
    <div className="ld-selfhost">
      <b>{t('Self-host, free forever')}</b>
      <p>{t('Sprout Track is open source. Run it on your own server with Docker and pay nothing, ever. Same features, your hardware, your backups.')}</p>
      <a className="ld-btn ld-ghost" href={GITHUB_URL} rel="noopener">{t('Get the code')}</a>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/landing/FaqAccordion.tsx`**

```tsx
'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { FaqItem } from './landing-data';

/** <details>-based FAQ list ("Fair questions"). */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const { t } = useLocalization();

  return (
    <div className="ld-faq">
      {items.map((item) => (
        <details key={item.question}>
          <summary>{t(item.question)}</summary>
          <p>{t(item.answer)}</p>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/utils/landing-markdown.tsx`**

Extract the markdown rendering from `src/components/modals/terms-of-use/index.tsx` (lines 56-231): copy `formatTextContent` and the body of `formatMarkdown` into a standalone module exporting one function. Changes from the modal version: no `loading` branch, no `dark:` classes (strip `dark:bg-gray-400`, `dark:border-gray-600`, `dark:text-teal-400` — landing is light-only), everything else identical. Signature:

```tsx
import React from 'react';

/** Renders the limited markdown dialect used by public/*.md legal files. */
export function renderMarkdown(content: string): React.ReactNode {
  // formatTextContent + line loop copied from terms-of-use modal, verbatim
  // except: no loading branch, dark: classes stripped.
}
```

Do NOT modify the existing modals — they keep their inline copy (noted as future cleanup).

- [ ] **Step 5: Create `src/components/landing/LegalPage.tsx`**

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';
import { renderMarkdown } from '@/src/utils/landing-markdown';

interface LegalPageProps {
  file: string; // e.g. '/terms_of_use.md'
}

/** Fetches a legal markdown file from public/ and renders it page-styled. */
export function LegalPage({ file }: LegalPageProps) {
  const { t } = useLocalization();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(file)
      .then((response) => {
        if (!response.ok) throw new Error('Failed to fetch legal content');
        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          setContent(text);
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('Error fetching legal content:', error);
        if (!cancelled) {
          setContent(t('Failed to load content.'));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file, t]);

  return (
    <main className="ld-legal">
      {loading ? <p>{t('Loading...')}</p> : renderMarkdown(content)}
    </main>
  );
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | head -5` — no new errors.

```bash
git add src/components/landing/PlanCard.tsx src/components/landing/SelfHostCallout.tsx src/components/landing/FaqAccordion.tsx src/utils/landing-markdown.tsx src/components/landing/LegalPage.tsx
git commit -m "Add plan card, FAQ, self-host callout, and legal page components"
```

---

### Task 8: Marketing route group — layout + features/pricing/terms/privacy pages

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(marketing)/features/page.tsx`
- Create: `app/(marketing)/pricing/page.tsx`
- Create: `app/(marketing)/terms/page.tsx`
- Create: `app/(marketing)/privacy/page.tsx`
- Create: `src/components/landing/landing-context.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2-7; `LocalizationProvider` (`@/src/context/localization`), `ThemeProvider` (`@/src/context/theme`), `AccountModal` (`@/src/components/modals/AccountModal`), `AccountManager` (`@/src/components/account-manager`).
- Produces: routes `/features`, `/pricing`, `/terms`, `/privacy`; `useLandingActions(): { openAccountModal: (mode: LandingModalMode) => void }`.

- [ ] **Step 1: Create `src/components/landing/landing-context.tsx`**

```tsx
'use client';

import React, { createContext, useContext } from 'react';
import { LandingModalMode } from './LandingNav';

interface LandingActions {
  openAccountModal: (mode: LandingModalMode) => void;
}

const LandingActionsContext = createContext<LandingActions>({
  openAccountModal: () => {},
});

export const LandingActionsProvider = LandingActionsContext.Provider;

/** Lets marketing pages open the layout-owned AccountModal (trial CTAs). */
export function useLandingActions(): LandingActions {
  return useContext(LandingActionsContext);
}
```

- [ ] **Step 2: Create `app/(marketing)/layout.tsx`**

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LocalizationProvider } from '@/src/context/localization';
import { ThemeProvider } from '@/src/context/theme';
import AccountModal from '@/src/components/modals/AccountModal';
import AccountManager from '@/src/components/account-manager';
import { LandingNav, LandingModalMode } from '@/src/components/landing/LandingNav';
import { LandingFooter } from '@/src/components/landing/LandingFooter';
import { LandingActionsProvider } from '@/src/components/landing/landing-context';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/landing/landing.css';

/**
 * Shared chrome for the SaaS marketing pages (/features, /pricing, /terms,
 * /privacy). Self-hosted deployments are redirected to '/'.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isSaas, setIsSaas] = useState<boolean | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<LandingModalMode>('register');
  const [showAccountManager, setShowAccountManager] = useState(false);

  useEffect(() => {
    fetch('/api/deployment-config')
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data?.deploymentMode === 'saas') {
          setIsSaas(true);
        } else {
          setIsSaas(false);
          router.replace('/');
        }
      })
      .catch(() => {
        setIsSaas(false);
        router.replace('/');
      });
  }, [router]);

  const openAccountModal = (mode: LandingModalMode) => {
    setAccountModalMode(mode);
    setShowAccountModal(true);
  };

  if (!isSaas) return null;

  return (
    <LocalizationProvider>
      <ThemeProvider>
        <LandingActionsProvider value={{ openAccountModal }}>
          <div className={`${literata.variable} ${alegreyaSans.variable} landing-root`}>
            <LandingNav
              onOpenAccountModal={openAccountModal}
              onAccountManagerOpen={() => setShowAccountManager(true)}
            />
            {children}
            <LandingFooter />
            <AccountModal
              open={showAccountModal}
              onClose={() => setShowAccountModal(false)}
              initialMode={accountModalMode}
            />
            <AccountManager
              isOpen={showAccountManager}
              onClose={() => setShowAccountManager(false)}
            />
          </div>
        </LandingActionsProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}
```

- [ ] **Step 3: Create `app/(marketing)/pricing/page.tsx`**

All copy verbatim from `pricing.html` (decode entities). Structure:

```tsx
'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { PageHead } from '@/src/components/landing/PageHead';
import { PlanCard } from '@/src/components/landing/PlanCard';
import { SelfHostCallout } from '@/src/components/landing/SelfHostCallout';
import { FaqAccordion } from '@/src/components/landing/FaqAccordion';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { useLandingActions } from '@/src/components/landing/landing-context';
import { LANDING_PLANS, FAQ_ITEMS } from '@/src/components/landing/landing-data';

export default function PricingPage() {
  const { t } = useLocalization();
  const { openAccountModal } = useLandingActions();

  return (
    <>
      <PageHead
        kick={t('Pricing')}
        title={t('Cheaper than one canister of formula.')}
        lede={t('Every plan includes every feature, unlimited caretakers, and unlimited babies. Pick how you’d like to pay, or don’t pay at all and host it yourself.')}
        photoClass="ld-pagehead-photo"
        centered
      />
      <section id="plans">
        <div className="ld-wrap">
          <div className="ld-plans">
            {LANDING_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onSelect={() => openAccountModal('register')} />
            ))}
          </div>
          <SelfHostCallout />
        </div>
      </section>
      <section className="ld-alt">
        <div className="ld-wrap">
          <div className="ld-sect-head ld-sect-head-center">
            <h2>{t('Fair questions')}</h2>
          </div>
          <FaqAccordion items={FAQ_ITEMS} />
        </div>
      </section>
      <CloseCta
        heading={t('Try it free for 14 days.')}
        sub={t('No card required. Set up takes about two minutes.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
      />
    </>
  );
}
```

Add to `landing.css`: `.ld-sect-head-center{text-align:center;margin-left:auto;margin-right:auto}`

- [ ] **Step 4: Create `app/(marketing)/features/page.tsx`**

Compose per `features.html` (all copy verbatim, entities decoded). Structure — feature rows use `FeatureRow` with translated strings; the language chips come from `supported-languages.json`:

```tsx
'use client';

import React from 'react';
import { useLocalization } from '@/src/context/localization';
import { PageHead } from '@/src/components/landing/PageHead';
import { FeatureRow } from '@/src/components/landing/FeatureRow';
import { FeatureChips } from '@/src/components/landing/FeatureChips';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { useLandingActions } from '@/src/components/landing/landing-context';
import { TRACKING_CHIPS, GITHUB_URL } from '@/src/components/landing/landing-data';
import { supportedLanguages } from '@/src/localization/supported-languages-config';
import Link from 'next/link';

export default function FeaturesPage() {
  const { t } = useLocalization();
  const { openAccountModal } = useLandingActions();

  return (
    <>
      <div className="ld-feathero">
        <PageHead
          kick={t('Features')}
          title={t('Everything a newborn throws at you, one place to write it down.')}
          lede={t('Sixteen kinds of entries, shared with everyone who helps, readable at a glance when the pediatrician asks.')}
        />
        <section style={{ paddingBottom: 56 }}>
          <div className="ld-wrap">
            <div className="ld-sect-head">
              <h2>{t('Track all of it')}</h2>
              <p>{t('Every entry takes a couple of taps, remembers your last amounts, and records who logged it.')}</p>
            </div>
            <FeatureChips
              chips={TRACKING_CHIPS.map((chip) => ({ icon: chip.icon, label: t(chip.label) }))}
            />
          </div>
        </section>
      </div>
      <section className="ld-alt">
        <div className="ld-wrap">
          <FeatureRow
            title={t('A care team, not an account')}
            paragraph={t('One family, many hands. Invite the other parent, grandparents, and the nanny with a link and a PIN. Everyone logs into the same timeline, and every entry is signed with who did it.')}
            items={[
              t('Unlimited caretakers, no per-seat pricing'),
              t('Multiple babies per family, switch in one tap'),
              t('Simple PIN login that works for grandparents'),
            ]}
            figure={<img className="ld-shot" src="/landing/add-caretaker.png" alt={t('Add New Caretaker form with name, role, and security PIN')} />}
          />
          <FeatureRow
            flip
            title={t('In grandma’s language too')}
            paragraph={t('Sprout Track speaks eleven languages, and every caretaker picks their own. Mom logs in English, oma logs in Deutsch. Same timeline, same entries.')}
            figure={<FeatureChips center chips={supportedLanguages.map((lang) => ({ label: lang.name }))} />}
          />
          <FeatureRow
            title={t('Answers for the pediatrician')}
            paragraph={t('Daily summaries roll up awake time, sleep, ounces, and diapers. Calendar and report views show the week’s pattern, and a heatmap makes the sleep regression visible before you feel it.')}
            items={[
              t('Full log with filters, search, and date ranges'),
              t('Growth measurements over time'),
            ]}
            figure={<img className="ld-shot" src="/landing/report-card.png" alt={t('Monthly report card with growth percentiles and weight-for-age chart')} />}
          />
          <FeatureRow
            flip
            title={t('Vaccines, with the paperwork attached')}
            paragraph={t('Record each dose with the provider, add notes, and attach the clinic’s PDF or a photo of the card. The whole history lives next to the rest of the log, not in a drawer at home.')}
            items={[
              t('Dose numbers and healthcare provider contacts'),
              t('Images and PDFs stored with each record'),
            ]}
            figure={<img src="/landing/vaccine-tracker.png" alt={t('Vaccine Tracker on a phone showing vaccine history with doses')} style={{ maxWidth: 340, margin: '0 auto', display: 'block' }} />}
          />
          <FeatureRow
            title={t('Solid foods, without the guesswork')}
            paragraph={t('Log every new food with how it went, and flag reactions the moment you see them. The first 100 foods tracker turns starting solids into a checklist you can actually finish, and a record your pediatrician will love.')}
            items={[
              t('First 100 foods checklist with progress'),
              t('Allergy and reaction notes on every food'),
            ]}
            figure={<img src="/landing/food-tracker.png" alt={t('Food Tracker on a phone logging peanut butter with allergen flag and reaction notes')} style={{ maxWidth: 340, margin: '0 auto', display: 'block' }} />}
          />
        </div>
      </section>
      <section>
        <div className="ld-wrap" style={{ maxWidth: 880 }}>
          <div className="ld-sect-head">
            <h2>{t('Open source, top to bottom')}</h2>
            <p>{t('The same code that runs sprout-track.com is on GitHub. Host it yourself for free, or let us run it for $2.99 a month. Either way the data is yours: export it anytime.')}</p>
          </div>
          <div className="ld-cta-row">
            <Link className="ld-btn" href="/pricing">{t('See pricing')}</Link>
            <a className="ld-btn ld-ghost" href={GITHUB_URL} rel="noopener">{t('View on GitHub')}</a>
          </div>
        </div>
      </section>
      <CloseCta
        alt
        heading={t('Two minutes to set up. Free for 14 days.')}
        assure={t('No card required. Then $2.99/month, cancel anytime.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
      />
    </>
  );
}
```

(The "322 stars" phrase from the mockup's open-source section is intentionally dropped here — the live star count only appears in the home hero.)

- [ ] **Step 5: Create `app/(marketing)/terms/page.tsx` and `app/(marketing)/privacy/page.tsx`**

```tsx
'use client';

import React from 'react';
import { LegalPage } from '@/src/components/landing/LegalPage';

export default function TermsPage() {
  return <LegalPage file="/terms_of_use.md" />;
}
```

```tsx
'use client';

import React from 'react';
import { LegalPage } from '@/src/components/landing/LegalPage';

export default function PrivacyPage() {
  return <LegalPage file="/privacy_policy.md" />;
}
```

- [ ] **Step 6: Typecheck and build**

Run: `npx tsc --noEmit 2>&1 | head -5` then `npm run build 2>&1 | tail -15`
Expected: build succeeds, routes `/features`, `/pricing`, `/terms`, `/privacy` appear in the route list.

- [ ] **Step 7: Commit**

```bash
git add "app/(marketing)" src/components/landing/landing-context.tsx src/components/landing/landing.css
git commit -m "Add marketing route group with features, pricing, terms, privacy pages"
```

---

### Task 9: Rewrite the home page

**Files:**
- Create: `src/components/landing/LandingHero.tsx`
- Modify: `app/home/page.tsx` (full rewrite)
- Delete: `app/home/home.css`

**Interfaces:**
- Consumes: all landing components; `formatFamilyCount`, `LandingStats`, `LANDING_STATS_FALLBACK` from `@/src/utils/landing-stats`; existing modals. `app/home/layout.tsx` and `app/page.tsx` are NOT modified.
- Produces: default export `home` component (keep the same export name/style so `app/page.tsx`'s `import ComingSoon from './home/page'` keeps working — verify the exact import name in `app/page.tsx` lines 159-165 before renaming anything).

- [ ] **Step 1: Create `src/components/landing/LandingHero.tsx`**

Copy verbatim from `index.html` lines 34-54 (entities decoded). Stats fetch lives here:

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLocalization } from '@/src/context/localization';
import {
  LandingStats,
  LANDING_STATS_FALLBACK,
  formatFamilyCount,
} from '@/src/utils/landing-stats';
import { DEMO_URL } from './landing-data';

interface LandingHeroProps {
  onTrialClick: () => void;
}

/** Home hero: headline, CTAs, live proof stats, browser-frame screenshot. */
export function LandingHero({ onTrialClick }: LandingHeroProps) {
  const { t } = useLocalization();
  const [stats, setStats] = useState<LandingStats>(LANDING_STATS_FALLBACK);

  useEffect(() => {
    fetch('/api/landing-stats')
      .then((response) => response.json())
      .then((result) => {
        if (result.success && result.data) setStats(result.data);
      })
      .catch(() => {
        /* fallback stays */
      });
  }, []);

  return (
    <section className="ld-hero">
      <div className="ld-wrap">
        <div>
          <span className="ld-kick">{t('The shareable baby tracker')}</span>
          <h1>
            {t('Everyone who loves your baby,')} <em>{t('on the same page.')}</em>
          </h1>
          <p className="ld-lede">
            {t('Sprout Track keeps parents, grandparents, and caretakers logging feeds, naps, and diapers in one shared place. The afternoon handoff stops needing a sticky note.')}
          </p>
          <div className="ld-cta-row" id="trial">
            <button type="button" className="ld-btn ld-big" onClick={onTrialClick}>
              {t('Start my free trial')}
            </button>
            <a
              className="ld-btn ld-big ld-ghost"
              href={DEMO_URL}
              rel="noopener"
              style={{ flexDirection: 'column', gap: 2, lineHeight: 1.25 }}
            >
              <span>{t('Poke around the live demo')}</span>
              <span className="ld-assure" style={{ margin: 0, fontSize: 13, fontWeight: 400 }}>
                {t('ID: 01 · PIN: 111111')}
              </span>
            </a>
          </div>
          <p className="ld-assure">{t('14 days free, no card required. Then $2.99/month, cancel anytime.')}</p>
          <p className="ld-proof">
            <b>{formatFamilyCount(stats.families)} {t('families')}</b> {t('track with Sprout Track')}
            <span className="ld-dot"></span>
            {t('open source,')} <b>{stats.stars} {t('stars')}</b> {t('on GitHub')}
          </p>
        </div>
        <div style={{ position: 'relative' }}>
          <img className="ld-sprite" src="/landing/butterfly.svg" alt="" width={74} style={{ top: -46, right: -8, transform: 'rotate(8deg)' }} />
          <div className="ld-frame">
            <div className="ld-frame-bar">
              <i></i><i></i><i></i>
              <span>sprout-track.com</span>
            </div>
            <img
              className="ld-hero-shot"
              src="/landing/hero-daily-log.png"
              alt={t('Sprout Track log entry: daily summary and timeline')}
            />
          </div>
          <img className="ld-sprite" src="/landing/teddy.svg" alt="" width={120} style={{ bottom: -38, left: -52, transform: 'rotate(-6deg)' }} />
        </div>
      </div>
    </section>
  );
}
```

Ensure `landing.css` has `.ld-proof .ld-dot` (renamed from `.proof .dot`).

- [ ] **Step 2: Rewrite `app/home/page.tsx`**

Keep: the `'use client'` directive, the default export name `home` (verify against the import in `app/page.tsx` before changing anything), all account-modal state, and the entire hash/query-param `useEffect` — its exact code is inlined in the skeleton below.

Remove: `import './home.css'`, ThemeToggle, useTheme, video state/effects, form/email state, the animated-activities effect, and the PrivacyPolicyModal/TermsOfUseModal state + renders (the footer links to `/terms` and `/privacy` routes now). Final modal set: AccountModal + AccountManager only.

New body (sections verbatim from `index.html`; entities decoded):

```tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import AccountModal from '@/src/components/modals/AccountModal';
import AccountManager from '@/src/components/account-manager';
import { useLocalization } from '@/src/context/localization';
import { LandingNav, LandingModalMode } from '@/src/components/landing/LandingNav';
import { LandingFooter } from '@/src/components/landing/LandingFooter';
import { LandingHero } from '@/src/components/landing/LandingHero';
import { DayStory } from '@/src/components/landing/DayStory';
import { FeatureRow } from '@/src/components/landing/FeatureRow';
import { CloseCta } from '@/src/components/landing/CloseCta';
import { GITHUB_URL } from '@/src/components/landing/landing-data';
import { literata, alegreyaSans } from '@/src/components/landing/fonts';
import '@/src/components/landing/landing.css';

const home = () => {
  const { t } = useLocalization();

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<LandingModalMode>('register');
  const [verificationToken, setVerificationToken] = useState<string | undefined>();
  const [resetToken, setResetToken] = useState<string | undefined>();
  const [showAccountManager, setShowAccountManager] = useState(false);

  // Check for verification, password reset hashes, and upgrade query parameter on load
  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify?')) {
        const urlParams = new URLSearchParams(hash.substring(8)); // Remove '#verify?'
        const token = urlParams.get('token');
        if (token) {
          setVerificationToken(token);
          setAccountModalMode('verify');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      } else if (hash.startsWith('#passwordreset?')) {
        const urlParams = new URLSearchParams(hash.substring(15)); // Remove '#passwordreset?'
        const token = urlParams.get('token');
        if (token) {
          setResetToken(token);
          setAccountModalMode('reset-password');
          setShowAccountModal(true);
          // Clear the hash after processing
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    };

    const checkQueryParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const upgrade = urlParams.get('upgrade');
      const login = urlParams.get('login');

      if (upgrade === 'true') {
        // Show login modal for account upgrade
        setAccountModalMode('login');
        setShowAccountModal(true);

        // Clear the query parameter after processing
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('upgrade');
        newUrl.searchParams.delete('family');
        window.history.replaceState(null, '', newUrl.toString());
      } else if (login === 'true') {
        // Show login modal from email link
        setAccountModalMode('login');
        setShowAccountModal(true);

        // Clear the query parameter after processing
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('login');
        window.history.replaceState(null, '', newUrl.toString());
      }
    };

    // Check on mount
    checkHash();
    checkQueryParams();

    // Listen for hash changes
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, []);

  const openAccountModal = (mode: LandingModalMode) => {
    setAccountModalMode(mode);
    setShowAccountModal(true);
  };

  return (
    <div className={`${literata.variable} ${alegreyaSans.variable} landing-root`}>
      <LandingNav
        onOpenAccountModal={openAccountModal}
        onAccountManagerOpen={() => setShowAccountManager(true)}
      />

      <LandingHero onTrialClick={() => openAccountModal('register')} />

      {/* How families use it */}
      <section className="ld-alt" style={{ position: 'relative', overflow: 'hidden' }}>
        <img className="ld-sprite" src="/landing/kitten.svg" alt="" width={96} style={{ top: 40, right: '6%', opacity: 0.85, transform: 'rotate(5deg)' }} />
        <div className="ld-wrap">
          <div className="ld-sect-head">
            <span className="ld-kick">{t('How families use it')}</span>
            <h2>{t('One Tuesday, tracked together.')}</h2>
            <p>{t('Every entry shows who logged it, and everyone sees it the moment it happens. Here is a real shape of a day:')}</p>
          </div>
          <DayStory />
        </div>
      </section>

      {/* Built for 3 am hands */}
      <section>
        <div className="ld-wrap">
          <div className="ld-sect-head">
            <span className="ld-kick">{t('Built for 3 am hands')}</span>
            <h2>{t('Fast enough to use one-handed, in the dark.')}</h2>
          </div>
          <FeatureRow
            title={t('Log anything in two taps')}
            paragraph={t('Sleep, feeds, diapers, pumping, medicine, baths, milestones, measurements. Big targets, sensible defaults, and the last amount pre-filled, because you are holding a baby with the other arm.')}
            items={[
              t('Timers for naps, nursing, and pumping sessions'),
              t('Works on any phone, tablet, or laptop browser'),
            ]}
            figure={<img src="/landing/log-feeding.png" alt={t('Log Feeding on a phone: breast or bottle, bottle type, and amount stepper')} style={{ maxWidth: 'min(340px,100%)', margin: '0 auto', display: 'block' }} />}
          />
          <FeatureRow
            flip
            title={t('The whole day at a glance')}
            paragraph={t('A daily summary up top, the full timeline below. Awake time, total sleep, ounces, diapers: the pediatrician’s questions, already answered.')}
            items={[
              t('Calendar, reports, and pattern heatmaps'),
              t('Vaccine records with documents attached'),
            ]}
            figure={<img className="ld-shot" src="/landing/daily-log.png" alt={t('Sprout Track daily log with summary and timeline')} />}
          />
          <FeatureRow
            title={t('Nursery mode, for the crib-side tablet')}
            paragraph={t('A dimmed, always-on display made for the changing table. Tap once to log a feed or start a sleep timer, without waking anyone up.')}
            items={[
              t('Screen wake lock and adjustable dimming'),
              t('Choose which activity tiles appear'),
            ]}
            figure={<img src="/landing/nursery-mode.png" alt={t('Nursery mode on a tablet: dimmed clock with one-tap feed, pump, diaper, and sleep tiles')} style={{ display: 'block', width: '100%' }} />}
          />
          <div style={{ textAlign: 'center', paddingTop: 34 }}>
            <Link className="ld-btn" href="/features">{t('See every feature')}</Link>
          </div>
        </div>
      </section>

      {/* Data privacy band */}
      <section className="ld-alt">
        <div className="ld-wrap" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 28, alignItems: 'start', maxWidth: 880 }}>
          <Shield size={52} strokeWidth={1.6} color="#0c6b62" aria-hidden="true" />
          <div>
            <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', marginBottom: 10 }}>{t('Your baby’s data isn’t a product.')}</h2>
            <p style={{ maxWidth: '60ch' }}>{t('Sprout Track is open source. No ads, no data brokers, no selling nap schedules to formula companies. Export everything whenever you like, and if you’d rather run it on your own server, the code is free and always will be.')}</p>
            <p style={{ marginTop: 12 }}>
              <a href={GITHUB_URL} rel="noopener">{t('Read the source on GitHub')}</a>
            </p>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="ld-wrap" style={{ textAlign: 'center' }}>
          <img className="ld-sprite" src="/landing/rocket.svg" alt="" width={84} style={{ top: 30, left: '7%', transform: 'rotate(-8deg)' }} />
          <h2 style={{ fontSize: 'clamp(26px,3.2vw,38px)', marginBottom: 10 }}>{t('Pricing that respects a diaper budget.')}</h2>
          <p style={{ maxWidth: '52ch', margin: '0 auto' }}>
            {t('Hosted for')} <b>{t('$2.99 a month')}</b> {t('after your free trial, or')} <b>{t('$19.99 once')}</b> {t('and it’s yours for life. Self-hosting is free forever.')}
          </p>
          <div className="ld-cta-row" style={{ justifyContent: 'center' }}>
            <Link className="ld-btn" href="/pricing">{t('See pricing')}</Link>
          </div>
        </div>
      </section>

      {/* From the maker */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="ld-wrap" style={{ maxWidth: 880 }}>
          <span className="ld-kick">{t('From the maker')}</span>
          <h2 style={{ fontSize: 'clamp(24px,3vw,32px)', margin: '10px 0 12px' }}>{t('Built in Kansas City. Funded by families, not venture capital.')}</h2>
          <p style={{ maxWidth: '62ch' }}>{t('Sprout Track is made by Open Glades LLC, an independent, one-developer shop in Kansas City. There are no investors expecting your data to become a revenue stream, and no growth team designing streaks to keep you hooked. Subscriptions pay for the servers; that’s the whole business model, and it’s why the price is $2.99.')}</p>
        </div>
      </section>

      <CloseCta
        alt
        heading={t('Start tonight. The 3 am shift will thank you.')}
        sub={t('Set up takes about two minutes. Invite the grandparents whenever you’re ready.')}
        assure={t('14 days free, no card required. Cancel anytime.')}
        ctaLabel={t('Start my free trial')}
        onCtaClick={() => openAccountModal('register')}
        sprite={<img className="ld-sprite" src="/landing/star.svg" alt="" width={96} style={{ top: 36, right: '12%', transform: 'rotate(10deg)' }} />}
      />

      <LandingFooter />

      <AccountModal
        open={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialMode={accountModalMode}
        verificationToken={verificationToken}
        resetToken={resetToken}
      />
      <AccountManager
        isOpen={showAccountManager}
        onClose={() => setShowAccountManager(false)}
      />
    </div>
  );
};

export default home;
```

- [ ] **Step 3: Delete `app/home/home.css`**

```bash
git rm app/home/home.css
```

- [ ] **Step 4: Build and verify**

Run: `npm run build 2>&1 | tail -15`
Expected: success. Then `grep -rn "home.css\|saas-" app/home/ src/components/landing/` → no hits (old classes gone).

- [ ] **Step 5: Commit**

```bash
git add app/home/page.tsx src/components/landing/LandingHero.tsx
git commit -m "Rewrite SaaS home page with storybook landing design"
```

---

### Task 10: Rewrite legal markdown (TDD)

**Files:**
- Modify: `public/terms_of_use.md` (full replace)
- Modify: `public/privacy_policy.md` (full replace)
- Test: `tests/legalContent.test.ts`

**Interfaces:**
- Consumes: mockup `terms.html` (lines 20-67) and `privacy.html` (lines 20-79) as the content source.
- Produces: markdown consumed by `LegalPage` AND the existing `TermsOfUseModal`/`PrivacyPolicyModal` (dialect: `#`/`##`/`###` headers, `- ` lists, `**bold**`, `*italic*` only — no links `[]()`, no tables; the renderer supports nothing else, so convert `<a>` tags to plain text like "our Privacy Policy" and bare URLs/emails as plain text).

- [ ] **Step 1: Write the failing test `tests/legalContent.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

function read(name: string): string {
  return readFileSync(path.join(__dirname, '..', 'public', name), 'utf-8');
}

describe('legal content', () => {
  it('terms of use has the new July 2026 content', () => {
    const terms = read('terms_of_use.md');
    expect(terms).toContain('# Terms of Use');
    expect(terms).toContain('Effective Date: July 17, 2026');
    expect(terms).toContain('Open Glades LLC');
    expect(terms).toContain('State of Kansas');
    expect(terms).toContain('sprout-track@jroverton.com');
    expect(terms).toContain('## 11. International Users');
  });

  it('privacy policy has the new July 2026 content', () => {
    const privacy = read('privacy_policy.md');
    expect(privacy).toContain('# Privacy Policy');
    expect(privacy).toContain('Effective Date: July 17, 2026');
    expect(privacy).toContain('GDPR');
    expect(privacy).toContain('California Consumer Privacy Act');
    expect(privacy).toContain('We DO NOT');
    expect(privacy).toContain('sprout-track@jroverton.com');
  });

  it('uses only the markdown dialect the renderer supports', () => {
    for (const name of ['terms_of_use.md', 'privacy_policy.md']) {
      const content = read(name);
      expect(content).not.toMatch(/\[[^\]]+\]\([^)]+\)/); // no md links
      expect(content).not.toContain('<a ');               // no html
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/legalContent.test.ts`
Expected: FAIL (old content lacks the July 2026 markers).

- [ ] **Step 3: Convert the mockup HTML to markdown**

Full-replace both files. Conversion rules: `<h1>`→`# `, `<h2>`→`## ` (keep the numbered headings exactly, e.g. `## 1. Acceptance of Terms`), `<h3>`→`### `, `<ul><li>`→`- ` lines, `<p>`→plain paragraphs separated by blank lines, `<strong>`→`**bold**`, `<em>`→`*italic*`, entities decoded (’ “ ” &). The meta line under the h1 renders as a plain paragraph: `Effective Date: July 17, 2026` (terms) / `Effective Date: July 17, 2026 · Last Updated: July 17, 2026` (privacy). Links become plain text (e.g., "governed by our Privacy Policy", contact email as bare text `sprout-track@jroverton.com`). Include EVERY section of both mockup pages — terms has 16 numbered sections plus the closing italic line; privacy has all sections from Introduction through Your Consent plus the closing italic Remember line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/legalContent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add public/terms_of_use.md public/privacy_policy.md tests/legalContent.test.ts
git commit -m "Update terms of use and privacy policy to July 2026 versions"
```

---

### Task 11: PaymentModal display prices

**Files:**
- Modify: `src/components/account-manager/PaymentModal.tsx:71` (`price: 2.00` → `price: 2.99`) and `:87` (`price: 12.00` → `price: 19.99`)

- [ ] **Step 1: Edit the two price values**

In the `pricingPlans` array: monthly plan `price: 2.00` becomes `price: 2.99`; lifetime plan `price: 12.00` becomes `price: 19.99`. Touch NOTHING else in the file (no stripePriceId, no features, no checkout logic).

- [ ] **Step 2: Verify**

Run: `grep -n "price: " src/components/account-manager/PaymentModal.tsx`
Expected: `price: 2.99` and `price: 19.99`, no other price lines changed.

- [ ] **Step 3: Commit**

```bash
git add src/components/account-manager/PaymentModal.tsx
git commit -m "Update displayed plan prices to \$2.99 monthly and \$19.99 lifetime"
```

---

### Task 12: Localization — en.json keys + check script

**Files:**
- Modify: `src/localization/translations/en.json`
- Modify: `src/localization/translations/{de,es,fr,it,nl,pl,nb,pt-pt,pt-br,ro}.json` (via script; exact filenames per what exists in that directory)

- [ ] **Step 1: Collect every new key**

Extract every string literal passed to `t('...')` in: `src/components/landing/*.tsx`, `app/(marketing)/**/*.tsx`, `app/home/page.tsx`, PLUS every English string in `src/components/landing/landing-data.ts` (day-story titles/whos/notes/times, chip labels, plan tags/names/per/features/ctas, FAQ questions/answers — they're rendered through `t()`).

```bash
grep -rhoE "t\('([^']|\\\\')+'\)" src/components/landing app/\(marketing\) app/home/page.tsx | sort -u
```

- [ ] **Step 2: Add each key to `en.json`** with value = key (English self-mapping), matching the file's existing format. Skip keys that already exist (e.g., `Sprout Track`, `Features`, `Pricing` may exist).

- [ ] **Step 3: Run the sync script**

Run: `node scripts/check-missing-translations.js`
Expected: reports keys added to the 10 non-English files; re-running reports nothing missing.

- [ ] **Step 4: Sanity-check no key got mangled**

Run: `npx vitest run` (full suite) and `node -e "JSON.parse(require('fs').readFileSync('src/localization/translations/en.json'))" && echo OK`
Expected: suite passes, `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/localization/translations/
git commit -m "Add landing page localization keys"
```

---

### Task 13: Translation pass (10 languages)

**Files:**
- Modify: `src/localization/translations/{de,es,fr,it,nl,pl,nb,pt-pt,pt-br,ro}.json`

- [ ] **Step 1: Translate the new keys in every non-English file**

For each language file, find the keys added in Task 12 (they have empty-string values, or diff against `git show HEAD~1`) and fill in a natural translation of the English key. Guidelines:
- Keep product terms untranslated: "Sprout Track", "GitHub", "Docker", "PIN", "ID: 01 · PIN: 111111" (translate only the surrounding words if any).
- Keep prices verbatim: $2.99, $19.99, 14 (days).
- Match the register of existing translations in the same file (informal/warm).
- Proper names in the day story (Tom, Priya, Betty, Grandma → translate "Grandma" only).
- This can be split across parallel subagents, one per language, since files don't overlap.

- [ ] **Step 2: Verify completeness**

Run: `node scripts/check-missing-translations.js`
Expected: no missing keys. Then verify each file still parses:

```bash
for f in src/localization/translations/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f'))" || echo "BROKEN: $f"; done
```

Expected: no BROKEN lines.

- [ ] **Step 3: Commit**

```bash
git add src/localization/translations/
git commit -m "Translate landing page strings into all supported languages"
```

---

### Task 14: Final verification & polish

**Files:**
- Possibly small fixes anywhere in the landing surface

- [ ] **Step 1: Full test suite**

Run: `npm test`
Expected: all tests pass, including the 4 new files.

- [ ] **Step 2: Production build (includes ESLint)**

Run: `npm run build 2>&1 | tail -25`
Expected: success; `/features`, `/pricing`, `/terms`, `/privacy` in the route manifest.

- [ ] **Step 3: Constraint greps**

```bash
grep -rn "dark:" src/components/landing app/\(marketing\) app/home/page.tsx && echo "FAIL: dark: found" || echo "OK"
grep -rn "html.dark" src/components/landing/landing.css && echo "FAIL" || echo "OK"
grep -rn "\$2/\|\$12\b\|\\\$2 \|price: 2.00\|price: 12.00" app/home src/components/landing src/components/account-manager/PaymentModal.tsx || echo "OK: no old prices"
grep -rn "fonts.googleapis" src/components/landing app/\(marketing\) app/home && echo "FAIL: external fonts" || echo "OK"
```

- [ ] **Step 4: Runtime smoke test**

Start the dev server (`npm run dev`, port per project config) with `DEPLOYMENT_MODE=saas` in `.env` (already set). Verify with curl or browser:
- `/` renders the new hero (grep response HTML for "on the same page")
- `/features`, `/pricing` return 200 with mockup headlines
- `/terms` and `/privacy` return 200; their markdown fetches load
- `/api/landing-stats` returns `{"success":true,"data":{...}}`

Kill the server afterwards.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A && git commit -m "Landing redesign polish and verification fixes"
```
(Skip the commit if the tree is clean.)
