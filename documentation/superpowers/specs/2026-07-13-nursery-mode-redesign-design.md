# Nursery Mode Redesign — Design Doc

**Date:** 2026-07-13
**Source PRD:** `documentation/temp-development-docs/sprout-track-nursery/nursery-mode-prd.html` (v1.0)
**Interactive prototype:** `documentation/temp-development-docs/sprout-track-nursery/nursery-mode.html` + `nursery.jsx`
**Branch:** `2026-july-3` (subagent commits authorized by John for this run; no pushes)

## 1. Overview

Replace the current Nursery Mode (dimmed clock over a single lava-lamp gradient with four
glass tiles) with the PRD's **nightlight + care station**: a large serif clock and baby name
over one of four configurable **scenes** (Ambient, Starlit, Tapestry, Photo), with glass
activity **Cards** or icon-forward **Big Tiles** for one-tap logging of Feed, Pump, Diaper,
Sleep. Every visual element is configurable from an on-screen Settings drawer and persists
per user as a JSON string.

**Scope decision (autonomous, John asleep):** implement the full PRD — P0, P1, and P2 —
in this pass. The PRD replaces the existing Nursery Mode outright; no feature flag.

**Golden constraint from John:** *maintain existing functionality for how the activities
work.* All activity API semantics (active-breastfeed server sessions, local pump timer,
sleep start/stop via POST + PUT, instant bottle/diaper logs, 10s activity polling, baby
switcher, breast-milk-tracking flag behavior) are preserved exactly; only the visual shells
change.

## 2. Current state (what exists)

- `app/(nursery)/[slug]/nursery-mode/` — layout (provider stack over `#0a0a1a`), page renders `NurseryModeContainer`.
- `src/components/features/nursery-mode/` — `NurseryModeContainer.tsx` (711-line orchestrator: lava-lamp bg, clock, baby switcher, tiles grid, footer, drawer), `TileShell`/`SubButton` (glass tiles), `FeedTile`/`PumpTile`/`DiaperTile`/`SleepTile` (activity logic — **preserve**), `Clock.tsx`, `SettingsDrawer.tsx` (hue/dim/sat sliders + tile toggles + wake/fullscreen), `nursery-animations.css`.
- Settings persist in `Settings.nurseryModeSettings` (String? JSON blob, keyed `{ [caretakerId] | global: {...} }`) via `/api/nursery-mode-settings` (withAuthContext). Old shape: `{hue, brightness, saturation, visibleTiles}`. **No schema migration needed** — same column, new JSON payload.
- Hooks: `useWakeLock`, `useFullscreen`, `useNurseryColors` (HSL token generator), `useNurserySettings` (GET on mount, debounced POST), `useAuthedImage` + `photoFileUrl` (Bearer-token blob URLs for photo bytes — required, `<img src>` 401s).
- Photos: `/api/photos` list (cursor, thumbs), `/api/photos/upload`, `/api/photos/file/[id]?size=thumb|full`; gated by `isPhotosEnabled()` AppConfig flag (403 when off).
- Log endpoints: POST returns created record incl. `id`; DELETE `?id=` hard-deletes → undo = capture id, DELETE.
- Assets provided: `documentation/temp-development-docs/sprout-track-nursery/patterns/sprites/extracted/<set>/<pose>.svg` — 11 sets (teddy, kittens, puppies, unicorns, butterflies, flowers, rockets, cars, balls, stars, fairies), 6–8 poses each, greyscale hex fills, per-pose viewBox. `patterns/rugs/` — 5 large greyscale SVGs (128–832 KB).

## 3. Architecture

### 3.1 File layout (new/changed)

