import type { DiaperType } from '@prisma/client';

/**
 * Diaper types that count toward wet statistics.
 * A type must opt in here; anything unlisted (DRY, future members) is excluded.
 */
export const isWetDiaper = (type: DiaperType | string): boolean =>
  type === 'WET' || type === 'BOTH';

/**
 * Diaper types that count toward dirty/poop statistics.
 * A type must opt in here; anything unlisted (DRY, future members) is excluded.
 */
export const isDirtyDiaper = (type: DiaperType | string): boolean =>
  type === 'DIRTY' || type === 'BOTH';
