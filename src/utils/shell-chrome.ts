/**
 * Presentation rules for chrome that must differ inside the native Capacitor
 * shell to stay compliant with Apple/Google in-app-purchase policy: no
 * in-app payment flows may be surfaced when running in the shell, and
 * subscription management must be pointed at the web instead.
 */

export type SideNavFooterButton = 'switch-family' | 'settings' | 'logout' | 'exit-to-families';

export function sideNavFooterButtons(isNative: boolean): SideNavFooterButton[] {
  if (isNative) return ['settings', 'exit-to-families'];
  return ['switch-family', 'settings', 'logout'];
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
