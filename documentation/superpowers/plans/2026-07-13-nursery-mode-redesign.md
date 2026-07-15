# Nursery Mode Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nursery Mode with the PRD's nightlight + care station: four configurable scenes (Ambient, Starlit, Tapestry, Photo), Cards/Big Tiles layouts with one-tap logging + undo, and a full personalization drawer — preserving all existing activity API semantics.

**Architecture:** Pure logic (color math, SVG recolor, placement, settings normalize, dominant color) lives in `src/utils/nursery/` with vitest coverage. Client-only engine (blob URL caches, canvas outline tracing) in `src/components/features/nursery-mode/engine/`. Scenes are standalone components behind a `SceneBackground` dispatcher; activity state machines are transplanted verbatim from the old tiles into `use*Actions` hooks consumed by two layout shells (ActivityCard, BigTile). Settings persist as a v1 JSON blob in the existing `Settings.nurseryModeSettings` column via the existing endpoint.

**Tech Stack:** Next.js App Router, TypeScript strict, TailwindCSS + plain CSS (html.dark irrelevant — nursery is always dark), vitest (node env), Prisma (no schema change), next/font/google (Newsreader).

**Spec:** `documentation/superpowers/specs/2026-07-13-nursery-mode-redesign-design.md`
**Prototype (visual source of truth):** `documentation/temp-development-docs/sprout-track-nursery/nursery-mode.html` (CSS lines 12–205) and `nursery.jsx` (all component JSX)
**PRD:** `documentation/temp-development-docs/sprout-track-nursery/nursery-mode-prd.html`

## Global Constraints

- Branch `2026-july-3`. Commit after each task (John authorized commits for this run). **NEVER push.**
- **Maintain existing activity functionality exactly**: active-breastfeed server sessions (`/api/active-breastfeed` POST/PUT?action=switch|pause|resume/DELETE), local pump timer + Stored/Fed/Discarded selection (skipped when `enableBreastMilkTracking === false`), sleep POST + PUT endTime with Crib/Contact location step, instant bottle (avg amount) and diaper POSTs, 10s activity polling, baby switcher.
- All user-facing strings via `t()` from `@/src/context/localization`; keys = English text; add to `src/localization/translations/en.json` first; run `node scripts/check-missing-translations.js` after adding keys.
- No `dark:` Tailwind classes anywhere.
- Tests: vitest, `tests/*.test.ts`, node environment, `@/` alias = repo root. Run with `npx vitest run tests/<file>`.
- TypeScript strict; `npx tsc --noEmit` must pass at the end of every task (it's the fastest full-project check; `npm run build` only in the final task).
- All API responses `{ success, data?, error? }`; requests send `Authorization: Bearer <localStorage.authToken>`.
- All hit targets ≥44px. All animation behind `@media (prefers-reduced-motion: no-preference)` with static fallbacks rendering full content.
- `docs/` is gitignored — plan/spec live under `documentation/`.

---

### Task 1: Ship nursery art assets + sprite manifest

**Files:**
- Create: `public/nursery/sprites/<set>/<pose>.svg` (copied — 11 sets)
- Create: `public/nursery/rugs/{paisley-1,paisley-2,paisley-3,rug-1,rug-2}.svg` (copied)
- Create: `src/components/features/nursery-mode/spriteManifest.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SpritePose { file: string; label: string }
  export interface SpriteSet { id: string; label: string; poses: SpritePose[] }
  export const SPRITE_SETS: SpriteSet[]                       // 11 sets, order below
  export const RUGS: { id: string; label: string; file: string }[]  // 5 rugs
  export const spriteUrl: (setId: string, file: string) => string   // /nursery/sprites/<set>/<file>
  export const rugUrl: (file: string) => string                     // /nursery/rugs/<file>
  export const spriteSetById: (id: string) => SpriteSet | undefined
  ```

- [ ] **Step 1: Copy assets**

```bash
cd /Users/johnoverton/Development/docker_builds/sprout-track_old
mkdir -p public/nursery/rugs
cp -R "documentation/temp-development-docs/sprout-track-nursery/patterns/sprites/extracted" public/nursery/sprites
cp documentation/temp-development-docs/sprout-track-nursery/patterns/rugs/*.svg public/nursery/rugs/
ls public/nursery/sprites   # expect 11 dirs: balls butterflies cars fairies flowers kittens puppies rockets stars teddy unicorns
ls public/nursery/rugs      # expect 5 svg files
```

- [ ] **Step 2: Write the manifest** — `src/components/features/nursery-mode/spriteManifest.ts`. Set order and labels are fixed (PRD §5.3): Teddy Bears, Kittens, Puppies, Unicorns, Butterflies, Flowers, Rockets, Cars, Sports Balls, Stars, Fairies. Pose `file` = filename with extension; `label` = filename humanized (`paw-raised.svg` → `Paw raised`). Generate the pose lists from the actual directory contents (`ls public/nursery/sprites/<set>`), e.g.:

```ts
export interface SpritePose { file: string; label: string }
export interface SpriteSet { id: string; label: string; poses: SpritePose[] }

export const SPRITE_SETS: SpriteSet[] = [
  { id: 'teddy', label: 'Teddy Bears', poses: [
    { file: 'hugging.svg', label: 'Hugging' },
    { file: 'lying-down.svg', label: 'Lying down' },
    { file: 'side-view.svg', label: 'Side view' },
    { file: 'sitting-1.svg', label: 'Sitting 1' },
    { file: 'sitting-2.svg', label: 'Sitting 2' },
    { file: 'waving.svg', label: 'Waving' },
  ]},
  { id: 'kittens', label: 'Kittens', poses: [/* from ls: back-view, lying-curled, lying-down, paw-raised, sitting, stretching */] },
  { id: 'puppies', label: 'Puppies', poses: [/* head-tilted, play-bow, rolling-over, sitting, sleeping, standing */] },
  { id: 'unicorns', label: 'Unicorns', poses: [/* grazing, jumping, lying-down, rearing, sitting, standing */] },
  { id: 'butterflies', label: 'Butterflies', poses: [/* open-wings-1, open-wings-2, side-view-1, side-view-2, small, swallowtail */] },
  { id: 'flowers', label: 'Flowers', poses: [/* blossom-with-stem, daisy, daisy-tilted, leaf, sprig, tulip */] },
  { id: 'rockets', label: 'Rockets', poses: [/* flying-diagonal, flying-right, flying-tilted, flying-up-1, flying-up-2, launching */] },
  { id: 'cars', label: 'Cars', poses: [/* bus, compact-car, compact-car-tilted, pickup-truck, race-car, van */] },
  { id: 'balls', label: 'Sports Balls', poses: [/* baseball-1, baseball-2, basketball-1, basketball-2, football-1, football-2, soccer-1, soccer-2 */] },
  { id: 'stars', label: 'Stars', poses: [/* classic, rounded, shooting, smiley, sparkle, tilted */] },
  { id: 'fairies', label: 'Fairies', poses: [/* back-view, casting-spell, flying-right, flying-swoop, sitting, standing-wand-up */] },
];

export const RUGS = [
  { id: 'rug:paisley-1', label: 'Classic Paisley', file: 'paisley-1.svg' },
  { id: 'rug:paisley-2', label: 'Trailing Paisley', file: 'paisley-2.svg' },
  { id: 'rug:paisley-3', label: 'Garden Paisley', file: 'paisley-3.svg' },
  { id: 'rug:rug-1', label: 'Medallion Rug', file: 'rug-1.svg' },
  { id: 'rug:rug-2', label: 'Heirloom Rug', file: 'rug-2.svg' },
];

export const spriteUrl = (setId: string, file: string) => `/nursery/sprites/${setId}/${file}`;
export const rugUrl = (file: string) => `/nursery/rugs/${file}`;
export const spriteSetById = (id: string) => SPRITE_SETS.find(s => s.id === id);
```

Fill every `/* ... */` with real `{file, label}` entries — no placeholders may remain.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` passes; every `poses[].file` exists on disk:

```bash
node -e "
const m=require('./src/components/features/nursery-mode/spriteManifest.ts');" 2>/dev/null || npx tsx -e "
import {SPRITE_SETS, RUGS} from './src/components/features/nursery-mode/spriteManifest';
import {existsSync} from 'fs';
for (const s of SPRITE_SETS) for (const p of s.poses) { const f='public/nursery/sprites/'+s.id+'/'+p.file; if(!existsSync(f)) throw new Error(f); }
for (const r of RUGS) { const f='public/nursery/rugs/'+r.file; if(!existsSync(f)) throw new Error(f); }
console.log('all assets present');
"
```

Expected: `all assets present`

- [ ] **Step 4: Commit**

```bash
git add public/nursery src/components/features/nursery-mode/spriteManifest.ts
git commit -m "feat(nursery): ship sprite/rug artwork and sprite manifest"
```

---

### Task 2: Pure color math (`colorMath.ts`)

**Files:**
- Create: `src/utils/nursery/colorMath.ts`
- Test: `tests/nursery-color-math.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type HSL = [number, number, number];            // h,s,l all 0–1
  export function hex2hsl(hex: string): HSL;
  export function hsl2hex(h: number, s: number, l: number): string;  // lowercase #rrggbb
  export function colorLuminance(color: string): number; // '#rrggbb' or 'rgb(r, g, b)' → 0–1 (0.299r+0.587g+0.114b)/255
  export function mapTargetColor(p: number, base: string, colors: string[]): string; // p>=0.8→base else colors[floor(p/0.8*len)] clamped
  export function toneMapped(targetHex: string, grey: number): string; // hsl2hex(th, ts, 0.55*grey + 0.45*tl)
  export function backdropTint(baseHex: string): string; // hsl2hex(h, min(1, s*1.15), l>0.5 ? l-0.06 : l+0.06)
  export function autoIconColor(hue: number): string;    // `oklch(0.9 0.11 ${(hue+150)%360})`
  export const COLOR_RE: RegExp;                          // /#[0-9a-fA-F]{6}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g
  ```

The implementations are direct ports of `nursery.jsx` lines 61–66 (hex2hsl, hsl2hex, COLOR_RE, parseRGB, mapTarget) — keep the math identical, add types.

- [ ] **Step 1: Write failing tests** — `tests/nursery-color-math.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  hex2hsl, hsl2hex, colorLuminance, mapTargetColor, toneMapped, backdropTint, autoIconColor, COLOR_RE,
} from '@/src/utils/nursery/colorMath';

