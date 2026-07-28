import { describe, it, expect } from 'vitest';
import { verificationLink, passwordResetLink } from '@/app/api/utils/account-emails';

describe('account email links', () => {
  it('uses a real path for verification, not a fragment', () => {
    expect(verificationLink('https://sprout-track.com', 'tok')).toBe(
      'https://sprout-track.com/verify?token=tok'
    );
  });

  it('uses a real path for password reset, not a fragment', () => {
    expect(passwordResetLink('https://sprout-track.com', 'tok')).toBe(
      'https://sprout-track.com/passwordreset?token=tok'
    );
  });

  it('produces links Universal Links can match — no # in the path', () => {
    expect(verificationLink('https://x.test', 't')).not.toContain('#');
    expect(passwordResetLink('https://x.test', 't')).not.toContain('#');
  });
});