```
public/nursery/
  sprites/<set>/<pose>.svg          # copied from PRD extracted/ (11 sets)
  rugs/{paisley-1,paisley-2,paisley-3,rug-1,rug-2}.svg

src/utils/nursery/                  # PURE, unit-tested, no DOM
  colorMath.ts                      # hex2hsl, hsl2hex, relativeLuminance, mapTargetColor,
                                    # backdropTint, autoIconColor(hue)
  recolorSvg.ts                     # recolorSvgText(svgText, base, colors): string
  placement.ts                      # placeScatter(boxes, opts, rng), placeOutlineField(...)
                                    # rng injected → deterministic tests
  settings.ts                       # NurserySettings v1 types, DEFAULTS, PALETTES,
                                    # normalizeNurserySettings(unknown) → v1 (incl. legacy
                                    # {hue,brightness,saturation,visibleTiles} migration)
  dominantColor.ts                  # dominantTintFromPixels(data: Uint8ClampedArray) → {hue, tint}

src/components/features/nursery-mode/
  NurseryModeContainer.tsx          # slim orchestrator: settings, baby, polling, toast, layout
  nursery.css                       # keyframes + scene/layout classes (from mockup CSS)
  icons.tsx                         # inline stroke icons (bottle/pump/diaper/moon/image/star)
  spriteManifest.ts                 # 11 sets: {id, label, poses: [{file, label}]}
  engine/
    recolorCache.ts                 # client caches: svg-text fetch, blob URLs per (asset|palette)
    useRecoloredAsset.ts            # sprite/rug → recolored blob URL (SVG text path)
    useOutlineSprites.ts            # sprite set → edge-traced tinted PNG blob URLs (canvas)
  scenes/
    SceneBackground.tsx             # dispatcher; applies dim/sat filter to bg layer only
    AmbientScene.tsx                # aurora | waves | bubbles | sprite:<set> outline fields
    StarlitScene.tsx                # starfield + optional aura curtains
    TapestryScene.tsx               # CSS backdrops / recolored rugs + ScatterLayer
    ScatterLayer.tsx                # dart-throw placed recolored sprites (primary + accent)
    PhotoScene.tsx                  # authed photo bg + scrim + auto-tint sampling
  activities/
    FeedActions.tsx, PumpActions.tsx, DiaperActions.tsx, SleepActions.tsx
                                    # existing tile logic transplanted verbatim (state machines,
                                    # fetches, timers); render-prop/childless: expose phase,
                                    # statusText, actions[] to the shell
    ActivityCard.tsx                # Cards layout shell (glass card per mockup)
    BigTile.tsx                     # Big Tiles layout shell + action overlay
    UndoToast.tsx                   # "Wet diaper logged · Undo" 6s toast
  ClockBlock.tsx                    # serif time + italic tappable baby name + date
  SettingsDrawer.tsx                # full rebuild per mockup (all §7 controls)
  PhotoPicker.tsx                   # gallery grid (authed thumbs) + upload button

app/api/nursery-mode-settings/route.ts   # accept/store v1 JSON (shared normalize), legacy-compat
src/hooks/useNurserySettings.ts          # v1 types, caretakerId from localStorage,
                                         # localStorage mirror for instant load, re-read on focus
tests/nursery-*.test.ts                  # see §10
```

Deleted after replacement: old `TileShell.tsx`, `SubButton.tsx`, `FeedTile.tsx`, `PumpTile.tsx`,
`DiaperTile.tsx`, `SleepTile.tsx`, `Clock.tsx`, `nursery-animations.css` (superseded).
`useNurseryColors` stays (drawer/dropdown chrome still uses tokens) but foreground text moves
to the mockup's fixed white-on-dark rgba values.

### 3.2 Fonts

Mockup uses **Newsreader** (serif) for clock/name/meta. Add via `next/font/google` in
`app/(nursery)/[slug]/nursery-mode/layout.tsx`, exposed as a CSS variable consumed by
`nursery.css` (`.serif`). Self-hosted by next/font → PWA/offline safe.

## 4. Settings model (v1 JSON)

Exactly the PRD §9 schema:

