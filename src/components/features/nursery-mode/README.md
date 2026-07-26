# Nursery Mode

A full-screen, kiosk-style view for a bedside tablet: a live clock, quick-log
tiles for feed/pump/diaper/sleep/food, and a customizable animated backdrop (scene).
Ported from the `nursery.jsx` prototype in `documentation/Implementation/`,
split into an engine/scenes/activities/drawer architecture so each concern is
independently testable.

## Entry point

`NurseryModeContainer.tsx` is the only export the route (`app/(nursery)/[slug]/nursery-mode/page.tsx`)
should render. It orchestrates:

- **Settings** via `useNurserySettings()` (see below).
- **Scene rendering** via `SceneBackground` (scenes/).
- **Foreground layout**: clock (`ClockBlock.tsx`), the activity grid or big-tile
  grid built from `activities/`, and the settings drawer (`SettingsDrawer.tsx`).
- **Cross-cutting device concerns**: wake lock (`useWakeLock`), fullscreen
  (`useFullscreen`), orientation (landscape phone layout), baby switching, and
  polling the latest feed/pump/diaper/sleep log for each tile's meta line.
- **Undo**: instant logs (bottle feed, diaper change) surface an `UndoToast`
  that deletes the just-created record via the `UndoInfo.endpoint`.

## Settings model (v1)

`src/utils/nursery/settings.ts` is the single source of truth for the
`NurserySettings` shape (`v: 1`), `NURSERY_DEFAULTS`, palettes
(`PALETTES`, `BASE_CHIPS`), and `normalizeNurserySettings()` — a defensive
parser that clamps/coerces any stored or API-returned value back to a valid
`NurserySettings`, so a corrupt localStorage blob or a future schema change
never crashes the container. `CSS_BACKDROPS` (the flat-pattern tapestry
backdrops) also lives here since it's settings-shaped data, not markup.

Persistence (`src/hooks/useNurserySettings.ts`):

- **Read**: on mount and on every window `focus`, `GET /api/nursery-mode-settings?caretakerId=`.
  The route (`app/api/nursery-mode-settings/route.ts`) cascades
  caretaker-specific → family-global → defaults, stored as one JSON blob
  (`Settings.nurseryModeSettings`, keyed by caretaker id or `'global'`) so a
  single migration column serves every caretaker in a family.
- **Write**: `updateSettings(patch)` merges + normalizes locally, updates
  React state and a `localStorage` mirror (`nurseryModeSettingsV1`)
  immediately for a responsive UI, then debounces the `POST` by 500ms. A
  focus-triggered refetch is skipped while a save is pending or in flight
  (last-write-wins) so it can't clobber an unsaved edit; an unmount flushes
  any pending save immediately.
- The localStorage mirror lets the drawer render instantly on next load
  before the network round-trip resolves.

## Scenes (`scenes/`)

`SceneBackground` is the only entry point the container uses; it applies the
shared `brightness`/`saturate` filter (from `dim`/`sat`) and dispatches to one
of four scenes by `settings.scene`:

