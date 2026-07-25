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

  it('is not fooled by Object.prototype keys (prototype pollution guard)', () => {
    for (const kind of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      const result = routeForNotification(kind);
      expect(typeof result).toBe('string');
      expect(result).toBe('log-entry');
      expect(NOTIFICATION_ROUTES).toContain(result);
    }
  });
});