```ts
interface NurserySettings {
  v: 1;
  scene: 'ambient' | 'starlit' | 'tapestry' | 'photo';
  layout: 'cards' | 'tiles';
  hue: number;            // 0–360, default 248
  dim: number;            // 0–100, default 46
  sat: number;            // 0–100, default 38
  trans: number;          // 0–100, default 58 (button transparency)
  iconShape: 'circle' | 'square';   // default 'square'
  iconColor: string | null;         // null = Auto
  acts: { feed: boolean; pump: boolean; diaper: boolean; sleep: boolean };
  ambient: { pattern: string;       // 'aurora' | 'waves' | 'bubbles' | 'sprite:<set>'
             auroraRange: number; waveMotion: number;
             bubbles: { count: number; min: number; max: number };
             rot: number; move: number; size: number };
  starlit: { density: number; aura: boolean };      // density 30–400, default 200
  tapestry: { backdrop: string;     // css id | 'rug:<id>'
              primary: string | null; accent: string | null;
              palette: 'boys' | 'girls';
              base: string; colors: [string, string, string, string, string] };
  photo: { src: string | null;      // 'gallery:<photoId>' | 'upload:<photoId>' (uploads land in
                                    // the gallery, so both resolve via /api/photos/file/<id>)
           autoTint: boolean };
}
```

- `normalizeNurserySettings(raw)` clamps ranges, fills defaults, and **migrates legacy**
  `{hue, brightness, saturation, visibleTiles}` → `{hue, dim: brightness, sat: saturation,
  acts: from visibleTiles, scene: 'ambient', ...defaults}`.
- **API route:** POST body `{ caretakerId?, settings }`; validates via shared
  `normalizeNurserySettings` (pure module — importable server-side); stores normalized JSON
  under `caretakerId || 'global'` in the existing blob. GET cascade unchanged
  (caretaker → global → defaults), migrating legacy buckets on read.
- **Hook:** `useNurserySettings` now reads `caretakerId` from `localStorage.caretakerId`
  (per-user per PRD), mirrors last-known settings JSON in
  `localStorage['nurseryModeSettings']` for instant load + offline, re-fetches on
  `window` focus (PRD: last-write-wins, re-read on focus). Debounced 500ms save kept.
- Palette presets (PRD §7): Boys `base #f2e9d8, colors [#3a6ea5,#5f93c9,#8fb4d9,#b1492f,#d67f65]`;
  Girls `base #f4ebe4, colors [#4b8a5d,#7bb08a,#aecfb6,#c66d90,#e2a1bd]`. Base chips per prototype.

## 5. Asset pipeline & recolor engine

