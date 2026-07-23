/**
 * Detection and access helpers for the Sprout Track Capacitor shell.
 * Everything here must no-op safely in a normal browser: the shell appends
 * "SproutTrackApp/<version> (<platform>)" to the WebView user agent, and the
 * Capacitor bridge (when injected) exposes window.Capacitor.Plugins.
 */

export type NativePlatform = 'ios' | 'android';

export interface NativeAppInfo {
  isNative: boolean;
  platform: NativePlatform | null;
}

const NATIVE_UA_RE = /SproutTrackApp\/[\w.]+ \((ios|android)\)/;

export function detectNativeApp(userAgent: string): NativeAppInfo {
  const match = userAgent.match(NATIVE_UA_RE);
  if (!match) return { isNative: false, platform: null };
  return { isNative: true, platform: match[1] as NativePlatform };
}

export function isNativeApp(): boolean {
  return typeof navigator !== 'undefined' && detectNativeApp(navigator.userAgent).isNative;
}

export function getCapacitorPlugin<T = unknown>(name: string): T | null {
  const cap = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown> } }).Capacitor;
  return (cap?.Plugins?.[name] as T) ?? null;
}

export function shellOrigin(platform: NativePlatform): string {
  return platform === 'ios' ? 'capacitor://localhost' : 'https://localhost';
}

export function chooseWakeLockMechanism(flags: {
  hasKeepAwakePlugin: boolean;
  hasWakeLockApi: boolean;
}): 'plugin' | 'browser' | 'none' {
  if (flags.hasKeepAwakePlugin) return 'plugin';
  if (flags.hasWakeLockApi) return 'browser';
  return 'none';
}

export function shouldRegisterServiceWorker(flags: {
  isNative: boolean;
  hasServiceWorker: boolean;
  isSecureContext: boolean;
}): boolean {
  return !flags.isNative && flags.hasServiceWorker && flags.isSecureContext;
}
