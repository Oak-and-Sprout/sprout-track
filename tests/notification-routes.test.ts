import { describe, it, expect } from 'vitest';
import { NOTIFICATION_ROUTES, routeForNotification } from '@/src/lib/notifications/routes';

describe('routeForNotification', () => {
  it('sends medicine notifications to the medicine screen', () => {
    expect(routeForNotification('medicine')).toBe('medicine');
  });

  it('falls back to log-entry for an unknown kind', () => {
    expect(routeForNotification('nonsense')).toBe('log-entry');
  });

  it('only ever returns an allow-listed route', () => {
    for (const kind of ['medicine', 'feed', 'diaper', 'activity', 'nonsense', '']) {
      expect(NOTIFICATION_ROUTES).toContain(routeForNotification(kind));
    }
  });
});
