import { describe, it, expect } from 'vitest';
import { APPLE_APP_SITE_ASSOCIATION, claimedPaths } from '@/app/.well-known/apple-app-site-association/route';

describe('claimed deep-link paths', () => {
  it('claims the three resume-in-app paths', () => {
    expect(claimedPaths()).toEqual(['/setup/*', '/verify*', '/passwordreset*']);
  });

  it('NEVER claims /account — IAP compliance depends on it opening externally', () => {
    expect(claimedPaths().some((p) => p.startsWith('/account'))).toBe(false);
  });

  it('does not claim the marketing site', () => {
    for (const p of ['/', '/features', '/pricing', '/privacy', '/terms', '/home']) {
      expect(claimedPaths()).not.toContain(p);
    }
  });

  it('exposes a single applinks detail entry', () => {
    expect(APPLE_APP_SITE_ASSOCIATION.applinks.details).toHaveLength(1);
  });
});
