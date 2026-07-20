/**
 * Web → shell communication. The shell and this app share one WebView; to hand
 * control back (logout, switch family) we navigate to the shell's origin with
 * the bridge event encoded in a query parameter the shell reads on boot.
 */

import { encodeMessage, WebToNativeMessage } from './bridge-contract';
import { detectNativeApp, shellOrigin } from './native-app';

export function shellReturnUrl(userAgent: string, msg: WebToNativeMessage): string | null {
  const { isNative, platform } = detectNativeApp(userAgent);
  if (!isNative || !platform) return null;
  return `${shellOrigin(platform)}/?bridge-event=${encodeURIComponent(encodeMessage(msg))}`;
}

/** Navigate the WebView back to the shell. Returns false (no-op) in normal browsers. */
export function navigateToShell(msg: WebToNativeMessage): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const url = shellReturnUrl(navigator.userAgent, msg);
  if (!url) return false;
  window.location.href = url;
  return true;
}
