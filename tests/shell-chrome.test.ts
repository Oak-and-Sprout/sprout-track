import { describe, expect, it } from 'vitest'
import { sideNavFooterButtons, trialCtaMode, shellSubscriptionControls, nurseryDisplayControls } from '@/src/utils/shell-chrome'

describe('sideNavFooterButtons', () => {
  // 'switch-family' is shell-only: SideNav renders that entry only when the host
  // supplies onSwitchFamily, and client-layout passes it solely when
  // isNativeApp(). Listing it for web made this function describe a button that
  // never renders there.
  it('web: settings, logout', () => {
    expect(sideNavFooterButtons(false)).toEqual(['settings', 'logout'])
  })
  it('shell: settings + single exit', () => {
    expect(sideNavFooterButtons(true)).toEqual(['settings', 'exit-to-families'])
  })
  it('never offers switch-family on web', () => {
    expect(sideNavFooterButtons(false)).not.toContain('switch-family')
  })
})

describe('trialCtaMode', () => {
  it('is payment-modal on web, external in shell', () => {
    expect(trialCtaMode(false)).toBe('payment-modal')
    expect(trialCtaMode(true)).toBe('external')
  })
})

describe('shellSubscriptionControls', () => {
  it('web keeps all payment surfaces', () => {
    expect(shellSubscriptionControls(false, 'active', true))
      .toEqual({ showPaymentActions: true, showPaymentHistory: true, showExternalManage: false, showWebNote: false })
  })
  it.each(['trial', 'active', 'expired'] as const)('shell + %s: display-only with external manage', (kind) => {
    expect(shellSubscriptionControls(true, kind, true))
      .toEqual({ showPaymentActions: false, showPaymentHistory: false, showExternalManage: true, showWebNote: true })
  })
  it('shell + lifetime or no family: no external manage', () => {
    expect(shellSubscriptionControls(true, 'lifetime', true).showExternalManage).toBe(false)
    expect(shellSubscriptionControls(true, 'trial', false).showExternalManage).toBe(false)
  })
})

describe('nurseryDisplayControls', () => {
  it('shows both controls in a browser', () => {
    expect(nurseryDisplayControls(false)).toEqual({ showWakeLock: true, showFullscreen: true })
  })

  it('hides both in the shell — the app owns keep-awake and immersive', () => {
    expect(nurseryDisplayControls(true)).toEqual({ showWakeLock: false, showFullscreen: false })
  })
})
