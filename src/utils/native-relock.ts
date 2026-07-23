/**
 * When a family page loads locked inside the native shell, decide whether to
 * bounce back to the shell (so it can reconnect / re-authenticate) instead of
 * rendering the web login — which should never be visible inside the app.
 *
 * A short-lived marker breaks a redirect loop: if we already bounced for this
 * family moments ago and are still locked (the reconnect isn't sticking), we
 * stop bouncing and fall back to the web login as a last resort rather than
 * ping-ponging forever.
 */

export const REAUTH_LOOP_WINDOW_MS = 15_000;
const MARKER_KEY = 'nativeReauthAttempt';

export interface ReauthMarker {
  slug: string;
  at: number;
}

export type NativeRelockDecision = 'app' | 'return-to-shell' | 'show-login';

export function decideNativeRelock(input: {
  unlocked: boolean;
  native: boolean;
  slug: string;
  marker: ReauthMarker | null;
  now: number;
}): NativeRelockDecision {
  if (input.unlocked) return 'app';
  if (!input.native) return 'show-login';
  const { marker, slug, now } = input;
  if (marker && marker.slug === slug && now - marker.at < REAUTH_LOOP_WINDOW_MS) {
    return 'show-login';
  }
  return 'return-to-shell';
}

export function readReauthMarker(storage: Pick<Storage, 'getItem'>): ReauthMarker | null {
  try {
    const raw = storage.getItem(MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReauthMarker;
    return typeof parsed?.slug === 'string' && typeof parsed?.at === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

export function writeReauthMarker(storage: Pick<Storage, 'setItem'>, marker: ReauthMarker): void {
  try {
    storage.setItem(MARKER_KEY, JSON.stringify(marker));
  } catch {
    /* storage unavailable — the loop guard degrades to always bouncing */
  }
}

export function clearReauthMarker(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(MARKER_KEY);
  } catch {
    /* ignore */
  }
}
