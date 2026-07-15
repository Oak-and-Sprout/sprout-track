import { describe, it, expect } from 'vitest';
import { resolveRootRedirect } from '@/src/utils/pwa-root-redirect';

const family = JSON.stringify({ id: 'f1', name: 'Smith', slug: 'smith-family', isActive: true });

describe('resolveRootRedirect', () => {
  it('bounces to the stored family when standalone and not yet bounced', () => {
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: family, alreadyBounced: false })
    ).toEqual({ redirectTo: '/smith-family' });
  });

  it('does nothing in a normal browser tab (not standalone)', () => {
    expect(
      resolveRootRedirect({ isStandalone: false, storedFamilyJson: family, alreadyBounced: false })
    ).toEqual({ redirectTo: null });
  });

  it('does nothing when already bounced this session (loop guard)', () => {
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: family, alreadyBounced: true })
    ).toEqual({ redirectTo: null });
  });

  it('does nothing when no family is stored', () => {
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: null, alreadyBounced: false })
    ).toEqual({ redirectTo: null });
  });

  it('does nothing when the stored JSON is malformed', () => {
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: '{not json', alreadyBounced: false })
    ).toEqual({ redirectTo: null });
  });

  it('does nothing when the stored family has no usable slug', () => {
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: JSON.stringify({ slug: '   ' }), alreadyBounced: false })
    ).toEqual({ redirectTo: null });
    expect(
      resolveRootRedirect({ isStandalone: true, storedFamilyJson: JSON.stringify({ name: 'x' }), alreadyBounced: false })
    ).toEqual({ redirectTo: null });
  });
});
