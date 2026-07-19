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
