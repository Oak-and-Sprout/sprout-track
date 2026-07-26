# StorybookDrawer

Right slide-over drawer in the v1-storybook account skin (paper cream, Literata
titles, teal accents). Built on Radix Dialog: portal, focus trap, Esc, click-outside.
Light-only by design — see docs/superpowers/specs/2026-07-17-account-login-reskin-design.md.

## Props
See `storybook-drawer.types.ts`. Key points:
- `title`/`subtitle` are already-localized strings.
- `onBack` renders a back arrow (used by stacked sub-forms).
- `art` renders a decorative sprite from `/landing/` (hidden ≤640px, aria-hidden).
- `footer` renders the sticky paper2 action bar; auth drawers omit it and put a
  full-width `sb-btn sb-wide` in the body instead.
- Stack a sub-form by rendering a second `StorybookDrawer` while the first stays open.

## Styles
`storybook-drawer.css` is the single stylesheet for the whole account reskin
(`sb-*` classes: pane, tabs, buttons, sections, rows, chips, forms, dropdown menu,
toast, page panel). Tokens are self-contained; `html.dark` pins keep the skin light
inside the dark-mode app.

## Toast
`useSbToast()` returns `{ showSbToast, sbToast }` — render `{sbToast}`, call
`showSbToast(t('...'))` for save/send confirmations (replaces `alert()` on
reskinned surfaces only).
