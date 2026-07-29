import { getCapacitorPlugin, isNativeApp } from './native-app';

interface BrowserPlugin { open(options: { url: string }): Promise<void>; }

export const MANAGE_SUBSCRIPTION_URL = 'https://sprout-track.com/account';

/**
 * Opens a URL outside the webview. Inside the native shell the Capacitor
 * Browser plugin (injected on allowNavigation hosts) opens the system
 * browser; anywhere else — including a shell whose bridge didn't inject —
 * fall back to window.open, which the shell's webview hands to the OS.
 */
export function openExternal(url: string): void {
  const browser = isNativeApp() ? getCapacitorPlugin<BrowserPlugin>('Browser') : null;
  if (browser) { void browser.open({ url }); return; }
  window.open(url, '_blank', 'noopener');
}