- **Assets:** copy sprite SVGs to `public/nursery/sprites/<set>/<pose>.svg` verbatim;
  rugs to `public/nursery/rugs/`. `spriteManifest.ts` is the checked-in manifest
  (id, label, poses with per-pose file + aspect handling comes free from each SVG's viewBox).
- **Sprite recolor (Tapestry scatter, thumbnails, rugs):** production sprites are per-pose
  SVGs with plain hex fills → use the prototype's **SVG-text path only**: fetch text once
  (cache), collect unique `#hex`/`rgb()` colors, sort by luminance, map position p onto the
  palette via `mapTargetColor` (lightest ≥0.8 → base; darker bands → the 5 pattern colors),
  output lightness = `0.55·grey + 0.45·target`; blob URL cached per `(file|base|colors)`.
  No canvas needed for this path. Rugs recolor lazily on first use (they're 128–832 KB).
- **Outline variant (Ambient sprite patterns):** rasterize the single-pose SVG to a canvas
  (bounded size), background = alpha (sprites have transparent bg — no flood-fill needed;
  fall back to corner-reference flood fill if a sheet has opaque bg), edge = silhouette
  boundary + interior luminance steps (>24), dilate 2px twice, tint to
  `hsl(hue, 45%, 86%)` at ~92% alpha, export PNG blob. Cache per `(set|pose|hue)`.
  **The prototype's sprite-sheet slicing (`analyzeSheet`) is dropped** — per-pose files
  make it unnecessary (PRD §8 note).
- Recolor work happens in `useEffect`/idle paths; target <150 ms for the largest asset
  off the interaction path (PRD §10).

## 6. Scenes

Shared: `SceneBackground` renders the active scene in an absolutely-positioned layer with
`filter: brightness(0.32 + dim/100·0.78) saturate(sat/100·1.9)` — background only, never
foreground text. All animation behind `prefers-reduced-motion: no-preference`; static
fallbacks render full content (e.g. bubbles pinned at random heights).

- **Ambient** (`ambient.pattern`):
  - *Aurora*: base gradient `linear-gradient(155deg, oklch(0.5 0.12 h), oklch(0.38 0.13 h+35))`
    + three drifting blurred blobs; `auroraRange` (0–100) scales blob hue offsets
    (`f = 0.3 + range/100·1.9` applied to +20/+70/−40 offsets).
  - *Waves*: bottom-anchored 3-layer wave SVG (data URI, hue-derived); `waveMotion` 0 = still,
    else rock-and-drift animation, amplitude/speed scale together.
  - *Bubbles*: glassy orbs rising with lateral drift; sliders count 4–80 (default 24),
    min size 4–80 px (default 10), max size 10–160 px (default 48).
  - *Sprite outlines*: ~26 collision-free outline sprites at ~34% opacity;
    sliders Rotation (0 upright → random tilt), Movement (0 static → free float, speed scales),
    Icon size (0 uniform → wide variance). Static placement via `placeOutlineField` (pure).
- **Starlit**: static starfield, per-star fixed position/size/brightness; brightest ~18%
  (opacity > 0.82) get glow + occasional cross-flare sparkle on independent timers; no global
  pulsing. Density slider 30–400 (default 200). `aura` toggle renders three screen-blended
  swaying curtains above the field.
- **Tapestry**: backdrop + scattered objects, all palette-tinted.
  - Backdrops: 8 CSS patterns (Plain, Pinstripe, Horizontal, Diagonal, Chevron, Dots, Blocks,
    Scallops) drawn from `base` (+ auto tint derived at ±6 L, ×1.15 S) — exact CSS from
    prototype `backdropStyle` — plus 5 recolored rug artworks.
  - Selecting a rug sets both objects to **None**; returning to a CSS backdrop restores
    Teddy Bears + Stars if the user hasn't customized objects meanwhile (track a
    `customized` flag in component state, matching prototype behavior).
  - Objects: Primary (None + 11 sets, ~17 placed, 0.62×–1.3× scale, ±28° rotation) then
    Accent (None + 11 sets, ~16 at 50% scale) via dart-throwing collision rejection;
    pose weights ×0.4 per use. Re-dealt per visit (fresh RNG each mount).
- **Photo**: background photo behind a hue-tinted legibility scrim. Source = gallery picker
  or direct upload (upload goes through `/api/photos/upload`, then referenced by id).
  Bytes via `useAuthedImage(photoFileUrl(id, 'full'))`. `autoTint`: draw the blob to a
  ≤64px canvas, `dominantTintFromPixels` clusters hues (weighted by saturation), returns a
  light contrasting tint at fixed lightness (oklch-style, implemented in HSL) → icon color
  when `iconColor === null`. If Photos feature is disabled (403) or no photo chosen, scene
  falls back to the ambient base gradient and the drawer shows an explanatory note.

## 7. Layouts & quick logging

- **Cards** (default): 2×2 glass cards (1-col ≤680px), per mockup: icon badge + activity
  name left, last-event time (italic serif) + detail right, action buttons row below.
  Card/button rgba backgrounds driven by `trans` via CSS vars
  (`cardBg = 0.16 − trans/100·0.15`, `btnBg = 0.2 − trans/100·0.16`, `line = 0.24 − trans/100·0.16`).
- **Big Tiles**: square icon-forward tiles (badge, label, last-event time), tap opens a
  compact overlay (same glass styling) listing the same action buttons; active timers render
  their status on the tile and in the overlay.
- **Action sets (existing semantics preserved):**
  - Feed: `Bottle (avg)` instant POST; `Breast L`/`Breast R` start the server
    active-breastfeed session → card switches to Switch/Pause/Resume/Stop with elapsed
    (exact `FeedActions` transplant).
  - Pump: `Start Left/Right/Both` local timer → Switch/Pause/Resume/Stop (+ Stored/Fed/
    Discarded selection unless breast-milk tracking off) → POST pump-log.
  - Diaper: `Wet`/`Dirty`/`Both` instant POST.
  - Sleep: `Start Sleep` → location subset (Crib/Contact) → POST; sleeping state shows
    elapsed + `Wake Up` (PUT endTime).
- **Undo (PRD §6):** instant one-tap writes — bottle and diaper — show a quiet toast
  “{Thing} logged · **Undo**” for 6 s; Undo issues `DELETE /api/<log>?id=` and clears the
  card's last-event metadata back to the previous value (refetch). Timers keep existing
  start/stop semantics and get no undo. Toast is a single slot (new log replaces prior toast).
- Card/tile metadata refreshes instantly on log (existing `onLog` flow) and via the existing
  10 s poll. All hit targets ≥44 px; text always full-opacity.
- Active timer treatment: replaces the card's action row (never hides other cards — the old
  expand/collapse-all behavior is removed in favor of the PRD's inline treatment).

## 8. Screen anatomy & chrome

- **Top bar:** ghost `Settings` and `Exit` buttons (Exit unprotected → `/{slug}/log-entry`,
  releases wake lock / exits fullscreen).
- **Clock block:** large serif time (12/24h from `useTimezone().timeFormat`), italic baby
  name beside it — **tap name to switch baby** (existing switcher dropdown, restyled to the
  glass look; single-baby families get a non-interactive name). Uppercase letter-spaced
  locale date below.
- **Footer:** "NURSERY MODE" wordmark + wake-lock status dot (existing states).
- **Landscape ≤500px tall:** keep existing compact behavior (clock + name inline in top bar,
  footer hidden), scenes unchanged.
- **≤680px:** single-column cards, 2-up tiles, full-width drawer, fixed background with
  scrolling foreground, viewport-clamped clock type (mockup media query).

## 9. Settings drawer

Right-side drawer per mockup (full-width ≤680px), sections:

1. **Scene** — 4 preview cards (live mini-previews: gradient/starfield/backdrop/photo icon).
2. **Layout** — segmented Cards / Big Tiles.
3. **Scene-specific** (contextual):
   - Ambient: background picker (Aurora/Waves/Bubbles + 11 outline-sprite thumbnails showing
     one random pose over the ambient gradient) + per-pattern sliders (§6).
   - Starlit: Aura toggle + star density slider.
   - Tapestry: backdrop swatches (8 CSS + 5 rug previews), Primary/Accent object pickers
     (None + 11 recolored thumbnails), Boys/Girls palette segmented control, base-color
     chips + custom color well, 5 editable pattern-color wells.
   - Photo: PhotoPicker (authed thumbnail grid from `/api/photos`, newest first, plus
     Upload button) + Auto icon color toggle.
4. **Wake lock / Fullscreen** — toggle cards (existing hooks; wake-lock toggle now
   requests/releases rather than always-on).
5. **Background hue** (0–360), **Dim**, **Saturation** sliders.
6. **Button transparency** slider.
7. **Icon shape** (Circle/Square) + **Icon color** (AUTO + 6 swatches
   `#f9c9d6 #fbd38d #a7f3d0 #a5d8ff #d8b4fe #ffffff`).
8. **Activity tiles** — per-activity toggle rows.

Every control writes through `saveSettings` (debounced, optimistic local state).
Auto icon color = `oklch(0.9 0.11 (hue+150)%360)` (photo scene: sampled tint when autoTint).

## 10. Testing (vitest, `tests/`, node env)

- `nursery-color-math.test.ts` — hex↔hsl roundtrips, `mapTargetColor` band edges (p=0, 0.79,
  0.8, 1), luminance ordering, backdrop tint derivation, autoIconColor.
- `nursery-recolor-svg.test.ts` — fixture SVG string: all hexes remapped, luminance order
  preserved, non-color text untouched, rgb() form handled, idempotent shape.
- `nursery-placement.test.ts` — seeded rng: no two placed items' bounding circles overlap,
  counts ≤ requested, weights decay pose repetition, rotation/size bounds respected,
  degenerate inputs (empty poses, zero counts).
- `nursery-settings.test.ts` — normalize: defaults fill, clamping, legacy migration
  (`brightness→dim` etc., visibleTiles→acts), unknown scene/pattern fallback, v passthrough.
- `nursery-dominant-color.test.ts` — synthetic pixel buffers: solid color → its hue;
  mixed dominant wins; greyscale image → neutral fallback tint.

API route reuses `normalizeNurserySettings`, so the settings tests cover its validation core.

## 11. Localization

All new user-facing strings via `t()` with keys added to `en.json` first, then
`node scripts/check-missing-translations.js`, then best-effort translation of the other
language files (de, es, fr, it, nl, ro, pt-pt, pt-br). New keys include scene names,
pattern/backdrop/object labels, slider labels, toast strings ("Undo", "logged"), etc.

## 12. Implementation phases (plan skeleton)

1. **Foundation** — copy assets, `spriteManifest`, pure utils (`colorMath`, `recolorSvg`,
   `placement`, `settings`, `dominantColor`) + all unit tests.
2. **Settings v2** — hook rewrite (caretaker bucket, localStorage mirror, focus re-read),
   API route v1 payload + legacy migration.
3. **Stage & chrome** — `nursery.css`, Newsreader font, container skeleton (topbar,
   ClockBlock + baby switcher, footer), SceneBackground dispatcher + **Ambient** scene.
4. **Cards & Big Tiles** — activity shells, transplanted action components, undo toast.
5. **Starlit + Tapestry** — starfield/aura; backdrops, recolor engine hooks, ScatterLayer.
6. **Settings drawer** — full rebuild with previews/thumbnails.
7. **Photo scene** — PhotoPicker, upload, authed bg, dominant-color tint.
8. **Polish & verify** — outline sprite ambient patterns, reduced-motion audit, responsive
   audit, translations pass, `npm test` + `npm run build` green, delete dead files.

Each phase = one or more subagent tasks, committed separately on `2026-july-3`.

## 13. Resolved decisions (autonomous, per PRD + codebase)

| Question | Decision |
|---|---|
| Scope | Full P0+P1+P2 |
| Undo coverage | Bottle + diaper instant logs only (PRD §6: timers keep start/stop semantics) |
| Sleep flow | Keep existing location-selection step (Crib/Contact) — "maintain existing functionality" wins over the mockup's single Start Sleep button |
| Expand/collapse tiles | Removed; PRD's inline active-timer treatment replaces it |
| Persistence | Existing JSON blob column; v1 schema + legacy migration; caretaker bucket from `localStorage.caretakerId`; localStorage mirror |
| Sprite slicing | Dropped — per-pose SVGs shipped; SVG-text recolor only for sprites/rugs; canvas only for outline extraction and photo sampling |
| Photos disabled | Photo scene falls back to gradient; drawer explains |
| Font | Newsreader via next/font/google in nursery layout |
| Landscape phones | Keep existing compact header behavior |
| useNurseryColors | Retained for drawer/dropdown chrome; scene foreground uses mockup's fixed white rgba palette |
