/**
 * Presentation rules for chrome that must differ inside the native Capacitor
 * shell to stay compliant with Apple/Google in-app-purchase policy: no
 * in-app payment flows may be surfaced when running in the shell, and
 * subscription management must be pointed at the web instead.
 */

export type SideNavFooterButton = 'settings' | 'logout' | 'exit-to-families';

/**
 * There is no distinct `switch-family` button. The web footer is Settings +
 * Logout; the shell replaces Logout with a single "Exit to My Families" that
 * hands control back to the native app (SideNav wires it to `onSwitchFamily`).
 *
 * A `switch-family` entry used to be listed for web, but `SideNav` only ever
 * rendered it when the host passed `onSwitchFamily`, which `client-layout.tsx`
 * supplies solely in the shell — so it resolved to null and never appeared
 * anywhere. Listing it made this function describe a button that did not exist.
 */
export function sideNavFooterButtons(isNative: boolean): SideNavFooterButton[] {
  if (isNative) return ['settings', 'exit-to-families'];
  return ['settings', 'logout'];
}

export function trialCtaMode(isNative: boolean): 'payment-modal' | 'external' {
  return isNative ? 'external' : 'payment-modal';
}

export interface ShellSubscriptionControls {
  showPaymentActions: boolean;
  showPaymentHistory: boolean;
  showExternalManage: boolean;
  showWebNote: boolean;
}

export function shellSubscriptionControls(
  isNative: boolean,
  kind: 'lifetime' | 'trial' | 'active' | 'expired' | 'none',
  hasFamily: boolean,
): ShellSubscriptionControls {
  if (!isNative) {
    return { showPaymentActions: true, showPaymentHistory: true, showExternalManage: false, showWebNote: false };
  }
  const manageable = hasFamily && (kind === 'trial' || kind === 'active' || kind === 'expired');
  return {
    showPaymentActions: false,
    showPaymentHistory: false,
    showExternalManage: manageable,
    showWebNote: manageable,
  };
}

/**
 * Nursery mode's wake-lock and fullscreen toggles are browser-shaped affordances.
 * Inside the shell the native layer keeps the screen awake and goes immersive for
 * the whole nursery session, so the controls would be inert at best and
 * contradictory at worst — the wake-lock card currently renders
 * "Wake lock not supported" there.
 */
export function nurseryDisplayControls(isNative: boolean): {
  showWakeLock: boolean;
  showFullscreen: boolean;
} {
  return { showWakeLock: !isNative, showFullscreen: !isNative };
}
