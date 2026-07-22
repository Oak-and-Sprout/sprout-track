// Canonical value sets for the hooks API's enum-like fields, sourced from the
// app's own form components (see documentation/temp-development-docs/API-GAPS.md
// items 3, 5, 10, 13). Writers normalize known values to this exact casing;
// GET /reference exposes the same sets so a client can discover them.

/** src/components/forms/DiaperForm/index.tsx */
export const DIAPER_CONDITIONS = ['NORMAL', 'LOOSE', 'FIRM', 'OTHER'] as const;

/** src/components/forms/DiaperForm/index.tsx */
export const DIAPER_COLORS = ['YELLOW', 'BROWN', 'GREEN', 'BLACK', 'RED', 'OTHER'] as const;

/** src/components/forms/SleepForm/index.tsx */
export const SLEEP_QUALITIES = ['POOR', 'FAIR', 'GOOD', 'EXCELLENT'] as const;

/**
 * src/components/forms/BathForm/index.tsx — these are the app's built-in
 * options, but the form also allows free-text custom bath types, so unknown
 * values are not rejected; only known values are normalized to this casing.
 */
export const BATH_TYPES = ['Full Bath', 'Sponge Bath', 'Wipe Down'] as const;

export const BOTTLE_TYPES = ['Formula', 'Breast Milk', 'Formula/Breast', 'Milk', 'Other'] as const;

export const FEED_SIDES = ['LEFT', 'RIGHT'] as const;

/** src/components/forms/PumpForm/index.tsx */
export const PUMP_ACTIONS = ['STORED', 'FED', 'DISCARDED'] as const;

/**
 * Case-insensitively matches `value` against `allowed`, returning the
 * canonical (allowed-list) casing on a match, or `null` if nothing matches.
 */
export function normalizeEnumValue(value: string, allowed: readonly string[]): string | null {
  const lower = value.toLowerCase();
  return allowed.find((candidate) => candidate.toLowerCase() === lower) ?? null;
}
