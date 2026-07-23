import { describe, expect, it, vi } from 'vitest'
import { consumeInjectedSessionFrom, type InjectedSessionEnv } from '@/src/utils/native-session'
import { encodeMessage } from '@/src/utils/bridge-contract'

function makeEnv(overrides: Partial<InjectedSessionEnv> = {}): InjectedSessionEnv & {
  stored: Record<string, string>
  replaced: string[]
} {
  const stored: Record<string, string> = {}
  const replaced: string[] = []
  return {
    hash: '#bridge-session=' + encodeURIComponent(encodeMessage({
      type: 'sessionInjected', slug: 'smith-family', token: 'jwt123', caretakerId: '42',
    })),
    pathname: '/smith-family/log-entry',
    search: '',
    native: true,
    storage: { setItem: (k, v) => { stored[k] = v } },
    replaceUrl: url => replaced.push(url),
    now: () => 1_752_000_000_000,
    stored,
    replaced,
    ...overrides,
  }
}

describe('consumeInjectedSessionFrom', () => {
  it('injects the session and strips the fragment', () => {
    const env = makeEnv()
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect(env.stored.authToken).toBe('jwt123')
    expect(env.stored.unlockTime).toBe('1752000000000')
    expect(env.stored.caretakerId).toBe('42')
    expect(env.replaced).toEqual(['/smith-family/log-entry'])
  })

  it('omits caretakerId when the message has none', () => {
    const env = makeEnv({
      hash: '#bridge-session=' + encodeURIComponent(encodeMessage({
        type: 'sessionInjected', slug: 'smith-family', token: 'jwt123',
      })),
    })
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect('caretakerId' in env.stored).toBe(false)
  })

  it('no-ops entirely without the fragment', () => {
    const env = makeEnv({ hash: '' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(env.replaced).toEqual([])
    expect(Object.keys(env.stored)).toEqual([])
  })

  it('no-ops (fragment kept) outside the native app', () => {
    const env = makeEnv({ native: false })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(env.replaced).toEqual([])
    expect(Object.keys(env.stored)).toEqual([])
  })

  it('strips but does not inject on slug mismatch', () => {
    const env = makeEnv({ pathname: '/other-family/log-entry' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(Object.keys(env.stored)).toEqual([])
    expect(env.replaced).toEqual(['/other-family/log-entry'])
  })

  it('strips but does not inject on malformed payloads', () => {
    const env = makeEnv({ hash: '#bridge-session=%%%not-valid' })
    expect(consumeInjectedSessionFrom(env)).toBe(false)
    expect(Object.keys(env.stored)).toEqual([])
    expect(env.replaced.length).toBe(1)
  })

  it('preserves the query string when stripping', () => {
    const env = makeEnv({ search: '?src=x' })
    expect(consumeInjectedSessionFrom(env)).toBe(true)
    expect(env.replaced).toEqual(['/smith-family/log-entry?src=x'])
  })
})
