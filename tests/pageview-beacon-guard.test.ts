import { describe, it, expect } from 'vitest';
import { beaconBody } from '@/src/components/analytics/beacon-body';

describe('beaconBody', () => {
  it('serializes path, referrer, query', () => {
    expect(JSON.parse(beaconBody('/pricing', 'https://x.com/a', '?utm=1')))
      .toEqual({ path: '/pricing', referrer: 'https://x.com/a', query: '?utm=1' });
  });
  it('nulls empty referrer/query', () => {
    expect(JSON.parse(beaconBody('/', '', ''))).toEqual({ path: '/', referrer: null, query: null });
  });
});
