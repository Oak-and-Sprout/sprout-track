/**
 * Notification target routes. The shell concatenates this value into the URL that
 * carries the session token in its #bridge-session= fragment, so it must never be
 * an unvalidated value from a payload — an arbitrary route is a token-redirection
 * primitive. Both sides resolve through this allow-list.
 */

export const NOTIFICATION_ROUTES = ['log-entry', 'medicine', 'calendar'] as const;

const BY_KIND: Record<string, (typeof NOTIFICATION_ROUTES)[number]> = {
  medicine: 'medicine',
  feed: 'log-entry',
  diaper: 'log-entry',
  activity: 'log-entry',
};

export function routeForNotification(kind: string): string {
  // Explicit membership check on the way out (not just `?? 'log-entry'`): BY_KIND is a
  // plain object literal, so a lookup like BY_KIND['constructor'] resolves through
  // Object.prototype and returns a truthy non-string, silently skipping the fallback.
  // This makes "only ever an allow-listed route" true by construction, independent of
  // how the lookup above is implemented.
  const result = BY_KIND[kind];
  return (NOTIFICATION_ROUTES as readonly string[]).includes(result) ? result : 'log-entry';
}
