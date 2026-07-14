export type BottleUnit = 'OZ' | 'ML';

export const DEFAULT_BOTTLE_UNIT: BottleUnit = 'OZ';

const STORAGE_KEY_PREFIX = 'sprout-track.defaultBottleUnit';

function getStorageScope(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    const token = window.localStorage.getItem('authToken');
    const encodedPayload = token?.split('.')[1];
    if (encodedPayload) {
      const base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
      if (typeof payload.familyId === 'string' && payload.familyId) return payload.familyId;
    }
  } catch {
    // Fall back to the route when the token is unavailable or cannot be decoded.
  }

  return window.location.pathname.split('/').filter(Boolean)[0] || 'default';
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}:${getStorageScope()}`;
}

export function normalizeBottleUnit(value: unknown): BottleUnit | null {
  if (typeof value !== 'string') return null;
  const normalized = value.toUpperCase();
  return normalized === 'ML' || normalized === 'OZ' ? normalized : null;
}

export function readCachedDefaultBottleUnit(): BottleUnit {
  if (typeof window === 'undefined') return DEFAULT_BOTTLE_UNIT;

  try {
    return normalizeBottleUnit(window.localStorage.getItem(getStorageKey())) || DEFAULT_BOTTLE_UNIT;
  } catch {
    return DEFAULT_BOTTLE_UNIT;
  }
}

export function cacheDefaultBottleUnit(value: unknown): BottleUnit | null {
  const unit = normalizeBottleUnit(value);
  if (!unit || typeof window === 'undefined') return unit;

  try {
    window.localStorage.setItem(getStorageKey(), unit);
  } catch {
    // Ignore storage errors; the server remains the source of truth.
  }

  return unit;
}
