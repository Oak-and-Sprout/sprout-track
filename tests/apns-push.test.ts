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

// Connection reuse. Each sendOne used to open its own HTTP/2 session and close
// it on completion, so every notification paid a full TLS handshake — and
// nativePush sends to each device token sequentially, so a family with three
// iOS devices paid three back-to-back handshakes inside one cron pass. Apple
// documents that providers should hold connections open and may treat
// repeated open/close as a denial-of-service attempt.
//
// vi.resetModules + dynamic import per test rather than a test-only reset
// export: the session cache is module state, and this is the honest way to get
// a fresh one.
describe('sendOne connection reuse', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    Object.assign(process.env, ENV);
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function fakeSession() {
    const sessionHandlers: Record<string, (...a: unknown[]) => void> = {};
    const reqHandlers: Record<string, (...a: unknown[]) => void> = {};
    let reqTimeoutCb: (() => void) | undefined;
    const req = {
      setTimeout: vi.fn((_ms: number, cb: () => void) => {
        reqTimeoutCb = cb;
      }),
      on: vi.fn((evt: string, cb: (...a: unknown[]) => void) => {
        reqHandlers[evt] = cb;
        return req;
      }),
      end: vi.fn(),
      close: vi.fn(),
    };
    const session = {
      setTimeout: vi.fn(),
      on: vi.fn((evt: string, cb: (...a: unknown[]) => void) => {
        sessionHandlers[evt] = cb;
        return session;
      }),
      request: vi.fn(() => req),
      destroy: vi.fn(),
      close: vi.fn(),
      closed: false,
      destroyed: false,
    };
    return {
      session,
      req,
      respond: (status: number, body = '') => {
        reqHandlers.response?.({ ':status': status });
        if (body) reqHandlers.data?.(body);
        reqHandlers.end?.();
      },
      fire: (evt: string, ...a: unknown[]) => sessionHandlers[evt]?.(...a),
      fireReqTimeout: () => reqTimeoutCb?.(),
    };
  }

  async function loadSendOne() {
    return (await import('@/src/lib/notifications/apnsPush')).sendOne;
  }

  const PAYLOAD = { title: 'Feed due', body: 'Emma is due for a feed' };

  it('opens one connection for two sequential sends', async () => {
    const sendOneFresh = await loadSendOne();
    const fake = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(fake.session as never);

    const first = sendOneFresh('tok1', PAYLOAD);
    fake.respond(200);
    await expect(first).resolves.toEqual({ success: true, unregistered: false });

    const second = sendOneFresh('tok2', PAYLOAD);
    fake.respond(200);
    await expect(second).resolves.toEqual({ success: true, unregistered: false });

    expect(http2.connect).toHaveBeenCalledOnce();
  });

  it('does not tear the session down after a successful send', async () => {
    const sendOneFresh = await loadSendOne();
    const fake = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(fake.session as never);

    const promise = sendOneFresh('tok1', PAYLOAD);
    fake.respond(200);
    await promise;

    expect(fake.session.close).not.toHaveBeenCalled();
    expect(fake.session.destroy).not.toHaveBeenCalled();
  });

  // APNs issues GOAWAY routinely. A cached session that ignores it keeps
  // handing back a dead connection and every later send fails.
  it('reconnects after the session goes away', async () => {
    const sendOneFresh = await loadSendOne();
    const first = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(first.session as never);

    const p1 = sendOneFresh('tok1', PAYLOAD);
    first.respond(200);
    await p1;

    first.fire('goaway');

    const second = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(second.session as never);
    const p2 = sendOneFresh('tok2', PAYLOAD);
    second.respond(200);
    await p2;

    expect(http2.connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects after a session error', async () => {
    const sendOneFresh = await loadSendOne();
    const first = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(first.session as never);

    const p1 = sendOneFresh('tok1', PAYLOAD);
    first.respond(200);
    await p1;

    first.fire('error', new Error('socket hang up'));

    const second = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(second.session as never);
    const p2 = sendOneFresh('tok2', PAYLOAD);
    second.respond(200);
    await p2;

    expect(http2.connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects after a request-level stall killed the session', async () => {
    const sendOneFresh = await loadSendOne();
    const first = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(first.session as never);

    const p1 = sendOneFresh('tok1', PAYLOAD);
    first.fireReqTimeout();
    await expect(p1).resolves.toEqual({ success: false, unregistered: false });

    const second = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(second.session as never);
    const p2 = sendOneFresh('tok2', PAYLOAD);
    second.respond(200);
    await expect(p2).resolves.toEqual({ success: true, unregistered: false });

    expect(http2.connect).toHaveBeenCalledTimes(2);
  });

  it('keeps sandbox and production on separate connections', async () => {
    const sendOneFresh = await loadSendOne();
    const prod = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(prod.session as never);

    const p1 = sendOneFresh('tok1', PAYLOAD);
    prod.respond(200);
    await p1;

    process.env.APNS_PRODUCTION = 'false';
    const sandbox = fakeSession();
    vi.mocked(http2.connect).mockReturnValue(sandbox.session as never);
    const p2 = sendOneFresh('tok2', PAYLOAD);
    sandbox.respond(200);
    await p2;

    expect(http2.connect).toHaveBeenCalledTimes(2);
    expect(vi.mocked(http2.connect).mock.calls[0][0]).toBe('https://api.push.apple.com');
    expect(vi.mocked(http2.connect).mock.calls[1][0]).toBe('https://api.sandbox.push.apple.com');
  });
});
