import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    appConfig: { findFirst: vi.fn(), update: vi.fn() },
    emailConfig: { findFirst: vi.fn(), update: vi.fn() },
    notificationConfig: { findFirst: vi.fn(), update: vi.fn() },
  },
  clearRateLimitConfigCache: vi.fn(),
}));

vi.mock('../app/api/db', () => ({ default: mocks.prisma }));
vi.mock('../app/api/utils/auth', () => ({ withSysAdminAuth: (handler: unknown) => handler }));
vi.mock('../src/lib/notifications/config', () => ({ clearNotificationConfigCache: vi.fn(), resetWebPushState: vi.fn() }));
vi.mock('../app/api/hooks/v1/rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../app/api/hooks/v1/rate-limiter')>()),
  clearRateLimitConfigCache: mocks.clearRateLimitConfigCache,
}));

import { PUT } from '../app/api/app-config/route';

const appConfig = { id: 'cfg-1', adminPass: 'x', rootDomain: 'localhost', hooksReadsPerMinute: 60, hooksWritesPerMinute: 30 };

function put(appConfigData: Record<string, unknown>) {
  return PUT(new Request('http://localhost/api/app-config', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ appConfigData }),
  }) as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.prisma.appConfig.findFirst.mockResolvedValue(appConfig);
  mocks.prisma.appConfig.update.mockImplementation(async ({ data }) => ({ ...appConfig, ...data }));
  mocks.prisma.emailConfig.findFirst.mockResolvedValue({ id: 'email-1' });
  mocks.prisma.notificationConfig.findFirst.mockResolvedValue({ id: 'notif-1' });
});

describe('PUT /api/app-config webhook rate limits', () => {
  it('saves form-string limits as integers and clears the limiter cache', async () => {
    const response = await put({ hooksReadsPerMinute: '240', hooksWritesPerMinute: '120', hooksBatchPerMinute: '10' });
    expect(response.status).toBe(200);
    expect(mocks.prisma.appConfig.update).toHaveBeenCalledWith({
      where: { id: 'cfg-1' },
      data: { hooksReadsPerMinute: 240, hooksWritesPerMinute: 120, hooksBatchPerMinute: 10 },
    });
    expect(mocks.clearRateLimitConfigCache).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['zero', { hooksReadsPerMinute: '0' }],
    ['blank', { hooksWritesPerMinute: '' }],
    ['a fraction', { hooksWritesPerMinute: 1.5 }],
    ['above the maximum', { hooksReadsPerMinute: 10_001 }],
    ['text', { hooksReadsPerMinute: 'lots' }],
    ['a zero batch limit', { hooksBatchPerMinute: 0 }],
  ])('rejects %s with 400 and saves nothing', async (_label, data) => {
    const response = await put(data);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/rate limits/);
    expect(mocks.prisma.appConfig.update).not.toHaveBeenCalled();
    expect(mocks.clearRateLimitConfigCache).not.toHaveBeenCalled();
  });

  it('leaves the limits alone when they are not sent', async () => {
    await put({ rootDomain: 'example.com' });
    expect(mocks.prisma.appConfig.update.mock.calls[0][0].data).toEqual({ rootDomain: 'example.com' });
  });
});
