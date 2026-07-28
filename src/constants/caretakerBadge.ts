/**
 * Caretaker badge colors.
 *
 * A caretaker can be assigned one of these colors; it renders as a small pill
 * next to their name on the timeline. Colors are stored by `id` (e.g. "teal")
 * rather than hex so the palette can be re-tuned without a data migration.
 *
 * `label` doubles as the English localization key (see the localization rule in
 * CLAUDE.md — keys are the English text).
 */
export interface BadgeColorOption {
  id: string;
  label: string;
  hex: string;
}

// 15 app-matched swatches (Tailwind 500-level).
export const CARETAKER_BADGE_COLORS: readonly BadgeColorOption[] = [
  { id: 'slate', label: 'Slate', hex: '#64748b' },
  { id: 'gray', label: 'Gray', hex: '#6b7280' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'lime', label: 'Lime', hex: '#84cc16' },
  { id: 'green', label: 'Green', hex: '#22c55e' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'teal', label: 'Teal', hex: '#14b8a6' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
] as const;

// Neutral fallback used when a caretaker has no (or an unknown) badge color.
export const DEFAULT_BADGE_TEXT = '#111827'; // gray-900

const COLOR_BY_ID = new Map(CARETAKER_BADGE_COLORS.map((c) => [c.id, c]));

/** True when `id` names one of the known swatches. */
export function isValidBadgeColorId(id: unknown): id is string {
  return typeof id === 'string' && COLOR_BY_ID.has(id);
}

/** Resolve a stored badge color id to its swatch, or null if unset/invalid. */
export function getBadgeColorOption(id?: string | null): BadgeColorOption | null {
  if (!id) return null;
  return COLOR_BY_ID.get(id) ?? null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

// WCAG relative luminance for an sRGB color.
function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(l1: number, l2: number): number {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Pick the text color (near-black or white) with the best contrast against the
 * given background hex — "whatever contrasts best".
 */
export function getBadgeTextColor(hex: string): '#111827' | '#ffffff' {
  const bg = hexToRgb(hex);
  if (!bg) return '#111827';
  const lBg = relativeLuminance(bg);
  const lDark = relativeLuminance({ r: 0x11, g: 0x18, b: 0x27 }); // #111827
  const lWhite = 1;
  return contrastRatio(lBg, lDark) >= contrastRatio(lBg, lWhite) ? '#111827' : '#ffffff';
}

/**
 * Resolve the timeline badge for a caretaker. Returns null when the badge should
 * be hidden: system caretaker (loginId "00") or no display name.
 *
 * Kept pure (no Prisma types) so it is unit-testable and reusable server-side.
 */
export function resolveCaretakerBadge(caretaker: {
  name?: string | null;
  loginId?: string | null;
  badgeColor?: string | null;
} | null | undefined): { name: string; colorId: string | null } | null {
  if (!caretaker) return null;
  if (caretaker.loginId === '00') return null; // system PIN — hidden
  const name = caretaker.name?.trim();
  if (!name) return null;
  return { name, colorId: isValidBadgeColorId(caretaker.badgeColor) ? caretaker.badgeColor : null };
}
