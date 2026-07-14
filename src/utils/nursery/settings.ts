import { SPRITE_SETS, RUGS } from '@/src/components/features/nursery-mode/spriteManifest';

export type NurseryScene = 'ambient' | 'starlit' | 'tapestry' | 'photo';
export type NurseryLayout = 'cards' | 'tiles';

export interface NurserySettings {
  v: 1;
  scene: NurseryScene; layout: NurseryLayout;
  hue: number; dim: number; sat: number; trans: number;
  iconShape: 'circle' | 'square'; iconColor: string | null;
  acts: { feed: boolean; pump: boolean; diaper: boolean; sleep: boolean };
  ambient: {
    pattern: string; auroraRange: number; waveMotion: number; rock: number;
    bubbles: { count: number; min: number; max: number };
    rot: number; move: number; size: number;
  };
  starlit: { density: number; aura: boolean };
  sleep: { locations: string[] };
  tapestry: {
    backdrop: string; primary: string | null; accent: string | null;
    palette: 'boys' | 'girls'; base: string;
    colors: [string, string, string, string, string];
  };
  photo: { src: string | null; autoTint: boolean };
}

export const PALETTES: Record<'boys' | 'girls', { base: string; colors: [string, string, string, string, string] }> = {
  boys: { base: '#f2e9d8', colors: ['#3a6ea5', '#5f93c9', '#8fb4d9', '#b1492f', '#d67f65'] },
  girls: { base: '#f4ebe4', colors: ['#4b8a5d', '#7bb08a', '#aecfb6', '#c66d90', '#e2a1bd'] },
};

export const BASE_CHIPS: Record<'boys' | 'girls', string[]> = {
  boys: ['#f2e9d8', '#e5eef6', '#c9dcee', '#a6c3e0', '#efd6cd', '#dfae9f'],
  girls: ['#f4ebe4', '#e7f0e9', '#cee3d5', '#f2dae3', '#eac2d3', '#d99bb4'],
};

export const ICON_SWATCHES: (string | null)[] = [null, '#f9c9d6', '#fbd38d', '#a7f3d0', '#a5d8ff', '#d8b4fe', '#ffffff'];

export const AMBIENT_PATTERNS: string[] = ['aurora', 'waves', 'bubbles'];

export const CSS_BACKDROPS: { id: string; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'vstripe', label: 'Pinstripe' },
  { id: 'hstripe', label: 'Horizontal' },
  { id: 'dstripe', label: 'Diagonal' },
  { id: 'zigzag', label: 'Chevron' },
  { id: 'dots', label: 'Dots' },
  { id: 'checks', label: 'Blocks' },
  { id: 'scallops', label: 'Scallops' },
];

export const NURSERY_DEFAULTS: NurserySettings = {
  v: 1,
  scene: 'ambient',
  layout: 'cards',
  hue: 248,
  dim: 46,
  sat: 38,
  trans: 58,
  iconShape: 'square',
  iconColor: null,
  acts: { feed: true, pump: true, diaper: true, sleep: true },
  ambient: {
    pattern: 'aurora',
    auroraRange: 50,
    waveMotion: 0,
    rock: 50,
    bubbles: { count: 24, min: 10, max: 48 },
    rot: 20,
    move: 0,
    size: 40,
  },
  starlit: { density: 200, aura: true },
  sleep: { locations: ['Crib', 'Contact'] },
  tapestry: {
    backdrop: 'vstripe',
    primary: 'teddy',
    accent: 'stars',
    palette: 'boys',
    base: PALETTES.boys.base,
    colors: PALETTES.boys.colors,
  },
  photo: { src: null, autoTint: true },
};

/* ---- helpers ---- */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clamp(n: unknown, lo: number, hi: number, dflt: number): number {
  if (typeof n !== 'number' || isNaN(n)) return dflt;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function oneOf<T extends string>(v: unknown, allowed: T[], dflt: T): T {
  if (typeof v === 'string') {
    for (var i = 0; i < allowed.length; i++) {
      if (allowed[i] === v) return v as T;
    }
  }
  return dflt;
}

function isHex6(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);
}

function normalizeColor(v: unknown): string | null {
  return isHex6(v) ? (v as string) : null;
}

function boolOrDefault(v: unknown, dflt: boolean): boolean {
  return v === undefined ? dflt : !!v;
}

