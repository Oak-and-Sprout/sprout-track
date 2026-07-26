# LandingButton Component — Design Spec

**Date:** 2026-07-17
**Branch:** `2026-july-5` (follow-up to the SaaS landing redesign)

## Problem

The landing nav reuses the app's `AccountButton`, whose internal shadcn `Button` variants and `account-button.css` state classes (including `html.dark` overrides that leak in when the app theme is dark) fight the landing's `ld-` styles. Result: the logged-in "Hi, {name}" pill renders green-on-green/unreadable, and app hover effects (ghost/outline fills) bleed through on landing CTAs. Landing CTAs are also styled via repeated raw `className="ld-btn ..."` markup with no shared component.

## Decisions

- New reusable `LandingButton` component owns the button aesthetic; no shadcn `Button` involvement on the landing surface.
- `AccountButton` gains an additive, default-off `unstyled` prop (styling escape hatch only — status/dropdown/modal logic untouched; app usages unaffected).
- Dropdown menu card keeps app styling (trigger only — per John).
- Light-only: landing.css pins nav trigger states so `html.dark` cannot repaint them.

## Components

### `src/components/landing/LandingButton.tsx`

```ts
interface LandingButtonProps {
  variant?: 'solid' | 'ghost';   // default 'solid'
  size?: 'default' | 'big';      // default 'default'
  href?: string;                 // renders <a>; internal → next/link, external → <a rel="noopener">
  external?: boolean;            // force plain <a> with rel="noopener"
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}
```

- Renders `next/link` `Link` when `href` starts with `/` (unless `external`), plain `<a rel="noopener">` for external URLs, else `<button type="button">`.
- Classes: `ld-btn` + `ld-ghost` (ghost) + `ld-big` (big) + `className`. No other styling source. Under 60 lines.

### `AccountButton` `unstyled` prop

- `unstyled?: boolean` (default false) and `loggedInClassName?: string`. When `unstyled` is true:
  - Logged-out branch: renders a plain `<button type="button" className={className}>` (icon behavior unchanged via `showIcon`) instead of shadcn `Button` with `buttonVariant`/`buttonClass`.
  - Logged-in branch: `DropdownMenuTrigger asChild` wraps a plain `<button type="button" className={loggedInClassName ?? className}>` instead of the `Button` with `account-button-logged-in` etc. (`loggedInClassName` exists because one AccountButton spans both states: the landing "Log in" link is quiet when logged out but becomes the solid pill trigger when logged in). Verification/family-setup states keep their text changes ("Verify Account", "Setup Family") but not their app color classes.
- When false (default): behavior byte-identical to today. No app call sites change.

## Call-site changes (landing surface only)

- `LandingNav`: both `AccountButton`s get `unstyled`. "Log in" keeps `className="ld-nav-login"` and adds `loggedInClassName="ld-btn"` (quiet link when logged out; solid teal pill trigger when logged in). The trial button (registers, hides when logged in) uses `className="ld-btn"`.
- Mechanical migration of raw `ld-btn` elements to `LandingButton`: `LandingHero` (trial button + demo ghost link), `CloseCta` (CTA button), `PlanCard` (plan CTA), `SelfHostCallout` ("Get the code"), features page ("See pricing", "View on GitHub"), home page ("See every feature", "See pricing"). No visual change intended.

## CSS (landing.css)

- `.ld-nav .ld-btn` state pins: explicit `background`, `color:#fdfaf0`, `:hover` background `var(--teal-deep)` — written so they also win under `html.dark` (e.g., duplicate selectors prefixed `html.dark .landing-root`).
- Remove now-unneeded assumptions if any (audit `.ld-nav-login` still used by Log in link — yes, keep).

## Testing / verification

- `npx tsc --noEmit` + `npm run build` (ESLint) must stay clean.
- No unit tests (presentational; consistent with repo practice for landing components).
- Visual verification in Chrome: nav in logged-out and logged-in states on `/` and `/features`, light and dark app theme, confirming readable trigger + calm hover; spot-check migrated CTAs unchanged.

## Out of scope

- Dropdown card restyling; any change to app-surface AccountButton styling; other landing components.
