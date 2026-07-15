import { SPRITE_SETS, RUGS } from '@/src/components/features/nursery-mode/spriteManifest';

export type NurseryScene = 'ambient' | 'starlit' | 'tapestry' | 'photo';
export type NurseryLayout = 'cards' | 'tiles';

export interface NurserySettings {
  v: 1;
  scene: NurseryScene; layout: NurseryLayout;
  hue: number; dim: number; sat: number; trans: number;
  iconShape: 'circle' | 'square'; iconColor: string | null;
  acts: { feed: boolean; pump: boolean; diaper: boolean; sleep: boolean; food: boolean };
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

export interface PatternPalette {
  id: string;
  name: string;
  colors: [string, string, string, string, string];
}

export const PATTERN_PALETTES: Record<'boys' | 'girls', PatternPalette[]> = {
  boys: [
    { id: 'ocean', name: 'Ocean Breeze', colors: ['#1c3d5c', '#2f6690', '#4f93bd', '#83bcd9', '#c3e2ee'] },
    { id: 'forest', name: 'Forest Trail', colors: ['#20351f', '#345c31', '#4f8548', '#7fae72', '#b9d9ac'] },
    { id: 'harvest', name: 'Autumn Harvest', colors: ['#5c2c14', '#8f4420', '#c06430', '#dd9159', '#f0c39a'] },
    { id: 'storm', name: 'Storm Grey', colors: ['#262b33', '#3e4650', '#5c6672', '#8a94a0', '#c2cad2'] },
    { id: 'racer', name: 'Racing Red', colors: ['#5c1414', '#8f2020', '#c03030', '#dd6a6a', '#f0a8a8'] },
    { id: 'meadow', name: 'Sunny Meadow', colors: ['#4a4a14', '#767620', '#a3a330', '#c7c766', '#e8e8a3'] },
    { id: 'denim', name: 'Denim & Khaki', colors: ['#2c3e50', '#4f708f', '#8aa8bd', '#c9b48a', '#e8dcc0'] },
    { id: 'slate', name: 'Slate & Rust', colors: ['#2b2f36', '#565e68', '#8a929c', '#a04a2e', '#d67f5f'] },
    { id: 'woodland', name: 'Woodland', colors: ['#33261a', '#5c4530', '#7a6248', '#4f6e4a', '#8fae82'] },
    { id: 'galaxy', name: 'Galaxy', colors: ['#131328', '#262652', '#42428f', '#6c6cbd', '#a3a3e0'] },
    { id: 'circus', name: 'Circus Big Top', colors: ['#c81d25', '#f2a900', '#1b5fae', '#f5f0e6', '#1a1a1a'] },
    { id: 'arcade', name: 'Arcade Lights', colors: ['#ff3864', '#2de2e6', '#f9c80e', '#261447', '#a4fbe1'] },
    { id: 'racecar', name: 'Checkered Flag', colors: ['#111111', '#ffffff', '#e10600', '#ffd400', '#0056b3'] },
    { id: 'dinosaur', name: 'Dino Roar', colors: ['#2e7d32', '#e65100', '#6d4c41', '#fdd835', '#004d40'] },
    { id: 'pirate', name: 'Pirate Cove', colors: ['#0b1d3a', '#c1272d', '#d4af37', '#f4ead5', '#1a1a1a'] },
    { id: 'robot', name: 'Robot Workshop', colors: ['#37474f', '#ff6d00', '#00b0ff', '#eceff1', '#212121'] },
    { id: 'safari', name: 'Jungle Safari', colors: ['#33691e', '#f57f17', '#4e342e', '#0277bd', '#fbc02d'] },
    { id: 'rocketpop', name: 'Rocket Pop', colors: ['#d7263d', '#ffffff', '#1b98e0', '#f7f7f2', '#0b1f3a'] },
    { id: 'traffic', name: 'Traffic Signal', colors: ['#c62828', '#f9a825', '#2e7d32', '#263238', '#eceff1'] },
    { id: 'toolbox', name: 'Toolbox Bright', colors: ['#eb5e28', '#252422', '#ccc5b9', '#403d39', '#fffcf2'] },
  ],
  girls: [
    { id: 'blush', name: 'Blush Garden', colors: ['#6b2340', '#a3406a', '#cc6f97', '#e6a2c0', '#f7d6e4'] },
    { id: 'mint', name: 'Meadow Mint', colors: ['#1f4a34', '#357056', '#59a17f', '#8fc7ab', '#c8e8d8'] },
    { id: 'lavender', name: 'Lavender Fields', colors: ['#3d2a5c', '#5f4589', '#8a6cb8', '#b79fd9', '#dfd0f0'] },
    { id: 'peach', name: 'Sunset Peach', colors: ['#7a331f', '#a85536', '#d98a5f', '#eeb491', '#f9dcc6'] },
    { id: 'honey', name: 'Golden Honey', colors: ['#5c4310', '#8f6c1c', '#c2992e', '#dfc266', '#f3e2a8'] },
    { id: 'rose', name: 'Rose Quartz', colors: ['#4a2530', '#75404e', '#a3697a', '#c99ba6', '#e8d2d8'] },
    { id: 'sky', name: 'Sky Whisper', colors: ['#1f4a5c', '#347089', '#5fa0bd', '#9bc9dd', '#d3edf5'] },
    { id: 'berry', name: 'Berry Bliss', colors: ['#4a0f30', '#7a1f52', '#a83b7d', '#cc72a8', '#eab3d4'] },
    { id: 'buttercream', name: 'Buttercream', colors: ['#5c451f', '#8f6c34', '#c2995c', '#dfc48f', '#f5e8c8'] },
    { id: 'coral', name: 'Coral Reef', colors: ['#7a3324', '#b1553a', '#d98266', '#59a191', '#a8d9cb'] },
    { id: 'carnival', name: 'Carnival Sweets', colors: ['#ff6f91', '#845ec2', '#ffc75f', '#00c2a8', '#f9f871'] },
    { id: 'rainbow', name: 'Rainbow Sherbet', colors: ['#ff9a8b', '#ff6a88', '#ff99ac', '#a8e6cf', '#dcedc1'] },
    { id: 'popsicle', name: 'Popsicle Pop', colors: ['#ff477e', '#7bdff2', '#ffcb77', '#b2f7ef', '#0d3b66'] },
    { id: 'butterfly', name: 'Butterfly Garden', colors: ['#7209b7', '#f72585', '#4cc9f0', '#4361ee', '#ffd60a'] },
    { id: 'tropical', name: 'Tropical Punch', colors: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557'] },
    { id: 'candyshop', name: 'Candy Shop', colors: ['#f94144', '#f3722c', '#f9c74f', '#90be6d', '#577590'] },
    { id: 'unicorn', name: 'Unicorn Sparkle', colors: ['#ff86c8', '#ffb3de', '#c9a8ff', '#8ecae6', '#fff3b0'] },
    { id: 'flamingo', name: 'Flamingo Beach', colors: ['#ff477e', '#ffd166', '#06d6a0', '#118ab2', '#073b4c'] },
    { id: 'fiesta', name: 'Fiesta Bright', colors: ['#d62828', '#f77f00', '#fcbf49', '#eae2b7', '#003049'] },
    { id: 'mermaid', name: 'Mermaid Cove', colors: ['#00b4d8', '#90e0ef', '#caf0f8', '#ff70a6', '#0077b6'] },
  ],
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
  acts: { feed: true, pump: true, diaper: true, sleep: true, food: false },
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
    food: false, // the food tile postdates legacy settings
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
      food: boolOrDefault(rawActs.food, NURSERY_DEFAULTS.acts.food),
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