function stringOrNullOrDefault(v: unknown, dflt: string | null): string | null {
  if (typeof v === 'string') return v;
  if (v === null) return null;
  return dflt;
}

const SPRITE_SET_IDS: string[] = SPRITE_SETS.map(function (s) { return s.id; });
const RUG_IDS: string[] = RUGS.map(function (r) { return r.id; });
const CSS_BACKDROP_IDS: string[] = CSS_BACKDROPS.map(function (b) { return b.id; });

function normalizeAmbientPattern(v: unknown): string {
  if (typeof v === 'string') {
    for (var i = 0; i < AMBIENT_PATTERNS.length; i++) {
      if (AMBIENT_PATTERNS[i] === v) return v;
    }
    if (v.indexOf('sprite:') === 0) {
      var setId = v.slice(7);
      for (var j = 0; j < SPRITE_SET_IDS.length; j++) {
        if (SPRITE_SET_IDS[j] === setId) return v;
      }
    }
  }
  return NURSERY_DEFAULTS.ambient.pattern;
}

function normalizeBackdrop(v: unknown): string {
  if (typeof v === 'string') {
    for (var i = 0; i < CSS_BACKDROP_IDS.length; i++) {
      if (CSS_BACKDROP_IDS[i] === v) return v;
    }
    for (var j = 0; j < RUG_IDS.length; j++) {
      if (RUG_IDS[j] === v) return v;
    }
  }
  return NURSERY_DEFAULTS.tapestry.backdrop;
}

function normalizeSleepLocations(v: unknown): string[] {
  if (Array.isArray(v)) {
    const names = v.filter((n): n is string => typeof n === 'string' && n.trim() !== '');
    const deduped = Array.from(new Set(names)).slice(0, 20);
    if (deduped.length > 0) return deduped;
  }
  return NURSERY_DEFAULTS.sleep.locations;
}

function normalizeTapestryColors(v: unknown, palette: 'boys' | 'girls'): [string, string, string, string, string] {
  if (Array.isArray(v) && v.length === 5) {
    var ok = true;
    for (var i = 0; i < 5; i++) {
      if (!isHex6(v[i])) { ok = false; break; }
    }
    if (ok) return [v[0], v[1], v[2], v[3], v[4]] as [string, string, string, string, string];
  }
  return PALETTES[palette].colors;
}

function isLegacy(raw: Record<string, unknown>): boolean {
  const hasV = Object.prototype.hasOwnProperty.call(raw, 'v');
  const hasLegacyField = Object.prototype.hasOwnProperty.call(raw, 'brightness') ||
    Object.prototype.hasOwnProperty.call(raw, 'saturation') ||
    Object.prototype.hasOwnProperty.call(raw, 'visibleTiles');
  return !hasV && hasLegacyField;
}

function migrateLegacy(raw: Record<string, unknown>): NurserySettings {
  const visibleTiles = Array.isArray(raw.visibleTiles) ? raw.visibleTiles as unknown[] : [];
  const includesTile = function (id: string): boolean {
    for (var i = 0; i < visibleTiles.length; i++) {
      if (visibleTiles[i] === id) return true;
    }
    return false;
  };
  const base = JSON.parse(JSON.stringify(NURSERY_DEFAULTS)) as NurserySettings;
  base.hue = clamp(raw.hue, 0, 360, NURSERY_DEFAULTS.hue);
  base.dim = clamp(raw.brightness, 0, 100, NURSERY_DEFAULTS.dim);
  base.sat = clamp(raw.saturation, 0, 100, NURSERY_DEFAULTS.sat);
  base.acts = {
    feed: includesTile('feed'),
    pump: includesTile('pump'),
    diaper: includesTile('diaper'),
    sleep: includesTile('sleep'),
  };
  return base;
}

