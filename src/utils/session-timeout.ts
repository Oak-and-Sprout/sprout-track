/**
 * Session timeout, 401-retry, and family-slug validation helpers (issue #209).
 *
 * These decisions used to live inline in app/(app)/[slug]/client-layout.tsx,
 * src/context/family.tsx, and app/(app)/[slug]/page.tsx, where they could
 * bounce hosted users onto the marketing homepage. They are extracted here as
 * small functions so they can be unit tested in a node environment
 * (tests/session-timeout.test.ts).
 */

/** Client-side fallback when no idle time has been stored (matches historical behavior). */
export const DEFAULT_IDLE_TIME_SECONDS = 1800;

/** Parse the localStorage `idleTimeSeconds` value, falling back to the default for missing/invalid values. */
export function parseIdleTimeSeconds(raw: string | null | undefined): number {
  const parsed = parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_IDLE_TIME_SECONDS;
}

export interface IdleLogoutParams {
  isAccountAuth: boolean;
  isSysAdmin: boolean;
  /** Raw localStorage `unlockTime` value (ms epoch as string), or null when absent. */
  unlockTime: string | null;
  /** Raw localStorage `idleTimeSeconds` value, or null when absent. */
  idleTimeSeconds: string | null;
  /** Current time in ms (Date.now()). */
  now: number;
}

/**
 * Whether the caretaker idle timeout should log the user out.
 *
 * Account holders and system administrators are exempt: their sessions are
 * bounded by the refresh-token window (7 days by default), not the caretaker
 * idle timeout. Before this exemption, account logins that never stored
 * `idleTimeSeconds` were logged out after the 30-minute fallback and dumped
 * on the hosted marketing homepage (issue #209, candidate 1).
 */
export function shouldIdleLogout({
  isAccountAuth,
  isSysAdmin,
  unlockTime,
  idleTimeSeconds,
  now,
}: IdleLogoutParams): boolean {
  if (isAccountAuth || isSysAdmin) return false;
  if (!unlockTime) return false;
  const lastActivity = parseInt(unlockTime, 10);
  if (!Number.isFinite(lastActivity)) return false;
  return now - lastActivity > parseIdleTimeSeconds(idleTimeSeconds) * 1000;
}

// Endpoints whose 401s are part of normal auth flows: never refresh-and-retry
// them (avoids loops on /api/auth/refresh-token and replaying failed logins).
const AUTH_ENDPOINT_PATTERN =
  /\/api\/(auth|accounts\/(login|register|forgot-password|reset-password))(\/|$|\?)/;

/**
 * Whether a 401 on this URL should trigger a token refresh-and-retry
 * (and, if the refresh fails, a logout). Only API calls qualify, and auth
 * endpoints are excluded.
 */
export function should401AttemptRefresh(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const isApiCall = url.startsWith('/api') || url.includes('/api/');
  if (!isApiCall) return false;
  return !AUTH_ENDPOINT_PATTERN.test(url);
}

/** Whether a pathname is a root slug page (e.g. /smith-family), i.e. the login page that expects 401s. */
export function isRootSlugPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname.split('/').filter(Boolean).length === 1;
}

/**
 * Where to send the user after logout.
 * Account holders land on the homepage with the login modal open (plus a
 * short reason code for diagnosing unexpected bounces); PIN users land on
 * their family's login page.
 */
export function logoutDestination({
  isAccountAuth,
  familySlug,
  reason,
}: {
  isAccountAuth: boolean;
  familySlug: string | null | undefined;
  reason: string;
}): string {
  if (isAccountAuth) return `/?login=true&src=${reason}`;
  if (familySlug) return `/${familySlug}?src=${reason}`;
  return '/login';
}

/**
 * Whether the family-slug page should redirect home based on the loaded family
 * state. Only a definitively-inactive family redirects (to
 * /?src=family-inactive). A *missing* family (familyIsActive === null) does
 * NOT redirect: on a resumed PWA the family fetch can transiently fail, and
 * bouncing a valid family to the marketing homepage was the #209 follow-up
 * bug. Slug-not-found is already handled authoritatively by
 * validateFamilySlugWithRetry before this runs. System admins are exempt.
 */
