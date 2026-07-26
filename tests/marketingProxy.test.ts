import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy, config } from '@/proxy';

const originalMode = process.env.DEPLOYMENT_MODE;

afterEach(() => {
  process.env.DEPLOYMENT_MODE = originalMode;
});

function requestFor(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe('marketing proxy', () => {
  describe('in saas mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'saas';
    });

    it('lets marketing routes through', () => {
      for (const path of ['/features', '/pricing', '/terms', '/privacy']) {
        const response = proxy(requestFor(path));
        expect(response.status).toBe(200);
        expect(response.headers.get('location')).toBeNull();
      }
    });
  });

  describe('in self-hosted mode', () => {
    beforeEach(() => {
      process.env.DEPLOYMENT_MODE = 'selfhosted';
    });

    it('redirects marketing routes to /', () => {
      for (const path of ['/features', '/pricing', '/terms', '/privacy']) {
        const response = proxy(requestFor(path));
        expect(response.status).toBeGreaterThanOrEqual(300);
        expect(response.status).toBeLessThan(400);
        expect(new URL(response.headers.get('location')!).pathname).toBe('/');
      }
    });
  });

  it('redirects when DEPLOYMENT_MODE is unset (self-hosted default)', () => {
    delete process.env.DEPLOYMENT_MODE;
    const response = proxy(requestFor('/pricing'));
    expect(new URL(response.headers.get('location')!).pathname).toBe('/');
  });

  it('matcher covers exactly the four marketing routes', () => {
    expect(config.matcher).toEqual(['/features', '/pricing', '/terms', '/privacy']);
  });
});
