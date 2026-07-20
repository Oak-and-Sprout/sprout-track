import { describe, it, expect } from 'vitest';
import {
  BRIDGE_CONTRACT_VERSION,
  decodeMessage,
  encodeMessage,
} from '@/src/utils/bridge-contract';

describe('vendored bridge contract', () => {
  it('is version 1', () => {
    expect(BRIDGE_CONTRACT_VERSION).toBe(1);
  });

  it('round-trips a loggedOut message', () => {
    const decoded = decodeMessage(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }));
    expect(decoded).toEqual({
      v: BRIDGE_CONTRACT_VERSION,
      msg: { type: 'loggedOut', reason: 'switch-family' },
    });
  });

  it('rejects a payload with a missing required field', () => {
    expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'loggedOut' } }))).toBeNull();
  });

  it('rejects messages from a newer contract version', () => {
    const raw = JSON.stringify({ v: BRIDGE_CONTRACT_VERSION + 1, msg: { type: 'appResumed' } });
    expect(decodeMessage(raw)).toBeNull();
  });

  it('matches the mobile repo source byte-for-byte after the vendor header', () => {
    // Drift guard: if this fails, re-copy from mobile-app-v1/shared/bridge-contract.ts.
    // Uses node fs because vitest runs in node environment.
    const fs = require('node:fs') as typeof import('node:fs');
    if (!fs.existsSync('/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts')) return;
    const vendored = fs
      .readFileSync('src/utils/bridge-contract.ts', 'utf8')
      .split('\n')
      .slice(2)
      .join('\n');
    const source = fs.readFileSync(
      '/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts',
      'utf8'
    );
    expect(vendored).toBe(source);
  });
});
