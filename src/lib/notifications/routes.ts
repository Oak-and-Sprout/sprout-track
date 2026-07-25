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
  return BY_KIND[kind] ?? 'log-entry';
}