describe('hex2hsl / hsl2hex', () => {
  it('roundtrips primary colors', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#f2e9d8', '#3a6ea5']) {
      const [h, s, l] = hex2hsl(hex);
      expect(hsl2hex(h, s, l)).toBe(hex);
    }
  });
  it('handles achromatic', () => {
    expect(hex2hsl('#808080')[1]).toBe(0);
    expect(hsl2hex(0, 0, 0.5)).toBe('#808080');
  });
});

describe('colorLuminance', () => {
  it('orders black < grey < white', () => {
    expect(colorLuminance('#000000')).toBe(0);
    expect(colorLuminance('#ffffff')).toBe(1);
    expect(colorLuminance('#808080')).toBeGreaterThan(0.4);
    expect(colorLuminance('#808080')).toBeLessThan(0.6);
  });
  it('parses rgb() form', () => {
    expect(colorLuminance('rgb(255, 255, 255)')).toBe(1);
  });
});

describe('mapTargetColor', () => {
  const base = '#f2e9d8';
  const cols = ['#111111', '#222222', '#333333', '#444444', '#555555'];
  it('maps lightest 20% to base', () => {
    expect(mapTargetColor(0.8, base, cols)).toBe(base);
    expect(mapTargetColor(1, base, cols)).toBe(base);
  });
  it('maps darker bands onto pattern colors in order', () => {
    expect(mapTargetColor(0, base, cols)).toBe(cols[0]);
    expect(mapTargetColor(0.79, base, cols)).toBe(cols[4]);
    expect(mapTargetColor(0.4, base, cols)).toBe(cols[2]);
  });
});

describe('toneMapped', () => {
  it('keeps hue/sat of target and blends lightness', () => {
    const out = toneMapped('#3a6ea5', 1); // grey=1 → l = 0.55 + 0.45*targetL
    const [th, ts] = hex2hsl('#3a6ea5');
    const [oh, os, ol] = hex2hsl(out);
    expect(oh).toBeCloseTo(th, 1);
    expect(os).toBeCloseTo(ts, 1);
    expect(ol).toBeGreaterThan(hex2hsl('#3a6ea5')[2]);
  });
});

describe('backdropTint', () => {
  it('darkens light bases and lightens dark bases', () => {
    expect(hex2hsl(backdropTint('#f2e9d8'))[2]).toBeLessThan(hex2hsl('#f2e9d8')[2]);
    expect(hex2hsl(backdropTint('#20242c'))[2]).toBeGreaterThan(hex2hsl('#20242c')[2]);
  });
});

describe('autoIconColor', () => {
  it('offsets hue by 150 and wraps', () => {
    expect(autoIconColor(248)).toBe('oklch(0.9 0.11 38)');
    expect(autoIconColor(0)).toBe('oklch(0.9 0.11 150)');
  });
});