export function normalizeNurserySettings(raw: unknown): NurserySettings {
  if (!isPlainObject(raw)) {
    return JSON.parse(JSON.stringify(NURSERY_DEFAULTS)) as NurserySettings;
  }

  if (isLegacy(raw)) {
    return migrateLegacy(raw);
  }

  const scene = oneOf<NurseryScene>(raw.scene, ['ambient', 'starlit', 'tapestry', 'photo'], NURSERY_DEFAULTS.scene);
  const layout = oneOf<NurseryLayout>(raw.layout, ['cards', 'tiles'], NURSERY_DEFAULTS.layout);
  const iconShape = oneOf<'circle' | 'square'>(raw.iconShape, ['circle', 'square'], NURSERY_DEFAULTS.iconShape);

  const rawActs = isPlainObject(raw.acts) ? raw.acts : {};
  const rawAmbient = isPlainObject(raw.ambient) ? raw.ambient : {};
  const rawBubbles = isPlainObject(rawAmbient.bubbles) ? rawAmbient.bubbles : {};
  const rawStarlit = isPlainObject(raw.starlit) ? raw.starlit : {};
  const rawSleep = isPlainObject(raw.sleep) ? raw.sleep : {};
  const rawTapestry = isPlainObject(raw.tapestry) ? raw.tapestry : {};
  const rawPhoto = isPlainObject(raw.photo) ? raw.photo : {};

  const palette = oneOf<'boys' | 'girls'>(rawTapestry.palette, ['boys', 'girls'], NURSERY_DEFAULTS.tapestry.palette);

  const bubbleMin = clamp(rawBubbles.min, 4, 80, NURSERY_DEFAULTS.ambient.bubbles.min);
  const bubbleMax = clamp(rawBubbles.max, 10, 160, NURSERY_DEFAULTS.ambient.bubbles.max);
  const bubbleCount = clamp(rawBubbles.count, 4, 80, NURSERY_DEFAULTS.ambient.bubbles.count);

  return {
    v: 1,
    scene: scene,
    layout: layout,
    hue: clamp(raw.hue, 0, 360, NURSERY_DEFAULTS.hue),
    dim: clamp(raw.dim, 0, 100, NURSERY_DEFAULTS.dim),
    sat: clamp(raw.sat, 0, 100, NURSERY_DEFAULTS.sat),
    trans: clamp(raw.trans, 0, 100, NURSERY_DEFAULTS.trans),
    iconShape: iconShape,
    iconColor: normalizeColor(raw.iconColor),
    acts: {
      feed: boolOrDefault(rawActs.feed, NURSERY_DEFAULTS.acts.feed),
      pump: boolOrDefault(rawActs.pump, NURSERY_DEFAULTS.acts.pump),
      diaper: boolOrDefault(rawActs.diaper, NURSERY_DEFAULTS.acts.diaper),
      sleep: boolOrDefault(rawActs.sleep, NURSERY_DEFAULTS.acts.sleep),
    },
    ambient: {
      pattern: normalizeAmbientPattern(rawAmbient.pattern),
      auroraRange: clamp(rawAmbient.auroraRange, 0, 100, NURSERY_DEFAULTS.ambient.auroraRange),
      waveMotion: clamp(rawAmbient.waveMotion, 0, 100, NURSERY_DEFAULTS.ambient.waveMotion),
      rock: clamp(rawAmbient.rock, 0, 100, NURSERY_DEFAULTS.ambient.rock),
      bubbles: { count: bubbleCount, min: bubbleMin, max: bubbleMax },
      rot: clamp(rawAmbient.rot, 0, 100, NURSERY_DEFAULTS.ambient.rot),
      move: clamp(rawAmbient.move, 0, 100, NURSERY_DEFAULTS.ambient.move),
      size: clamp(rawAmbient.size, 0, 100, NURSERY_DEFAULTS.ambient.size),
    },
    starlit: {
      density: clamp(rawStarlit.density, 30, 400, NURSERY_DEFAULTS.starlit.density),
      aura: boolOrDefault(rawStarlit.aura, NURSERY_DEFAULTS.starlit.aura),
    },
    sleep: {
      locations: normalizeSleepLocations(rawSleep.locations),
    },
    tapestry: {
      backdrop: normalizeBackdrop(rawTapestry.backdrop),
      primary: stringOrNullOrDefault(rawTapestry.primary, NURSERY_DEFAULTS.tapestry.primary),
      accent: stringOrNullOrDefault(rawTapestry.accent, NURSERY_DEFAULTS.tapestry.accent),
      palette: palette,
      base: isHex6(rawTapestry.base) ? (rawTapestry.base as string) : PALETTES[palette].base,
      colors: normalizeTapestryColors(rawTapestry.colors, palette),
    },
    photo: {
      src: stringOrNullOrDefault(rawPhoto.src, NURSERY_DEFAULTS.photo.src),
      autoTint: boolOrDefault(rawPhoto.autoTint, NURSERY_DEFAULTS.photo.autoTint),
    },
  };
}
