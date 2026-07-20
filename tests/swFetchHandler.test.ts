import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Issue #227: a service worker that registers a 'fetch' listener — even a
// no-op — makes iOS route every request (HTML, JS chunks, API calls) through
// WebKit's service worker process. In installed home-screen PWAs that process
// intermittently fails to start, hanging all requests and freezing the app on
// its server-rendered shell ("Loading..." or a blank gradient). Chrome no
// longer requires a fetch handler for installability (108+ mobile / 112+
// desktop), so sw.js must never register one.
describe('public/sw.js', () => {
  const swSource = readFileSync(join(__dirname, '..', 'public', 'sw.js'), 'utf8');

  it('does not register a fetch event listener (iOS PWA hang, issue #227)', () => {
    expect(swSource).not.toMatch(/addEventListener\(\s*['"]fetch['"]/);
  });

  it('still handles push notifications', () => {
    expect(swSource).toMatch(/addEventListener\(\s*['"]push['"]/);
    expect(swSource).toMatch(/addEventListener\(\s*['"]notificationclick['"]/);
  });

  it('activates immediately so a fixed sw.js replaces the broken one on update', () => {
    expect(swSource).toMatch(/skipWaiting/);
    expect(swSource).toMatch(/clients\.claim/);
  });
});
