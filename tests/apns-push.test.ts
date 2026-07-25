import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import http2 from 'node:http2';

// sendOne's timeout handling (below) needs a fake http2 session/stream - a real
// socket would make the test either flaky (racing a live connection) or slow
// (waiting out the real 10s timeout). jsonwebtoken is mocked alongside it
// because providerToken() signs a real ES256 JWT with the (fake, non-EC)
// APNS_AUTH_KEY from ENV below, which would throw before the fake http2
// session is ever touched.
vi.mock('node:http2', () => ({ default: { connect: vi.fn() } }));
vi.mock('jsonwebtoken', () => ({ default: { sign: vi.fn(() => 'fake-jwt') } }));

import {
  loadApnsConfig,
  buildApnsJwtClaims,
  buildApnsRequest,
  classifyApnsResponse,
  sendOne,
} from '@/src/lib/notifications/apnsPush';

const ENV = {
  APNS_AUTH_KEY: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
  APNS_KEY_ID: 'ABC1234567',
  APNS_TEAM_ID: 'TEAM123456',
  APNS_BUNDLE_ID: 'com.sprouttrack.app',
  APNS_PRODUCTION: 'true',
} as unknown as NodeJS.ProcessEnv;

const CONFIG = loadApnsConfig(ENV)!;

describe('loadApnsConfig', () => {
  it('returns null when unconfigured', () => {
    expect(loadApnsConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('returns null when any field is missing', () => {
    const partial = { ...ENV, APNS_KEY_ID: undefined } as unknown as NodeJS.ProcessEnv;
    expect(loadApnsConfig(partial)).toBeNull();
  });

  it('parses a complete configuration', () => {
    expect(CONFIG.keyId).toBe('ABC1234567');
    expect(CONFIG.teamId).toBe('TEAM123456');
    expect(CONFIG.bundleId).toBe('com.sprouttrack.app');
    expect(CONFIG.production).toBe(true);
  });

  it('defaults production to false when the flag is absent', () => {
    const sandbox = { ...ENV, APNS_PRODUCTION: undefined } as unknown as NodeJS.ProcessEnv;
    expect(loadApnsConfig(sandbox)!.production).toBe(false);
  });
});

describe('buildApnsJwtClaims', () => {
  it('issues from the team id and stamps iat', () => {
    expect(buildApnsJwtClaims(CONFIG, 1_700_000_000)).toEqual({
      iss: 'TEAM123456',
      iat: 1_700_000_000,
    });
  });
});

describe('buildApnsRequest', () => {
  const payload = { title: 'Feed due', body: 'Emma is due for a feed' };

  it('targets the device path and sets the topic', () => {
    const req = buildApnsRequest('devtoken', payload, CONFIG);
    expect(req.path).toBe('/3/device/devtoken');
    expect(req.headers['apns-topic']).toBe('com.sprouttrack.app');
    expect(req.headers['apns-push-type']).toBe('alert');
    expect(req.headers['apns-priority']).toBe('10');
  });

  it('omits the collapse header when there is no tag', () => {
    const req = buildApnsRequest('devtoken', payload, CONFIG);
    expect(req.headers['apns-collapse-id']).toBeUndefined();
  });

  it('sets the collapse header from the tag', () => {
    const req = buildApnsRequest('devtoken', { ...payload, tag: 'feed-timer' }, CONFIG);
    expect(req.headers['apns-collapse-id']).toBe('feed-timer');
  });

  it('builds an aps alert and stringifies data values', () => {
    // `data` is typed for the web-push payload shape (eventType/babyId:string); this
    // test intentionally exercises stringification with an arbitrary numeric value.
    const req = buildApnsRequest('devtoken', { ...payload, data: { babyId: 42 } as any }, CONFIG);
    const parsed = JSON.parse(req.body);
    expect(parsed.aps.alert).toEqual({ title: 'Feed due', body: 'Emma is due for a feed' });
    expect(parsed.aps.sound).toBe('default');
    expect(parsed.babyId).toBe('42');
  });
});

describe('classifyApnsResponse', () => {
  it('treats 200 as success', () => {
    expect(classifyApnsResponse(200, '')).toEqual({ success: true, unregistered: false });
  });

  it('treats 410 Unregistered as a dead token', () => {
    expect(classifyApnsResponse(410, '{"reason":"Unregistered"}')).toEqual({
      success: false,
      unregistered: true,
    });
  });

  it('does NOT delete on BadDeviceToken — usually an environment mismatch', () => {
    expect(classifyApnsResponse(400, '{"reason":"BadDeviceToken"}')).toEqual({
      success: false,
      unregistered: false,
    });
  });

  it('treats 500 as transient', () => {
    expect(classifyApnsResponse(500, 'InternalServerError')).toEqual({
      success: false,
      unregistered: false,
    });
  });
});

describe('sendOne timeout handling', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, ENV);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  // A fake http2 session/stream: exposes just enough (setTimeout, on, request,
  // destroy, close) for sendOne to drive, and lets the test fire the timeout
  // callback directly instead of waiting on a real stalled socket.
  function fakeSession() {
    let sessionTimeoutCb: (() => void) | undefined;
    let reqTimeoutCb: (() => void) | undefined;
    const destroy = vi.fn();
    const close = vi.fn();
    const req = {
      setTimeout: vi.fn((_ms: number, cb: () => void) => {
        reqTimeoutCb = cb;
      }),
      on: vi.fn(),
      end: vi.fn(),
    };
    const session = {
      setTimeout: vi.fn((_ms: number, cb: () => void) => {
        sessionTimeoutCb = cb;
      }),
      on: vi.fn(),
      request: vi.fn(() => req),
      destroy,
      close,
    };
    return {
      session,
      destroy,
      close,
      fireSessionTimeout: () => sessionTimeoutCb?.(),
      fireReqTimeout: () => reqTimeoutCb?.(),
    };
  }

  it('resolves { success: false, unregistered: false } and destroys the session on a session-level stall', async () => {
    const fake = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(fake.session as unknown as ReturnType<typeof http2.connect>);

    const promise = sendOne('devtoken', { title: 'Feed due', body: 'Emma is due for a feed' });
    fake.fireSessionTimeout();

    await expect(promise).resolves.toEqual({ success: false, unregistered: false });
    expect(fake.destroy).toHaveBeenCalled();
  });

  it('resolves { success: false, unregistered: false } and destroys the session on a request-level stall', async () => {
    const fake = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(fake.session as unknown as ReturnType<typeof http2.connect>);

    const promise = sendOne('devtoken', { title: 'Feed due', body: 'Emma is due for a feed' });
    fake.fireReqTimeout();

    await expect(promise).resolves.toEqual({ success: false, unregistered: false });
    expect(fake.destroy).toHaveBeenCalled();
  });
});
