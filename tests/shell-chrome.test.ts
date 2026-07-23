import { describe, expect, it } from 'vitest'
import { sideNavFooterButtons, trialCtaMode, shellSubscriptionControls } from '@/src/utils/shell-chrome'

describe('sideNavFooterButtons', () => {
  it('web: switch-family, settings, logout', () => {
    expect(sideNavFooterButtons(false)).toEqual(['switch-family', 'settings', 'logout'])
  })
  it('shell: settings + single exit', () => {
    expect(sideNavFooterButtons(true)).toEqual(['settings', 'exit-to-families'])
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