export function familyStateRedirect({
  slugValidated,
  familyLoading,
  isSysAdmin,
  familyIsActive,
}: {
  slugValidated: boolean;
  familyLoading: boolean;
  isSysAdmin: boolean;
  familyIsActive: boolean | null;
}): 'family-inactive' | null {
  if (!slugValidated || familyLoading || isSysAdmin) return null;
  return familyIsActive === false ? 'family-inactive' : null;
}

export type SlugValidationOutcome = 'valid' | 'not-found' | 'transient';

/**
 * Classify a /api/family/by-slug response. Only a definitive answer from the
 * API ("this slug does not resolve to a family") counts as not-found;
 * network hiccups, 5xx, rate limiting, etc. are transient and must not be
 * treated as "family gone" (issue #209, candidate 3).
 */
export function classifySlugValidationResponse(
  status: number,
  body: { success?: boolean; data?: unknown } | null
): SlugValidationOutcome {
  if (status >= 200 && status < 300) {
    return body && body.success === true && body.data ? 'valid' : 'not-found';
  }
  // The endpoint answers 400 for invalid/reserved slugs and 404 for missing
  // resources — both are definitive.
  if (status === 400 || status === 404) return 'not-found';
  return 'transient';
}

export interface SlugValidationOptions {
  fetchFn?: typeof fetch;
  /** Number of retries after the first attempt (default 2). */
  retries?: number;
  /** Base backoff in ms; attempt n waits n * backoffMs (default 500). */
  backoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface FamilyBySlugData {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface FamilyLoadOptions extends SlugValidationOptions {
  /** Bearer token to attach (sysadmins load families by slug with auth). */
  authToken?: string | null;
}

/**
 * Fetch a family by slug, retrying transient failures with a small backoff and
 * returning the family payload on success. Transient failures (thrown fetch,
 * 5xx) are retried; only a definitive answer (2xx-not-success, 400, 404)
 * resolves early. Returns { outcome: 'transient', data: null } after
 * exhausting retries so callers can keep their last-known family (issue #209).
 */
export async function loadFamilyBySlugWithRetry(
  slug: string,
  {
    fetchFn = fetch,
    retries = 2,
    backoffMs = 500,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    authToken = null,
  }: FamilyLoadOptions = {}
): Promise<{ outcome: SlugValidationOutcome; data: FamilyBySlugData | null }> {
  let outcome: SlugValidationOutcome = 'transient';
  let data: FamilyBySlugData | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffMs * attempt);
    try {
      const url = `/api/family/by-slug/${encodeURIComponent(slug)}`;
      const response = authToken
        ? await fetchFn(url, { headers: { Authorization: `Bearer ${authToken}` } })
        : await fetchFn(url);
      let body: { success?: boolean; data?: unknown } | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      outcome = classifySlugValidationResponse(response.status, body);
      data = outcome === 'valid' && body && body.data ? (body.data as FamilyBySlugData) : null;
    } catch {
      outcome = 'transient';
      data = null;
    }
    if (outcome !== 'transient') return { outcome, data };
  }
  return { outcome, data };
}

/**
 * Validate a family slug, retrying transient failures with a small backoff.
 * Returns 'transient' only after exhausting retries — callers should stay on
 * the current page in that case rather than redirecting.
 */
export async function validateFamilySlugWithRetry(
  slug: string,
  options: SlugValidationOptions = {}
): Promise<SlugValidationOutcome> {
  return (await loadFamilyBySlugWithRetry(slug, options)).outcome;
}

// Single in-flight refresh shared by every caller (the layout's expiry check
// and the global 401 interceptor) so parallel 401s trigger exactly one
// POST /api/auth/refresh-token.
let inFlightRefresh: Promise<boolean> | null = null;

/**
 * Refresh the access token using the HTTP-only refresh token cookie and store
 * it in localStorage. Concurrent calls share one request. Pass the original
 * (un-intercepted) fetch when calling from a fetch interceptor.
 */
export function refreshAuthToken(fetchFn: typeof fetch = fetch): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = doRefresh(fetchFn).finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

async function doRefresh(fetchFn: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchFn('/api/auth/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data?.token) {
        localStorage.setItem('authToken', data.data.token);
        // Reset unlock time for PIN-based users
        if (localStorage.getItem('unlockTime')) {
          localStorage.setItem('unlockTime', Date.now().toString());
        }
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return false;
  }
}

/** Test-only: clear the shared in-flight refresh promise. */
export function __resetRefreshStateForTests(): void {
  inFlightRefresh = null;
}