describe('COLOR_RE', () => {
  it('finds hex and rgb colors in svg text', () => {
    const m = '<path fill="#A1B2C3"/><stop stop-color="rgb(1, 2, 3)"/>'.match(COLOR_RE);
    expect(m).toEqual(['#A1B2C3', 'rgb(1, 2, 3)']);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/nursery-color-math.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `src/utils/nursery/colorMath.ts` (port of nursery.jsx:61–66 + helpers):

```ts
export type HSL = [number, number, number];

export const COLOR_RE = /#[0-9a-fA-F]{6}\b|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;

const parseRGB = (c: string): [number, number, number] =>
  c[0] === '#'
    ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    : ((c.match(/\d+/g) || []).map(Number) as [number, number, number]);

export function hex2hsl(hex: string): HSL {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return [h, s, l];
}

export function hsl2hex(h: number, s: number, l: number): string {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255).toString(16).padStart(2, '0');
  };
  return '#' + f(0) + f(8) + f(4);
}

export function colorLuminance(color: string): number {
  const [r, g, b] = parseRGB(color);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function mapTargetColor(p: number, base: string, colors: string[]): string {
  return p >= 0.8 ? base : colors[Math.min(colors.length - 1, Math.floor((p / 0.8) * colors.length))];
}

export function toneMapped(targetHex: string, grey: number): string {
  const [th, ts, tl] = hex2hsl(targetHex);
  return hsl2hex(th, ts, 0.55 * grey + 0.45 * tl);
}

export function backdropTint(baseHex: string): string {
  const [h, s, l] = hex2hsl(baseHex);
  return hsl2hex(h, Math.min(1, s * 1.15), l > 0.5 ? l - 0.06 : l + 0.06);
}

export function autoIconColor(hue: number): string {
  return `oklch(0.9 0.11 ${(((hue + 150) % 360) + 360) % 360})`;
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/nursery-color-math.test.ts` → PASS. Note: if a roundtrip test fails by one bit (e.g. `#00ff00`), relax that assertion to compare parsed HSL within tolerance instead of exact string — do NOT change the math, it must stay identical to the prototype.

- [ ] **Step 5: Commit** — `git add src/utils/nursery/colorMath.ts tests/nursery-color-math.test.ts && git commit -m "feat(nursery): pure color math utils with tests"`

---

### Task 3: SVG text recolor (`recolorSvg.ts`)

**Files:**
- Create: `src/utils/nursery/recolorSvg.ts`
- Test: `tests/nursery-recolor-svg.test.ts`

**Interfaces:**
- Consumes: `COLOR_RE, colorLuminance, mapTargetColor, toneMapped` from `@/src/utils/nursery/colorMath`
- Produces: `export function recolorSvgText(svgText: string, base: string, colors: string[]): string`

Algorithm (port of nursery.jsx:78–97, minus fetch/cache): collect unique color tokens with `COLOR_RE`, sort by `colorLuminance`, position `p = i/(len-1)` (single color → p=1), target = `mapTargetColor(p, base, colors)`, replacement = `toneMapped(target, colorLuminance(original))`, then one-pass `text.replace(COLOR_RE, m => map[m] || m)`.

- [ ] **Step 1: Failing tests** — `tests/nursery-recolor-svg.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { recolorSvgText } from '@/src/utils/nursery/recolorSvg';
import { colorLuminance, COLOR_RE } from '@/src/utils/nursery/colorMath';

const BASE = '#f2e9d8';
const COLS = ['#3a6ea5', '#5f93c9', '#8fb4d9', '#b1492f', '#d67f65'];
const FIXTURE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">
<path fill="#191B20" d="M0 0h1"/><path fill="#5F6062" d="M0 0h2"/>
<path fill="#C3C3C3" d="M0 0h3"/><rect fill="rgb(230, 230, 230)" width="1" height="1"/>
</svg>`;

describe('recolorSvgText', () => {
  it('replaces every source color', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    expect(out).not.toContain('#191B20');
    expect(out).not.toContain('#5F6062');
    expect(out).not.toContain('#C3C3C3');
    expect(out).not.toContain('rgb(230, 230, 230)');
  });
  it('preserves luminance ordering (darker stays darker)', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    const outColors = out.match(COLOR_RE)!;
    expect(colorLuminance(outColors[0])).toBeLessThan(colorLuminance(outColors[2]));
  });
  it('maps the lightest tone toward the base color band', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    const outColors = out.match(COLOR_RE)!;
    // lightest source (rgb 230) → base target; tone-mapped lightness stays high
    expect(colorLuminance(outColors[3])).toBeGreaterThan(0.6);
  });
  it('leaves non-color text untouched', () => {
    const out = recolorSvgText(FIXTURE, BASE, COLS);
    expect(out).toContain('viewBox="0 0 10 10"');
    expect(out).toContain('d="M0 0h1"');
  });
  it('handles svg with a single color', () => {
    const out = recolorSvgText('<path fill="#333333"/>', BASE, COLS);
    expect(out).not.toContain('#333333');
  });
  it('returns input unchanged when no colors present', () => {
    expect(recolorSvgText('<g/>', BASE, COLS)).toBe('<g/>');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/nursery-recolor-svg.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/utils/nursery/recolorSvg.ts`:

```ts
import { COLOR_RE, colorLuminance, mapTargetColor, toneMapped } from './colorMath';

export function recolorSvgText(svgText: string, base: string, colors: string[]): string {
  const found = [...new Set(svgText.match(COLOR_RE) || [])];
  if (found.length === 0) return svgText;
  const sorted = [...found].sort((a, b) => colorLuminance(a) - colorLuminance(b));
  const map: Record<string, string> = {};
  sorted.forEach((c, i) => {
    const p = sorted.length > 1 ? i / (sorted.length - 1) : 1;
    map[c] = toneMapped(mapTargetColor(p, base, colors), colorLuminance(c));
  });
  return svgText.replace(COLOR_RE, m => map[m] || m);
}
```

- [ ] **Step 4: Run tests** — PASS expected.
- [ ] **Step 5: Commit** — `git commit -m "feat(nursery): svg text recolor engine with tests"` (add both files).

---

### Task 4: Placement algorithms (`placement.ts`)

**Files:**
- Create: `src/utils/nursery/placement.ts`
- Test: `tests/nursery-placement.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Rng = () => number;   // [0,1)
  export interface PlacedItem { x: number; y: number; r: number; w: number; ar: number; poseIndex: number; rot: number }
  // x,y = center in width-% units (y already multiplied out to the same unit space; see below)
  export interface ScatterOptions {
    poseARs: number[];        // aspect ratio (w/h) per pose
    areaAR?: number;          // stage aspect, default 16/9; vertical extent VH = 100/areaAR
    baseWidth: number;        // base item width in % (primary 8.6, accent 4.3)
    scaleMin: number; scaleMax: number;   // 0.62 / 1.3
    count: number;            // 17 primary, 16 accent
    rotMax: number;           // ±deg, 28
    maxTries?: number;        // default 2200
    existing?: PlacedItem[];  // accents avoid primaries
  }
  export function placeScatter(opts: ScatterOptions, rng: Rng): PlacedItem[];

  export interface OutlineItem extends PlacedItem {
    dx: number; dy: number; dur: number; delay: number; spin: number; r1: number;
  }
  export interface OutlineFieldOptions {
    poseARs: number[];
    count?: number;           // default 26
    sizeVariance: number;     // 0–100 slider; <=2 → uniform scale 1
  }
  export function placeOutlineField(opts: OutlineFieldOptions, rng: Rng): OutlineItem[];
  export function mulberry32(seed: number): Rng;   // for tests and per-mount seeding
  ```

Port the dart-throwing from nursery.jsx:176–208 (`throwDarts`) and 265–287 (OutlineField placement), replacing sheet boxes with `poseARs` (per-pose aspect ratio) and `Math.random()` with the injected `rng`. Keep pose weighting (weight ×0.4 after each use, weighted pick) for `placeScatter`. Collision: bounding circles `r = max(w, w/ar)/2 * 1.08 + 1.4` (scatter) / `r = max(w, w/ar)/2 + 1.6` (outline); reject when `dx²+dy² < (r1+r2)²`. Positions: `x ∈ [r, 100−r]`, `y ∈ [r, VH−r]` where `VH = 100/areaAR`. Extreme-aspect clamp: `if (w/ar > w*1.9) w *= (w*1.9)/(w/ar)`. Outline: `sc = sizeVariance<=2 ? 1 : 1+(rng()-0.5)*2*(sizeVariance/100)*0.75`, `w = 6.4*sc`, float params `dx,dy ∈ ±60`, `dur = 14+rng()*18`, `delay = -rng()*20`, `spin ∈ ±45`, `rot` stored as raw `r1 = rng()` (renderer computes degrees from the rotation slider so slider changes don't re-deal).

- [ ] **Step 1: Failing tests** — `tests/nursery-placement.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { placeScatter, placeOutlineField, mulberry32, PlacedItem } from '@/src/utils/nursery/placement';

const noOverlap = (items: PlacedItem[]) => {
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const dx = items[i].x - items[j].x, dy = items[i].y - items[j].y;
      if (dx * dx + dy * dy < (items[i].r + items[j].r) ** 2) return false;
    }
  return true;
};

describe('placeScatter', () => {
  const opts = { poseARs: [1, 0.8, 1.2], baseWidth: 8.6, scaleMin: 0.62, scaleMax: 1.3, count: 17, rotMax: 28 };
  it('places up to count items without overlap, deterministically', () => {
    const a = placeScatter(opts, mulberry32(42));
    const b = placeScatter(opts, mulberry32(42));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(17);
    expect(noOverlap(a)).toBe(true);
  });
  it('respects rotation and pose bounds', () => {
    for (const it2 of placeScatter(opts, mulberry32(7))) {
      expect(Math.abs(it2.rot)).toBeLessThanOrEqual(28);
      expect(it2.poseIndex).toBeGreaterThanOrEqual(0);
      expect(it2.poseIndex).toBeLessThan(3);
      expect(it2.x - it2.r).toBeGreaterThanOrEqual(-0.01);
      expect(it2.x + it2.r).toBeLessThanOrEqual(100.01);
    }
  });
  it('accents avoid existing primaries', () => {
    const rng = mulberry32(1);
    const prim = placeScatter(opts, rng);
    const acc = placeScatter({ ...opts, baseWidth: 4.3, count: 16, existing: prim }, rng);
    expect(noOverlap([...prim, ...acc])).toBe(true);
  });
  it('spreads poses via weight decay', () => {
    const items = placeScatter({ ...opts, count: 12 }, mulberry32(3));
    const used = new Set(items.map(i => i.poseIndex));
    expect(used.size).toBeGreaterThan(1);
  });
  it('handles empty poses and zero count', () => {
    expect(placeScatter({ ...opts, poseARs: [] }, mulberry32(1))).toEqual([]);
    expect(placeScatter({ ...opts, count: 0 }, mulberry32(1))).toEqual([]);
  });
});

describe('placeOutlineField', () => {
  it('is deterministic, collision-free, bounded', () => {
    const o = { poseARs: [1, 1.4], sizeVariance: 40 };
    const a = placeOutlineField(o, mulberry32(9));
    expect(a).toEqual(placeOutlineField(o, mulberry32(9)));
    expect(noOverlap(a)).toBe(true);
    expect(a.length).toBeLessThanOrEqual(26);
    for (const it2 of a) {
      expect(it2.r1).toBeGreaterThanOrEqual(0);
      expect(it2.r1).toBeLessThan(1);
      expect(it2.dur).toBeGreaterThanOrEqual(14);
    }
  });
  it('uniform size when variance <= 2', () => {
    const a = placeOutlineField({ poseARs: [1], sizeVariance: 0 }, mulberry32(5));
    expect(new Set(a.map(i => i.w)).size).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** `src/utils/nursery/placement.ts` per the algorithm description above (complete implementation — port loops verbatim, typed, rng-injected; include `mulberry32`):

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlacedItem { x: number; y: number; r: number; w: number; ar: number; poseIndex: number; rot: number }
export interface ScatterOptions {
  poseARs: number[]; areaAR?: number; baseWidth: number; scaleMin: number; scaleMax: number;
  count: number; rotMax: number; maxTries?: number; existing?: PlacedItem[];
}

export function placeScatter(opts: ScatterOptions, rng: Rng): PlacedItem[] {
  const { poseARs, baseWidth, scaleMin, scaleMax, count, rotMax } = opts;
  if (!poseARs.length || count <= 0) return [];
  const VH = 100 / (opts.areaAR ?? 16 / 9);
  const maxTries = opts.maxTries ?? 2200;
  const placed: PlacedItem[] = [];
  const all: PlacedItem[] = [...(opts.existing ?? [])];
  const weights = poseARs.map(() => 1);
  const pickIdx = () => {
    const tot = weights.reduce((a, b) => a + b, 0);
    let t = rng() * tot;
    for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t <= 0) return i; }
    return weights.length - 1;
  };
  let n = 0, tries = 0;
  while (n < count && tries < maxTries) {
    tries++;
    const idx = pickIdx();
    const ar = poseARs[idx];
    if (!(ar > 0)) continue;
    let w = baseWidth * (scaleMin + rng() * (scaleMax - scaleMin));
    if (w / ar > w * 1.9) w *= (w * 1.9) / (w / ar);
    const r = (Math.max(w, w / ar) / 2) * 1.08 + 1.4;
    if (2 * r > 100 || 2 * r > VH) continue;
    const x = r + rng() * (100 - 2 * r);
    const y = r + rng() * (VH - 2 * r);
    let hit = false;
    for (const p of all) {
      const dx = x - p.x, dy = y - p.y;
      if (dx * dx + dy * dy < (r + p.r) * (r + p.r)) { hit = true; break; }
    }
    if (hit) continue;
    const item: PlacedItem = { x, y, r, w, ar, poseIndex: idx, rot: Math.round(rng() * 2 * rotMax - rotMax) };
    placed.push(item); all.push(item);
    weights[idx] *= 0.4;
    n++;
  }
  return placed;
}

export interface OutlineItem extends PlacedItem { dx: number; dy: number; dur: number; delay: number; spin: number; r1: number }
export interface OutlineFieldOptions { poseARs: number[]; count?: number; sizeVariance: number }

export function placeOutlineField(opts: OutlineFieldOptions, rng: Rng): OutlineItem[] {
  const { poseARs, sizeVariance } = opts;
  if (!poseARs.length) return [];
  const count = opts.count ?? 26;
  const VH = 56.25;
  const placed: OutlineItem[] = [];
  let n = 0, tries = 0;
  while (n < count && tries < 1600) {
    tries++;
    const poseIndex = Math.floor(rng() * poseARs.length);
    const ar = poseARs[poseIndex];
    if (!(ar > 0)) continue;
    const sc = sizeVariance <= 2 ? 1 : 1 + (rng() - 0.5) * 2 * (sizeVariance / 100) * 0.75;
    const w = 6.4 * sc;
    const r = Math.max(w, w / ar) / 2 + 1.6;
    const x = r + rng() * (100 - 2 * r);
    const y = r + rng() * (VH - 2 * r);
    let hit = false;
    for (const q of placed) {
      const dx = x - q.x, dy = y - q.y;
      if (dx * dx + dy * dy < (r + q.r) * (r + q.r)) { hit = true; break; }
    }
    if (hit) continue;
    placed.push({
      x, y, r, w, ar, poseIndex, rot: 0,
      r1: rng(), dx: rng() * 120 - 60, dy: rng() * 120 - 60,
      dur: 14 + rng() * 18, delay: -rng() * 20, spin: rng() * 90 - 45,
    });
    n++;
  }
  return placed;
}
```

- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(nursery): deterministic scatter/outline placement with tests"`.

---

### Task 5: Settings model v1 (`settings.ts`)

**Files:**
- Create: `src/utils/nursery/settings.ts`
- Test: `tests/nursery-settings.test.ts`

**Interfaces:**
- Produces (exact shape used by API route, hook, container, drawer):
  ```ts
  export type NurseryScene = 'ambient' | 'starlit' | 'tapestry' | 'photo';
  export type NurseryLayout = 'cards' | 'tiles';
  export interface NurserySettings {
    v: 1;
    scene: NurseryScene; layout: NurseryLayout;
    hue: number; dim: number; sat: number; trans: number;
    iconShape: 'circle' | 'square'; iconColor: string | null;
    acts: { feed: boolean; pump: boolean; diaper: boolean; sleep: boolean };
    ambient: { pattern: string; auroraRange: number; waveMotion: number;
               bubbles: { count: number; min: number; max: number };
               rot: number; move: number; size: number };
    starlit: { density: number; aura: boolean };
    tapestry: { backdrop: string; primary: string | null; accent: string | null;
                palette: 'boys' | 'girls'; base: string;
                colors: [string, string, string, string, string] };
    photo: { src: string | null; autoTint: boolean };
  }
  export const NURSERY_DEFAULTS: NurserySettings;   // per PRD §9 sample: scene 'ambient', layout 'cards', hue 248, dim 46, sat 38, trans 58, iconShape 'square', iconColor null, all acts true, ambient {pattern:'aurora', auroraRange:50, waveMotion:40, bubbles:{count:24,min:10,max:48}, rot:20, move:0, size:40}, starlit {density:200, aura:true}, tapestry {backdrop:'vstripe', primary:'teddy', accent:'stars', palette:'boys', base:PALETTES.boys.base, colors:PALETTES.boys.colors}, photo {src:null, autoTint:true}
  export const PALETTES: Record<'boys' | 'girls', { base: string; colors: [string,string,string,string,string] }>;
  export const BASE_CHIPS: Record<'boys' | 'girls', string[]>;   // 6 each, from prototype nursery.jsx:40-42
  export const ICON_SWATCHES: (string | null)[]; // [null,'#f9c9d6','#fbd38d','#a7f3d0','#a5d8ff','#d8b4fe','#ffffff']
  export const AMBIENT_PATTERNS: string[]; // ['aurora','waves','bubbles'] — sprite patterns are 'sprite:<setId>'
  export const CSS_BACKDROPS: { id: string; label: string }[]; // plain,vstripe,hstripe,dstripe,zigzag,dots,checks,scallops with labels Plain, Pinstripe, Horizontal, Diagonal, Chevron, Dots, Blocks, Scallops
  export function normalizeNurserySettings(raw: unknown): NurserySettings;
  ```
- Legacy migration inside `normalizeNurserySettings`: input with `brightness`/`saturation`/`visibleTiles` and no `v` → `{ hue, dim: brightness, sat: saturation, acts: {feed: visibleTiles.includes('feed'), ...}, ...defaults }`. All numbers clamped (hue 0–360; dim/sat/trans/auroraRange/waveMotion/rot/move/size 0–100; starlit.density 30–400; bubbles.count 4–80, min 4–80, max 10–160). Unknown scene/layout/pattern/backdrop/palette → default value. `tapestry.colors` must be exactly 5 `#rrggbb` strings else palette default. Booleans coerced with `!!`. Non-object input → full defaults.

- [ ] **Step 1: Failing tests** — `tests/nursery-settings.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeNurserySettings, NURSERY_DEFAULTS, PALETTES } from '@/src/utils/nursery/settings';

describe('normalizeNurserySettings', () => {
  it('returns defaults for garbage input', () => {
    expect(normalizeNurserySettings(null)).toEqual(NURSERY_DEFAULTS);
    expect(normalizeNurserySettings('x')).toEqual(NURSERY_DEFAULTS);
    expect(normalizeNurserySettings({})).toEqual(NURSERY_DEFAULTS);
  });
  it('passes through a valid v1 object', () => {
    const s = { ...NURSERY_DEFAULTS, scene: 'starlit' as const, hue: 12 };
    expect(normalizeNurserySettings(s)).toEqual(s);
  });
  it('migrates legacy shape', () => {
    const out = normalizeNurserySettings({ hue: 230, brightness: 15, saturation: 25, visibleTiles: ['feed', 'sleep'] });
    expect(out.v).toBe(1);
    expect(out.hue).toBe(230);
    expect(out.dim).toBe(15);
    expect(out.sat).toBe(25);
    expect(out.acts).toEqual({ feed: true, pump: false, diaper: false, sleep: true });
    expect(out.scene).toBe('ambient');
  });
  it('clamps ranges', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, hue: 900, dim: -4, starlit: { density: 9999, aura: true } });
    expect(out.hue).toBe(360);
    expect(out.dim).toBe(0);
    expect(out.starlit.density).toBe(400);
  });
  it('falls back on unknown enums', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, scene: 'disco', layout: 'wall', iconShape: 'hex' });
    expect(out.scene).toBe('ambient');
    expect(out.layout).toBe('cards');
    expect(out.iconShape).toBe('square');
  });
  it('accepts sprite ambient patterns and rejects unknown ones', () => {
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, ambient: { ...NURSERY_DEFAULTS.ambient, pattern: 'sprite:teddy' } }).ambient.pattern).toBe('sprite:teddy');
    expect(normalizeNurserySettings({ ...NURSERY_DEFAULTS, ambient: { ...NURSERY_DEFAULTS.ambient, pattern: 'sprite:nope' } }).ambient.pattern).toBe('aurora');
  });
  it('repairs bad tapestry colors to palette defaults', () => {
    const out = normalizeNurserySettings({ ...NURSERY_DEFAULTS, tapestry: { ...NURSERY_DEFAULTS.tapestry, palette: 'girls', colors: ['red'] } });
    expect(out.tapestry.colors).toEqual(PALETTES.girls.colors);
  });
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** Notes: sprite pattern validation needs the set ids — import `SPRITE_SETS` from `@/src/components/features/nursery-mode/spriteManifest` (pure data, safe server-side) and validate `sprite:<id>`; rug backdrops validate against `RUGS` ids plus `CSS_BACKDROPS` ids. Write small helpers `clamp(n, lo, hi, dflt)`, `oneOf(v, allowed, dflt)`, `isHex6(s)`.
- [ ] **Step 4: Run tests** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(nursery): v1 settings model, palettes, normalize + legacy migration"`.

---

### Task 6: Dominant color sampling (`dominantColor.ts`)

**Files:**
- Create: `src/utils/nursery/dominantColor.ts`
- Test: `tests/nursery-dominant-color.test.ts`

**Interfaces:**
- Consumes: `hsl2hex` from colorMath.
- Produces:
  ```ts
  export interface DominantTint { hue: number; tint: string }  // hue 0–360; tint = light contrasting hex at fixed lightness
  export function dominantTintFromPixels(data: Uint8ClampedArray | number[]): DominantTint;
  ```
- Algorithm: iterate RGBA pixels (stride 4, skip alpha < 128); convert to HSL; skip near-greys (s < 0.15); accumulate weight `s * (1 - Math.abs(l - 0.5))` into 24 hue buckets (15° each); dominant bucket → hue = bucket center; tint = `hsl2hex(hue/360, 0.45, 0.86)`. If no chromatic pixels, return `{ hue: 248, tint: hsl2hex(248/360, 0.2, 0.86) }` (neutral fallback).

- [ ] **Step 1: Failing tests:**

```ts
import { describe, it, expect } from 'vitest';
import { dominantTintFromPixels } from '@/src/utils/nursery/dominantColor';

const px = (rgb: [number, number, number], n: number) => Array.from({ length: n }, () => [...rgb, 255]).flat();

describe('dominantTintFromPixels', () => {
  it('finds the hue of a solid color', () => {
    const { hue } = dominantTintFromPixels(px([255, 0, 0], 64));
    expect(hue).toBeGreaterThanOrEqual(0);
    expect(hue).toBeLessThan(30);
  });
  it('majority color wins', () => {
    const { hue } = dominantTintFromPixels([...px([0, 0, 255], 60), ...px([255, 0, 0], 10)]);
    expect(hue).toBeGreaterThan(200);
    expect(hue).toBeLessThan(270);
  });
  it('greyscale input returns neutral fallback', () => {
    const { hue, tint } = dominantTintFromPixels(px([128, 128, 128], 64));
    expect(hue).toBe(248);
    expect(tint).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('ignores transparent pixels', () => {
    const data = [...px([255, 0, 0], 8)];
    for (let i = 3; i < data.length; i += 4) data[i] = 0; // all transparent
    expect(dominantTintFromPixels(data).hue).toBe(248);
  });
  it('tint is light', () => {
    const { tint } = dominantTintFromPixels(px([0, 200, 80], 64));
    const l = parseInt(tint.slice(1, 3), 16) + parseInt(tint.slice(3, 5), 16) + parseInt(tint.slice(5, 7), 16);
    expect(l / 3).toBeGreaterThan(160);
  });
});
```

- [ ] **Step 2: verify failure. Step 3: implement per algorithm. Step 4: PASS. Step 5: Commit** — `git commit -m "feat(nursery): dominant color sampling for photo auto-tint"`.

---

### Task 7: Settings persistence — API route v1 + hook rewrite

**Files:**
- Modify: `app/api/nursery-mode-settings/route.ts` (full rewrite of body handling)
- Modify: `src/hooks/useNurserySettings.ts` (full rewrite)

**Interfaces:**
- Consumes: `normalizeNurserySettings, NurserySettings, NURSERY_DEFAULTS` from `@/src/utils/nursery/settings`.
- Produces (hook — consumed by container/drawer):
  ```ts
  export function useNurserySettings(): {
    settings: NurserySettings;
    isLoading: boolean;
    updateSettings: (patch: Partial<NurserySettings>) => void;  // optimistic + debounced 500ms POST
  }
  ```
- Route behavior:
  - GET: unchanged cascade (caretaker → global → defaults) but every returned bucket passes through `normalizeNurserySettings` (this transparently migrates legacy buckets). Response `data` = `NurserySettings`.
  - POST: body `{ caretakerId?: string | null, settings?: unknown, ...legacyFields }`. If `body.settings` present → `normalizeNurserySettings(body.settings)`; else → `normalizeNurserySettings(body)` (legacy clients). Reject non-object body with 400. Store normalized JSON under `caretakerId || 'global'` in the same blob; keep the existing auto-create of the Settings row. Response `data` = stored `NurserySettings`.
- Hook behavior: reads `localStorage.caretakerId` (may be null → global bucket); on mount, hydrate synchronously from `localStorage['nurseryModeSettingsV1']` (JSON, normalized) so first paint is instant, then fetch GET `?caretakerId=` and reconcile; `window.addEventListener('focus', refetch)` (PRD: re-read on focus); `updateSettings(patch)` merges into current, normalizes, sets state, mirrors to localStorage, debounced POST `{ caretakerId, settings }`. Send full normalized object every save.

- [ ] **Step 1: Rewrite the route** per above (keep `withAuthContext`, familyId 403 check, Settings row auto-create block verbatim).
- [ ] **Step 2: Rewrite the hook** per above.
- [ ] **Step 3: Verify** — `npx vitest run tests/nursery-settings.test.ts` still PASS; `npx tsc --noEmit` → NurseryModeContainer will now have type errors against the new hook signature. To keep the tree green mid-plan, add a temporary compatibility shim INSIDE `NurseryModeContainer.tsx` at its top:

```ts
// TEMP during nursery redesign (removed in Task 11): adapt old container to v1 settings
```

and map `settings.dim`→brightness, `settings.sat`→saturation, `acts`→visibleTiles array, and replace `saveSettings(...)` calls with `updateSettings({...})` patches. Keep the old visual behavior working (hue/dim/sat sliders + tile toggles still function through the new model).
- [ ] **Step 4: Manual check** — `npx tsc --noEmit` passes.
- [ ] **Step 5: Commit** — `git commit -m "feat(nursery): v1 settings persistence (route + hook, caretaker bucket, localStorage mirror)"`.

---

### Task 8: Client recolor engine (fetch caches, blob URLs, outline tracing)

**Files:**
- Create: `src/components/features/nursery-mode/engine/recolorCache.ts`
- Create: `src/components/features/nursery-mode/engine/useRecoloredAsset.ts`
- Create: `src/components/features/nursery-mode/engine/useOutlineSprites.ts`

**Interfaces:**
- Consumes: `recolorSvgText`, colorMath, `spriteUrl/rugUrl/spriteSetById` (Task 1).
- Produces:
  ```ts
  // recolorCache.ts
  export function fetchSvgText(url: string): Promise<string>;            // memoized per url
  export function svgAspectRatio(svgText: string): number;               // parse viewBox → w/h, fallback 1
  export function recoloredSvgUrl(url: string, base: string, colors: string[]): Promise<{ objectUrl: string; ar: number }>; // memoized per `${url}|${base}|${colors.join()}`
  export function outlineSpriteUrl(url: string, hue: number): Promise<{ objectUrl: string; ar: number }>; // memoized per `${url}|${hue}`

  // useRecoloredAsset.ts
  export function useRecoloredAsset(url: string | null, base: string, colors: string[]): { objectUrl: string; ar: number } | null;

  // useOutlineSprites.ts — all poses of a set, outline-traced + tinted
  export function useOutlineSprites(setId: string | null, hue: number): { urls: string[]; ars: number[] } | null;
  ```
- `recoloredSvgUrl`: fetch text → `recolorSvgText` → `URL.createObjectURL(new Blob([out], {type:'image/svg+xml'}))`. Cache promises (not results) to dedupe concurrent calls. Never revoke (session-lifetime cache, matches prototype).
- `outlineSpriteUrl` (canvas; port of nursery.jsx processOutline 223–255, simplified for transparent-background single sprites): load SVG into `Image` via object URL of fetched text (set `img.width/height` from viewBox, rasterize at width ≤ 320px), draw to canvas, read ImageData. `bg[p] = alpha < 24`. Luminance per opaque pixel; edge = opaque pixel adjacent to bg OR luminance step >24 vs right/below neighbor; dilate twice (3×3 cross); tint `hsl(hue, 45%, 86%)` at alpha 235, everything else transparent; export PNG blob URL.
- Hooks: standard `useEffect` + `live` flag pattern (see prototype useRecolored nursery.jsx:98–103); `useOutlineSprites` Promise.all over the set's poses.

- [ ] **Step 1: Implement the three files** per above.
- [ ] **Step 2: Verify** — `npx tsc --noEmit` passes (hooks are exercised visually in Tasks 9–10; core transforms already unit-tested).
- [ ] **Step 3: Commit** — `git commit -m "feat(nursery): client recolor engine (svg blob cache + outline tracer)"`.

---

### Task 9: Stage CSS, fonts, icons, ClockBlock + SceneBackground with Ambient & Starlit scenes

**Files:**
- Create: `src/components/features/nursery-mode/nursery.css`
- Create: `src/components/features/nursery-mode/icons.tsx`
- Create: `src/components/features/nursery-mode/ClockBlock.tsx`
- Create: `src/components/features/nursery-mode/scenes/SceneBackground.tsx`
- Create: `src/components/features/nursery-mode/scenes/AmbientScene.tsx`
- Create: `src/components/features/nursery-mode/scenes/StarlitScene.tsx`
- Modify: `app/(nursery)/[slug]/nursery-mode/layout.tsx` (Newsreader font)

**Interfaces:**
- Consumes: placement (Task 4), engine (Task 8), settings types (Task 5), colorMath.
- Produces:
  ```tsx
  // icons.tsx — stroke icons from prototype nursery.jsx:9-16
  export type IconName = 'bottle' | 'pump' | 'diaper' | 'moon' | 'image' | 'star';
  export function Icon({ n, s }: { n: IconName; s?: number }): JSX.Element;

  // ClockBlock.tsx
  export function ClockBlock(props: {
    babyName: string; babies: { id: string; firstName: string }[];
    onSelectBaby: (id: string) => void; compact?: boolean;
  }): JSX.Element;   // serif time via useTimezone().timeFormat + formatTimeDisplay,
                     // italic tappable name w/ dropdown when babies.length>1, uppercase locale date

  // SceneBackground.tsx — the only scene entry point the container uses
  export function SceneBackground({ settings, photoObjectUrl }:
    { settings: NurserySettings; photoObjectUrl?: string | null }): JSX.Element;
  // renders <div className="nursery-bg" style={{filter}}> with the active scene inside;
  // filter = `brightness(${(0.32 + dim/100*0.78).toFixed(2)}) saturate(${(sat/100*1.9).toFixed(2)})`
  // photo scene placeholder until Task 13 (renders base gradient when photoObjectUrl is null)
  ```
- `nursery.css`: port prototype CSS (nursery-mode.html lines 21–111 stage/scenes/foreground + 191–204 mobile) with class names prefixed `nursery-` (`.stage`→`.nursery-stage`, `.bg`→`.nursery-bg`, `.fg`→`.nursery-fg`, `.blob`, `.stars`, `.aura`, `.ab`, `.waves-layer`, `.motifs`, `.scatter`, `.bubbles`, `.scrim`, `.pattern-layer`, `.clock`, `.date`, `.grid`, `.card`, `.abtn`, `.badge`, `.tilegrid`, `.tile`, `.footer`, `.ghost` → all `nursery-*`). Keyframes keep `nursery-` prefixed names. `.nursery-serif { font-family: var(--font-newsreader), Georgia, serif; }`. Keep every `@media (prefers-reduced-motion:...)` guard.
- `AmbientScene`: port Background ambient branches (nursery.jsx:389–403) — aurora blobs (hue offsets scaled by `auroraRange`), waves (`wavesUri(hue)` data-URI generator + rock animation vars), bubbles (generate via `useMemo` on count/min/max), sprite outline field (`useOutlineSprites` + `placeOutlineField` with `mulberry32(seed)` seeded once per mount via `useMemo(() => Math.floor(Math.random()*2**31), [])`; renderer computes rotation degrees `((r1-0.5)*2*rot*1.8)` and float CSS vars exactly as nursery.jsx:290–299).
- `StarlitScene`: port nursery.jsx:378–388 (+ stars/aura CSS already in nursery.css). Star array `useMemo` keyed on density.
- Layout font:

```tsx
import { Newsreader } from 'next/font/google';
const newsreader = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-newsreader' });
// wrap existing content: <div className={`${newsreader.variable} ...existing classes`}>
```

- [ ] **Step 1: Write `nursery.css`** (full port, prefixed).
- [ ] **Step 2: Write `icons.tsx`** (exact paths from nursery.jsx:9–16).
- [ ] **Step 3: Write `ClockBlock.tsx`** — reuse date/time logic from old `Clock.tsx` (formatTimeDisplay, locale date) but mockup markup: `.nursery-clock` with `.nursery-serif .time` + italic `.name` button + `.nursery-date`. Baby dropdown = restyled port of the old switcher (overlay button + absolute list, glass background `rgba(20,22,31,.92)`, blur). All strings through `t()`.
- [ ] **Step 4: Write scenes** (SceneBackground dispatcher + Ambient + Starlit).
- [ ] **Step 5: Wire minimal render** — do NOT rewrite the container yet; only import `./nursery.css` in `NurseryModeContainer.tsx` and add the font variable in the layout so CSS/font ship. `npx tsc --noEmit` passes.
- [ ] **Step 6: Add new i18n keys** used by ClockBlock (if any beyond existing) to `en.json`; run `node scripts/check-missing-translations.js`.
- [ ] **Step 7: Commit** — `git commit -m "feat(nursery): stage css, icons, clock block, ambient + starlit scenes"`.

---

### Task 10: Tapestry scene (backdrops, ScatterLayer, rugs)

**Files:**
- Create: `src/components/features/nursery-mode/scenes/TapestryScene.tsx`
- Create: `src/components/features/nursery-mode/scenes/ScatterLayer.tsx`
- Create: `src/components/features/nursery-mode/scenes/backdropStyle.ts`
- Modify: `src/components/features/nursery-mode/scenes/SceneBackground.tsx` (add tapestry branch)

**Interfaces:**
- Consumes: `backdropTint` (colorMath), `useRecoloredAsset` (per-pose sprites + rugs), `placeScatter` + `mulberry32`, manifest.
- Produces:
  ```ts
  // backdropStyle.ts — pure, exact port of nursery.jsx:49-60 using backdropTint
  export function backdropStyle(kind: string, baseHex: string): React.CSSProperties;
  export const isRug = (id: string) => id.startsWith('rug:');

  // ScatterLayer.tsx
  export function ScatterLayer(props: { primary: string | null; accent: string | null; base: string; colors: string[] }): JSX.Element | null;
  ```
- ScatterLayer flow: for each of primary/accent set → load all poses via `Promise.all(poses.map(p => recoloredSvgUrl(spriteUrl(set, p.file), base, colors)))` in an effect (store `{urls, ars}` state); when primary loaded → `placeScatter({poseARs, baseWidth: 8.6, scaleMin: 0.62, scaleMax: 1.3, count: 17, rotMax: 28}, rng)`, then accent with `baseWidth: 4.3, count: 16, existing: primaryItems` and the same rng chain (`useMemo` seed per mount + per set change). Render `<img>`-less divs: `backgroundImage: url(objectUrl)`, `backgroundSize: 'contain'`, position `left: x%`, `top: (y * areaAR-adjustment)` — since placement y is in width-% against `VH = 100/areaAR`, render `top: (y * (16/9)).toFixed(2) + '%'` exactly like the prototype (nursery.jsx:214), `width: w%`, `aspectRatio: ar`, `transform: translate(-50%,-50%) rotate(rot deg)`.
- TapestryScene: rug backdrop → `useRecoloredAsset(rugUrl(file), base, colors)` cover div; CSS backdrop → `backdropStyle`; then `<ScatterLayer/>`; then scrim `radial-gradient(125% 95% at 50% 42%, rgba(28,20,10,.14), rgba(14,10,16,.5))`.

- [ ] **Step 1: Implement `backdropStyle.ts`** (port all 8 branches verbatim).
- [ ] **Step 2: Implement `ScatterLayer.tsx` + `TapestryScene.tsx`**; wire into `SceneBackground`.
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test` still green.
- [ ] **Step 4: Commit** — `git commit -m "feat(nursery): tapestry scene with recolored backdrops, rugs and sprite scatter"`.

---

### Task 11: Activity hooks + Cards/Big Tiles layouts + undo toast + container rewrite

This is the integration task: the container is rewritten to the mockup structure and the old tile files die. Activity state machines move verbatim.

**Files:**
- Create: `src/components/features/nursery-mode/activities/types.ts`
- Create: `src/components/features/nursery-mode/activities/useFeedActions.ts` (from `FeedTile.tsx`)
- Create: `src/components/features/nursery-mode/activities/usePumpActions.ts` (from `PumpTile.tsx`)
- Create: `src/components/features/nursery-mode/activities/useDiaperActions.ts` (from `DiaperTile.tsx`)
- Create: `src/components/features/nursery-mode/activities/useSleepActions.ts` (from `SleepTile.tsx`)
- Create: `src/components/features/nursery-mode/activities/ActivityCard.tsx`
- Create: `src/components/features/nursery-mode/activities/BigTile.tsx`
- Create: `src/components/features/nursery-mode/activities/UndoToast.tsx`
- Rewrite: `src/components/features/nursery-mode/NurseryModeContainer.tsx`
- Delete: `TileShell.tsx`, `SubButton.tsx`, `FeedTile.tsx`, `PumpTile.tsx`, `DiaperTile.tsx`, `SleepTile.tsx`, `Clock.tsx`, `SettingsDrawer.tsx` is NOT deleted yet (Task 12 replaces it — for this task, keep the old drawer file but stop importing it; render a minimal inline placeholder drawer with just Exit-able overlay + hue/dim/sat sliders + activity toggles so the screen stays configurable between commits; Task 12 replaces it)
- Delete: `nursery-animations.css` (keyframes now in nursery.css)

**Interfaces:**
- Produces:
  ```ts
  // types.ts
  export interface ActionButton { key: string; label: string; onClick: () => void; disabled?: boolean; emphasized?: boolean; timerText?: string; wide?: boolean }
  export interface ActivityView {
    id: 'feed' | 'pump' | 'diaper' | 'sleep';
    icon: IconName;                       // bottle | pump | diaper | moon
    label: string;                        // localized
    statusText: string | null;            // active timer line, e.g. "Left Side — 4:12 · L: 4:12 R: 0:00"
    active: boolean;                      // a timer/session is running
    buttons: ActionButton[];
  }
  export interface UndoInfo { id: string; endpoint: string; message: string }  // endpoint e.g. '/api/diaper-log'
  export interface ActivityHookArgs {
    babyId: string; toUTCString: (d: Date | null | undefined) => string | null;
    onLog: (tileId: string, note: string) => void;
    onUndoable: (u: UndoInfo) => void;    // instant logs only (bottle, diaper)
    enableBreastMilkTracking?: boolean;
  }
  export function useFeedActions(args: ActivityHookArgs): ActivityView;   // etc. for pump/diaper/sleep
  ```
- Hook transplant rules: copy each old tile's state, effects and callbacks 1:1 (same endpoints, same payloads, same phase machines, same `formatDuration`s — move shared `formatDuration` into `activities/types.ts` as `formatMMSS(seconds)` / `formatHMMSS(seconds)`), then return `ActivityView` instead of JSX. Bottle POST and diaper POST additionally read `data.data.id` from the response and call `onUndoable({ id, endpoint: '/api/feed-log' | '/api/diaper-log', message: t('Bottle logged') / t('Wet diaper logged') / t('Dirty diaper logged') / t('Diaper logged') })`. Sleep keeps `selecting_location` phase: idle → `[Start Sleep]`; selecting → `[Crib, Contact]`; sleeping → `[Wake Up (emphasized, timerText)]`.
- `ActivityCard` (mockup card): badge (`.nursery-badge`, shape + `--ifg` icon color, sizes 54/26), `<h3>` label, right meta (serif italic time + detail from `log`), `statusText` (replaces meta line when active), buttons row (`.nursery-abtn`, `wide` when single button).
- `BigTile`: square tile (badge 82/36, label, meta time); tap → opens overlay (fixed, centered glass panel listing the same `buttons` + a Close ghost button; when `active`, tile shows `statusText` under the label). Overlay closes after any button tap.
- `UndoToast`: fixed bottom-center glass pill, `message · Undo`, auto-dismiss 6s (`setTimeout`, cleared on new toast/unmount). `onUndo` → `DELETE ${endpoint}?id=${id}` with auth header → on success call `props.onUndone()`.
- Container rewrite (`NurseryModeContainer.tsx`, target < 400 lines — orchestration only):
  - Keep verbatim: babies fetch/auto-select, family settings fetch (`enableBreastMilkTracking`), 10s polling block (extract into `usePollLogs(babyId, t)` inside the container file or keep inline — keep inline to minimize churn), wake lock, fullscreen, exit handler, isLandscape/isMobile media queries.
  - New render tree (mockup nursery.jsx:454–503): `.nursery-stage` (CSS vars `--cardbg/--btnbg/--cardline/--btnline` from `trans` formulas: `cardBg=(0.16-trans/100*0.15)`, `btnBg=(0.2-trans/100*0.16)`, `line=(0.24-trans/100*0.16)`) → `<SceneBackground settings={settings}/>` → `.nursery-fg` → topbar (ghost Settings/Exit) → `.nursery-center` → `<ClockBlock/>` → cards `.nursery-grid` (or `.nursery-tilegrid` for tiles layout; add `two` class when ≤2 visible) → footer (NURSERY MODE + wake dot). Landscape ≤500px: ClockBlock `compact` inline in topbar, footer hidden (existing behavior).
  - Icon color: `settings.iconColor ?? autoIconColor(settings.hue)` (photo auto-tint arrives Task 13).
  - Undo state: `const [undo, setUndo] = useState<UndoInfo | null>(null)`; `onUndoable = setUndo`; after undo success → clear `logs[tileId]` and re-run the poll fetch immediately.
  - `acts` gate which activities render.
- i18n: add every new string to `en.json` (e.g. "Bottle logged", "Wet diaper logged", "Dirty diaper logged", "Diaper logged", "Undo", "Close", plus any missing labels) and run the check script.

- [ ] **Step 1: Create `types.ts` + the four `use*Actions` hooks** (verbatim transplants returning `ActivityView`).
- [ ] **Step 2: Create `ActivityCard`, `BigTile`, `UndoToast`.**
- [ ] **Step 3: Rewrite `NurseryModeContainer.tsx`**; delete dead files listed above; remove the Task 7 TEMP shim.
- [ ] **Step 4: Verify** — `npx tsc --noEmit` passes; `npm test` green; `grep -rn "TileShell\|SubButton\|nursery-animations" src app` returns nothing.
- [ ] **Step 5: i18n keys + script run.**
- [ ] **Step 6: Commit** — `git commit -m "feat(nursery): cards/big-tiles layouts, one-tap undo, container rewrite on scene stage"`.

---

### Task 12: Settings drawer rebuild

**Files:**
- Rewrite: `src/components/features/nursery-mode/SettingsDrawer.tsx`
- Create: `src/components/features/nursery-mode/drawer/SpriteThumb.tsx` (recolored + outline thumbnails)
- Modify: `src/components/features/nursery-mode/NurseryModeContainer.tsx` (swap placeholder drawer for the real one)
- Modify: `src/components/features/nursery-mode/nursery.css` (drawer styles — port mockup CSS lines 113–189)

**Interfaces:**
- Produces:
  ```ts
  export function SettingsDrawer(props: {
    open: boolean; onClose: () => void;
    settings: NurserySettings;
    updateSettings: (patch: Partial<NurserySettings>) => void;
    wakeLockActive: boolean; wakeLockSupported: boolean; onToggleWakeLock: () => void;
    fullscreenActive: boolean; fullscreenSupported: boolean; onToggleFullscreen: () => void;
    photosEnabled: boolean;      // Task 13 wires the picker; render section stub w/ note if false
  }): JSX.Element | null;
  ```
- Port the prototype `Settings` component (nursery.jsx:524–712) section by section — Scene previews (live gradient/starfield/backdrop mini-divs per `scenePrev`, nursery.jsx:508–512), Layout seg, Ambient background picker (3 patterns + 11 `SpriteThumb outline` thumbs) + contextual sliders (aurora range / wave motion / sprite rot-move-size / bubbles count-min-max), Tapestry section (8 backdrop swatches + 5 rug thumbs via `useRecoloredAsset`, Primary/Accent pickers with None + 11 `SpriteThumb recolored` thumbs, Boys/Girls seg → `applyPalette` sets palette+base+colors, base chips + custom `<input type="color">` well, 5 pattern color wells), Starlit section (aura toggle row + density slider), Photo section (stub button labelled with `t('Choose Photo')`, disabled note when `!photosEnabled` — replaced in Task 13), wake/fullscreen toggle cards, hue/dim/sat sliders, transparency slider, icon shape seg + swatches (`ICON_SWATCHES`), activity toggle rows.
- Rug-selection side effects (PRD §5.3): picking a rug → `updateSettings({ tapestry: {...t, backdrop, primary: null, accent: null} })`; picking a CSS backdrop when both objects are null AND user hasn't customized objects this session (`useRef(false)` set true on any manual object change) → restore `primary:'teddy', accent:'stars'`.
- `SpriteThumb`: `{ setId, mode: 'recolored' | 'outline', base?, colors?, hue?, selected, onClick, label }` — picks one random pose per mount (`useMemo(() => Math.random(), [setId])`), renders via `useRecoloredAsset`/`outlineSpriteUrl` over base color (recolored) or ambient gradient (outline).
- Every slider/segment writes `updateSettings` patches; all labels via `t()`.

- [ ] **Step 1: Port drawer CSS** into nursery.css (`.nursery-ovl`, `.nursery-drawer`, `.nursery-slabel`, `.nursery-seg`, `.nursery-srange`, `.nursery-patts`, `.nursery-patt`, `.nursery-scenes`, `.nursery-scene`, `.nursery-chips`, `.nursery-chip`, `.nursery-cwell`, `.nursery-sw`, `.nursery-swatches`, `.nursery-trow`, `.nursery-sw-toggle`, `.nursery-togcard`, `.nursery-tstate`, `.nursery-sval`, `.nursery-hue-track`).
- [ ] **Step 2: Implement `SpriteThumb` + `SettingsDrawer`.**
- [ ] **Step 3: Wire into container**, delete the placeholder drawer code.
- [ ] **Step 4: Verify** — `npx tsc --noEmit`; `npm test`.
- [ ] **Step 5: i18n keys** (Scene, Ambient, Starlit, Tapestry, Photo, Layout, Cards, Big Tiles, Background, Backdrop, Primary object, Accent object, Palette, Boys, Girls, Base color, Pattern colors, Star density, Aura, Color range, Motion, Rotation, Movement, Icon size, Bubbles, Min size, Max size, Button transparency, Icon shape, Icon color, Circle, Square, Activity tiles, sprite set labels, backdrop labels, rug labels, etc.) + script run.
- [ ] **Step 6: Commit** — `git commit -m "feat(nursery): full settings drawer (scenes, patterns, palette, icons, activities)"`.

---

### Task 13: Photo scene (gallery picker, upload, auto-tint)

**Files:**
- Create: `src/components/features/nursery-mode/scenes/PhotoScene.tsx`
- Create: `src/components/features/nursery-mode/PhotoPicker.tsx`
- Modify: `scenes/SceneBackground.tsx` (photo branch), `SettingsDrawer.tsx` (photo section), `NurseryModeContainer.tsx` (auto-tint wiring, photosEnabled probe)

**Interfaces:**
- Consumes: `useAuthedImage`, `photoFileUrl` from `@/src/hooks/useAuthedImage`; `/api/photos` list; `/api/photos/upload`; `dominantTintFromPixels`.
- Produces:
  ```ts
  export function PhotoScene(props: { photoId: string | null; hue: number; onTint?: (tint: string | null) => void; autoTint: boolean }): JSX.Element;
  export function PhotoPicker(props: { open: boolean; onClose: () => void; onPick: (photoId: string) => void }): JSX.Element | null;
  export const photoIdFromSrc = (src: string | null) => string | null; // 'gallery:abc'/'upload:abc' → 'abc'
  ```
- `PhotoScene`: `useAuthedImage(photoId ? photoFileUrl(photoId, 'full') : '', !!photoId)`; render cover div + scrim `linear-gradient(180deg, oklch(0.15 0.04 h / .55), oklch(0.1 0.05 h / .78))`; no photo → ambient base gradient fallback. When `autoTint` and image loads: draw to 64px canvas (`crossOrigin` not needed — blob URL), `getImageData`, `dominantTintFromPixels` → `onTint(tint)`; when `!autoTint` or unset → `onTint(null)`.
- Container: `iconFg = settings.iconColor ?? (settings.scene === 'photo' && photoTint ? photoTint : autoIconColor(settings.hue))`. `photosEnabled` probe: on mount `GET /api/photos?limit=1` → 403/`success:false` ⇒ false (pass to drawer).
- `PhotoPicker` (opened from drawer photo section): overlay panel with authed thumbnail grid (`GET /api/photos?limit=60`, `useAuthedImage(photoFileUrl(id,'thumb'))` per cell — simple grid, no virtualization), Upload button (`<input type="file" accept="image/*">` → `FormData` per existing upload route contract — read `app/api/photos/upload/route.ts` first and match its field names exactly), Cancel. `onPick(id)` → drawer does `updateSettings({ photo: { src: 'gallery:'+id, autoTint: current } })`.
- Drawer photo section: current-photo thumb (if set), Choose from gallery (opens picker), Upload, Auto icon color toggle row; disabled note `t('Photos are disabled for this family')` when `!photosEnabled`.

- [ ] **Step 1: Read `app/api/photos/upload/route.ts`** and note exact multipart contract before coding.
- [ ] **Step 2: Implement PhotoScene + PhotoPicker; wire SceneBackground/container/drawer.**
- [ ] **Step 3: Verify** — `npx tsc --noEmit`; `npm test`.
- [ ] **Step 4: i18n keys** ("Photo", "Choose from gallery", "Upload photo", "Auto icon color", "Photos are disabled for this family", "No photos yet", "Cancel") + script.
- [ ] **Step 5: Commit** — `git commit -m "feat(nursery): photo scene with gallery picker, upload and dominant-color auto tint"`.

---

### Task 14: Translations, polish, verification

**Files:**
- Modify: `src/localization/translations/*.json` (translate new keys in de, es, fr, it, nl, ro, pt-pt, pt-br)
- Modify: `src/components/features/nursery-mode/README.md` (create — component docs per repo convention)
- Possibly touch: any file failing verification

- [ ] **Step 1: Translation completeness** — `node scripts/check-missing-translations.js`; then fill translated values for every new nursery key in all 8 non-English files (best-effort, natural phrasing; keep placeholders `{x}` intact if any).
- [ ] **Step 2: Reduced-motion audit** — grep nursery.css: every `animation`/`transition` that moves content sits under `@media (prefers-reduced-motion: no-preference)` or has the mockup's static fallback (bubbles `--sy` case). Fix stragglers.
- [ ] **Step 3: Write `README.md`** for the feature folder (props/architecture summary per repo convention).
- [ ] **Step 4: Full verification:**

```bash
npm test                 # all green
npx tsc --noEmit         # clean
npm run build            # production build succeeds
```

- [ ] **Step 5: Dead-code sweep** — confirm old files deleted, no imports of `useNurseryColors` remain outside what still uses it (baby-switcher/drawer chrome may — acceptable if imported intentionally; otherwise delete the hook too), `grep -rn "nursery-animations\|TileShell\|SubButton" src app` empty.
- [ ] **Step 6: Commit** — `git commit -m "chore(nursery): translations, reduced-motion audit, docs and final verification"`.

---

## Self-Review Notes (done at plan time)

- **Spec coverage:** §3 layout → Tasks 1–13; §4 settings → 5,7; §5 pipeline/recolor → 3,8; §6 scenes → 9,10,13; §7 layouts/undo → 11; §8 chrome → 9,11; §9 drawer → 12; §10 tests → 2–6; §11 i18n → every UI task + 14; §12 phases map 1:1.
- **Type consistency:** `ActivityView`/`ActionButton`/`UndoInfo` defined once in Task 11 types.ts; `NurserySettings` single source Task 5; engine return `{objectUrl, ar}` used by Tasks 9,10,12.
- **Placeholders:** manifest pose lists must be filled from `ls` in Task 1 Step 2 (explicitly required); no TBDs remain.