- **Ambient** (`AmbientScene.tsx`) — aurora blobs, rocking waves, or rising
  bubbles (CSS pattern layers), *or* a field of floating sprite outlines when
  `ambient.pattern` is `sprite:<setId>`. Outlines come from
  `useOutlineSprites` (engine/) and are placed with
  `src/utils/nursery/placement.ts::placeOutlineField` (seeded RNG so a
  re-render doesn't reshuffle the field; pure function, unit tested).
- **Starlit** (`StarlitScene.tsx`) — a seeded star field (some twinkle with a
  cross-flare "spark") over a radial night-sky gradient, plus optional aurora
  curtains or a plain scrim.
- **Tapestry** (`TapestryScene.tsx`) — a CSS-pattern or recolored-rug backdrop
  (`scenes/backdropStyle.ts`) plus a `ScatterLayer` of recolored sprite poses
  (primary + accent sets) dart-thrown across it. Recoloring runs through the
  engine's recolor pipeline (below) with the palette's `base`/`colors`.
- **Photo** (`PhotoScene.tsx`) — the selected photo (`useAuthedImage`,
  cover-fit) with a hue-tinted scrim, or the ambient base gradient when no
  photo is set. When `autoTint` is on, it downsamples the loaded image onto a
  64px canvas and calls `dominantTintFromPixels`
  (`src/utils/nursery/dominantColor.ts`, pure/tested) to report a dominant
  tint up to the container for auto icon coloring.

## Recolor engine (`engine/`)

`recolorCache.ts` is the shared caching layer both scenes and the drawer's
sprite/rug pickers use:

- `fetchSvgText(url)` — memoizes raw SVG fetches per URL.
- `recoloredSvgUrl(url, palette)` — recolors via
  `src/utils/nursery/recolorSvg.ts::recolorSvgText` (pure, tested; maps a
  source SVG's grayscale colors verbatim onto `palette`, ranked darkest→lightest
  on both sides — no hue/lightness blending) and caches the resulting blob URL
  per `url|palette` key. Backdrops (rugs) pass `[base, ...colors]` so the base
  color tints the background; scattered sprites pass `colors` only, so the
  base color never bleeds into the "stencil" artwork.
- `outlineSpriteUrl(url, hue)` — rasterizes a transparent-background SVG to a
  canvas, edge-detects + dilates twice, tints the outline to the hue, and
  caches the result per `url|hue`. Used for ambient sprite-outline mode.

Both caches are session-lifetime (never revoked) and self-evict a key on
failure so a later retry can succeed. `useRecoloredAsset` and
`useOutlineSprites` are the React-side wrappers (return `null` until
resolved); `drawer/SpriteThumb.tsx` and `drawer/RugThumb.tsx` use the same
hooks to render live-recolored picker thumbnails.

## Activities (`activities/`)

Each activity is a self-contained hook transplanted 1:1 from the old
`*Tile.tsx` components' state machines, returning a shared `ActivityView`
(`id`, `icon`, `label`, `statusText`, `active`, `buttons: ActionButton[]`) so
the container can render either a `ActivityCard` (cards layout) or `BigTile`
(tiles layout) without knowing the activity's internals:

- `useFeedActions` — bottle/breast quick-log, remembers the last bottle unit
  and average amount.
- `usePumpActions` — left/right/both timers with resume support.
- `useDiaperActions` — wet/dirty/both instant log.
- `useSleepActions` — location picker → sleeping timer → wake.
- `useFoodActions` — one-tap food-try logging against the family food catalog
  (alphabetical picker with a search field), with a transient after-log
  enjoyment prompt (the FoodForm's Fluent Emoji SVGs) that
  PUTs onto the just-created entry. Off by default (`acts.food`); pure helpers
  live in `src/utils/nursery/foodActivity.ts`.

Bottle, diaper, and food logs are undoable (`onUndoable` → `UndoInfo`); sleep/pump
sessions are not (they're multi-step, so a mis-tap is cheap to correct by
tapping again). `activities/types.ts` also holds `formatMMSS`/`formatHMMSS`
duration formatters shared by the timer-driven activities.

## Drawer (`SettingsDrawer.tsx`, `drawer/`)

The settings drawer is one large component with sections for scene, layout,
per-scene options (ambient pattern/aurora/waves/bubbles/motion, starlit
density/aura, tapestry backdrop/sprites/palette/custom colors, photo picker),
icon shape/color, activity tile toggles, and screen wake lock/fullscreen
controls. `RugThumb`/`SpriteThumb` render live-recolored/outlined preview
thumbnails using the engine hooks above so a color change is reflected in the
picker immediately, not just in the active scene.

## Photo picker (`PhotoPicker.tsx`)

Lists the family's gallery photos (`fetchPhotosEnabled`/gallery API) for
selection as the Photo scene's background, plus upload. Disabled with a
message when the deployment's photos feature flag is off.

## Sprite/rug manifest (`spriteManifest.ts`)

`SPRITE_SETS` (11 sets, 6 poses each except balls' 8 — teddy, kittens,
puppies, unicorns, butterflies, flowers, rockets, cars, balls, stars,
fairies) and `RUGS` (5 paisley/medallion patterns) are static asset
manifests: `{ id, label, poses:
[{ file, label }] }`. `spriteUrl`/`rugUrl` build the `/nursery/...` public
asset paths consumed by the recolor engine. Sprite pose labels are
internal-only (not localized); set/rug `label` fields are run through `t()`
wherever they're displayed as picker names.

## Localization

Every user-facing string goes through `useLocalization()`'s `t()`. Static
labels are called directly (`t('Feed')`); labels sourced from data tables
(sprite sets, rugs, CSS backdrops, sleep locations, feed/diaper/pump type
maps) are looked up dynamically (`t(s.label)`, `t(typeLabels[latest.type])`)
— when adding a new entry to one of those tables, add the matching key to
`src/localization/translations/en.json` first, then run
`node scripts/check-missing-translations.js` to propagate it to the other
languages before translating.

## Reduced motion

Every `@keyframes` animation that moves content (drift, flare, rock,
floatXY, rise, aura curtains, the settings-drawer slide-in) is scoped inside
`@media (prefers-reduced-motion: no-preference)` in `nursery.css`; a couple
also carry an explicit `prefers-reduced-motion: reduce` fallback (e.g. rising
bubbles freeze at a static `--sy` position instead of animating, and the
drawer fades in without sliding). Opacity/color transitions (hover states,
toggle fills) are left unguarded — only translate/rotate/scale keyframe
animation is gated.

## Tests

Pure logic extracted to `src/utils/nursery/` is covered in `tests/`:

- `nursery-settings.test.ts` — `normalizeNurserySettings` clamping/coercion.
- `nursery-color-math.test.ts` — `colorMath.ts` (hsl2hex, autoIconColor, etc).
- `nursery-dominant-color.test.ts` — `dominantColor.ts` (photo auto-tint).
- `nursery-recolor-svg.test.ts` — `recolorSvg.ts` (palette substitution).
- `nursery-placement.test.ts` — `placement.ts` (seeded outline-field layout).
- `nursery-backdrop-style.test.ts` — `scenes/backdropStyle.ts` (CSS pattern
  generation for tapestry backdrops).
- `nursery-photo-scene.test.ts` — `PhotoScene`'s `photoIdFromSrc` helper.
- `nursery-food-activity.test.ts` — `foodActivity.ts` (picker sorting, meta-line note).

Component/hook behavior (drawer interactions, activity state machines, the
container's polling/undo flow) is exercised manually via the running app —
there's no React-render test harness for this feature.
