import { decodeMessage } from './bridge-contract';
import { isNativeApp } from './native-app';

const PREFIX = '#bridge-session=';

export interface InjectedSessionEnv {
  hash: string;
  pathname: string;
  search: string;
  native: boolean;
  storage: { setItem(key: string, value: string): void };
  replaceUrl: (url: string) => void;
  now: () => number;
}

/**
 * Consume a shell-injected session fragment (#bridge-session=<encoded sessionInjected>).
 * Returns true when a session was written. In the native app the fragment is always
 * stripped — valid or not — so tokens never linger in the URL; outside the native app
 * nothing is touched.
 */
export function consumeInjectedSessionFrom(env: InjectedSessionEnv): boolean {
  if (!env.hash.startsWith(PREFIX) || !env.native) return false;
  const strip = () => env.replaceUrl(env.pathname + env.search);
  let decoded: ReturnType<typeof decodeMessage>;
  try {
    decoded = decodeMessage(decodeURIComponent(env.hash.slice(PREFIX.length)));
  } catch {
    strip();
    return false;
  }
  const slug = env.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!decoded || decoded.msg.type !== 'sessionInjected' || decoded.msg.slug !== slug) {
    strip();
    return false;
  }
  env.storage.setItem('authToken', decoded.msg.token);
  env.storage.setItem('unlockTime', env.now().toString());
  if (decoded.msg.caretakerId) env.storage.setItem('caretakerId', decoded.msg.caretakerId);
  strip();
  return true;
}

/** Browser entry point — binds window and seeds the timeout settings the login screens store. */
export function consumeInjectedSession(): boolean {
  if (typeof window === 'undefined') return false;
  const injected = consumeInjectedSessionFrom({
    hash: window.location.hash,
    pathname: window.location.pathname,
    search: window.location.search,
    native: isNativeApp(),
    storage: window.localStorage,
    replaceUrl: url => window.history.replaceState(null, '', url),
    now: Date.now,
  });
  if (injected) void seedTimeoutSettings();
  return injected;
}

async function seedTimeoutSettings(): Promise<void> {
  for (const [endpoint, key] of [
    ['/api/settings/auth-life', 'authLifeSeconds'],
    ['/api/settings/idle-time', 'idleTimeSeconds'],
  ] as const) {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) localStorage.setItem(key, data.data.toString());
    } catch {
      /* session-timeout falls back to defaults */
    }
  }
}
