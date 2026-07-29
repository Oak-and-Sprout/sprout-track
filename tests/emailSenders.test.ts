import { describe, it, expect, afterEach } from 'vitest';
import {
  accountsFrom,
  paymentsFrom,
  noReplyFrom,
  adminFrom,
  UNMONITORED_NOTICE_TEXT,
  unmonitoredNoticeHtml,
} from '@/app/api/utils/account-emails';

/**
 * The provider verifies senders per-address and rejects anything else, and a
 * rejection only surfaces in a server log — so a wrong default here looks
 * exactly like a delivered email. These pin the four verified identities.
 */
const VARS = ['ACCOUNTS_EMAIL', 'PAYMENTS_EMAIL', 'NO_REPLY_EMAIL', 'ADMIN_EMAIL'] as const;
const original = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));

afterEach(() => {
  for (const v of VARS) {
    if (original[v] === undefined) delete process.env[v];
    else process.env[v] = original[v] as string;
  }
});

describe('email senders', () => {
  it('default to the four verified Sender Identities', () => {
    for (const v of VARS) delete process.env[v];
    expect(accountsFrom()).toBe('Sprout Track <accounts@sprout-track.com>');
    expect(paymentsFrom()).toBe('Sprout Track <payments@sprout-track.com>');
    expect(noReplyFrom()).toBe('Sprout Track <no-reply@sprout-track.com>');
    expect(adminFrom()).toBe('Sprout Track <admin@sprout-track.com>');
  });

  it('never falls back to an address that is not a verified sender', () => {
    for (const v of VARS) delete process.env[v];
    const verified = [
      'accounts@sprout-track.com',
      'payments@sprout-track.com',
      'no-reply@sprout-track.com',
      'admin@sprout-track.com',
    ];
    for (const from of [accountsFrom(), paymentsFrom(), noReplyFrom(), adminFrom()]) {
      const address = from.replace(/^.*<|>$/g, '');
      expect(verified, `${address} must be a verified sender`).toContain(address);
    }
  });

  it('wraps a bare override with the From Name and leaves a full mailbox alone', () => {
    process.env.ACCOUNTS_EMAIL = 'billing@example.com';
    expect(accountsFrom()).toBe('Sprout Track <billing@example.com>');
    process.env.ADMIN_EMAIL = 'Support <help@example.com>';
    expect(adminFrom()).toBe('Support <help@example.com>');
  });
});

describe('unmonitored notice', () => {
  it('states the mailbox is unmonitored and points somewhere that works', () => {
    expect(UNMONITORED_NOTICE_TEXT).toMatch(/not monitored/i);
    expect(UNMONITORED_NOTICE_TEXT).toMatch(/Feedback/i);
    const html = unmonitoredNoticeHtml();
    expect(html).toMatch(/not monitored/i);
    expect(html).toContain('<p');
  });
});
