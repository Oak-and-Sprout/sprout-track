// VENDORED from mobile-app-v1/shared/bridge-contract.ts — do not edit here.
// Update the source file first, then re-copy. tests/bridge-contract.test.ts guards drift.
export const BRIDGE_CONTRACT_VERSION = 1

export type WebToNativeMessage =
  | { type: 'keepAwake'; on: boolean }
  | { type: 'capturePhoto' }
  | { type: 'sessionExpired' }
  | { type: 'loggedOut'; reason: string }
  | { type: 'registerPushToken'; jwt: string }

export type NativeToWebMessage =
  | { type: 'sessionInjected'; slug: string }
  | { type: 'appResumed' }

type AnyMessage = WebToNativeMessage | NativeToWebMessage

const VALIDATORS: Record<string, (m: Record<string, unknown>) => boolean> = {
  keepAwake: m => typeof m.on === 'boolean',
  capturePhoto: () => true,
  sessionExpired: () => true,
  loggedOut: m => typeof m.reason === 'string',
  registerPushToken: m => typeof m.jwt === 'string',
  sessionInjected: m => typeof m.slug === 'string',
  appResumed: () => true,
}

export function encodeMessage(msg: AnyMessage): string {
  return JSON.stringify({ v: BRIDGE_CONTRACT_VERSION, msg })
}

export function decodeMessage(raw: string): { v: number; msg: AnyMessage } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { v, msg } = parsed as { v?: unknown; msg?: unknown }
  if (typeof v !== 'number' || v > BRIDGE_CONTRACT_VERSION) return null
  if (typeof msg !== 'object' || msg === null) return null
  const type = (msg as { type?: unknown }).type
  if (typeof type !== 'string' || !VALIDATORS[type]) return null
  if (VALIDATORS[type]?.(msg as Record<string, unknown>) !== true) return null
  return { v, msg: msg as AnyMessage }
}
