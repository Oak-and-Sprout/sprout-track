# Native-Aware Layer + Native Push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Sprout Track web app cooperate with its Capacitor mobile shell (wake lock, camera, logout handoff, side-nav escape hatch, service-worker suppression) and add a native FCM push channel (DeviceToken table, registration API, send path) beside the existing VAPID web push.

**Architecture:** All client behavior changes are gated behind detection of the shell's custom user-agent (`SproutTrackApp/<ver> (ios|android)`), implemented as pure functions in `src/utils/` per repo convention — every change no-ops in a normal browser. Web → shell communication uses a `?bridge-event=` query parameter on the shell's origin (no native plugin required); the message format is the versioned bridge contract vendored from the mobile repo. The FCM channel mirrors the existing web-push architecture: a `DeviceToken` model patterned on `PushSubscription`, a `withAuthContext` API route, and a send module invoked at the same per-preference sites as `sendNotificationWithLogging`.

**Tech Stack:** Existing repo stack (Next.js App Router, Prisma SQLite/Postgres, Vitest node-env tests in `tests/`, `@/` alias). New: FCM HTTP v1 API called via `fetch` with a `jsonwebtoken` RS256 service-account grant (no firebase-admin dependency). Companion tasks in the mobile repo use its existing Capacitor 8 stack.

## Global Constraints

- Repo: `/Users/johnoverton/Development/mobile-app-v1/sprout-track` (Tasks 1–13). Companion Tasks 14–16 run in `/Users/johnoverton/Development/mobile-app-v1` (the shell repo) — each task states its repo; never mix.
- Work on branch `feature/native-aware-layer` in the sprout-track repo (created in Task 1); the shell repo tasks commit to its `main` (it's pre-release).
- Follow the repo's CLAUDE.md: fewest lines possible; preserve formatting; all user-facing text through `t()` with keys added to `src/localization/translations/en.json` then `node scripts/check-missing-translations.js`; no Tailwind `dark:` classes; Prisma must stay SQLite AND Postgres compatible; tests are `tests/*.test.ts`, node environment, `@/` alias, pure-function style.
- Native detection: user-agent regex `SproutTrackApp\/[\w.]+ \((ios|android)\)`. Shell origins: iOS `capacitor://localhost`, Android `https://localhost`.
- Bridge contract file is vendored VERBATIM from `/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts` — do not edit its logic; a drift test guards it.
- API response envelope `{ success, data?, error? }`; family scoping ONLY from `authContext.familyId` (golden rule).
- FCM config env var: `FCM_SERVICE_ACCOUNT_JSON` (inline service-account JSON). `nativePushEnabled` is exposed on `GET /api/deployment-config`.
- Commits: conventional prefixes, commit at each task's end.
- Known v1 limitations to preserve in docs, not "fix": a user with multiple web-push subscriptions may get duplicate FCM pushes for activity events (timer events collapse via stable tag); notification-tap deep-link routing is deferred; `sessionExpired` bridge message is unused (single `loggedOut(reason)` covers both flows — the shell's default fast-path silently re-logs-in).

## File Structure (sprout-track repo)

```
src/utils/native-app.ts            # UA detection, Capacitor plugin access, shell origin, SW/wake-lock/push gates (pure)
src/utils/bridge-contract.ts       # vendored contract (verbatim copy)
src/utils/native-bridge.ts         # shellReturnUrl / navigateToShell
src/utils/native-push.ts           # client-side FCM token registration via bridge plugin
src/lib/notifications/fcmPush.ts   # server FCM HTTP v1 send + token lifecycle
app/api/notifications/device-tokens/route.ts       # POST/DELETE, withAuthContext
app/api/notifications/device-tokens/validation.ts  # pure body validator
prisma/schema.prisma               # + DeviceToken model (+ back-relations)
tests/native-app.test.ts  tests/bridge-contract.test.ts  tests/native-bridge.test.ts
tests/device-token-validation.test.ts  tests/fcm-push.test.ts
(modified) src/hooks/useWakeLock.ts, src/hooks/useCameraStrategy.ts, src/utils/photoUtils.ts,
src/lib/notifications/client.ts, src/lib/notifications/timerCheck.ts, src/lib/notifications/activityHook.ts,
src/components/ui/side-nav/{index.tsx,side-nav.types.ts}, app/(app)/[slug]/client-layout.tsx,
app/api/deployment-config/route.ts, tests/photoUtils.test.ts, tests/session-timeout.test.ts (unchanged),
src/localization/translations/*.json, documentation/Admin-Documentation/environment-variables.md
```

---

### Task 1: Native detection utility (`native-app.ts`)

**Repo:** sprout-track
**Files:**
- Create: `src/utils/native-app.ts`, `tests/native-app.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 3–8, 13):
  ```ts
  export type NativePlatform = 'ios' | 'android'
  export interface NativeAppInfo { isNative: boolean; platform: NativePlatform | null }
  export function detectNativeApp(userAgent: string): NativeAppInfo
  export function isNativeApp(): boolean                       // browser entry point
  export function getCapacitorPlugin<T = unknown>(name: string): T | null
  export function shellOrigin(platform: NativePlatform): string
  export function chooseWakeLockMechanism(flags: { hasKeepAwakePlugin: boolean; hasWakeLockApi: boolean }): 'plugin' | 'browser' | 'none'
  export function shouldRegisterServiceWorker(flags: { isNative: boolean; hasServiceWorker: boolean; isSecureContext: boolean }): boolean
  ```

- [ ] **Step 1: Create the feature branch**

```bash
cd /Users/johnoverton/Development/mobile-app-v1/sprout-track
git checkout -b feature/native-aware-layer
git add docs/superpowers/plans/2026-07-20-native-aware-layer-and-push.md
git commit -m "docs: plan for native-aware layer and native push"
```

- [ ] **Step 2: Write the failing tests**

`tests/native-app.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  detectNativeApp,
  shellOrigin,
  chooseWakeLockMechanism,
  shouldRegisterServiceWorker,
} from '@/src/utils/native-app';

describe('detectNativeApp', () => {
  it('detects the iOS shell user agent', () => {
    const ua = 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 SproutTrackApp/0.1.0 (ios)';
    expect(detectNativeApp(ua)).toEqual({ isNative: true, platform: 'ios' });
  });

  it('detects the Android shell user agent', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 14) Chrome/126 SproutTrackApp/0.1.0 (android)';
    expect(detectNativeApp(ua)).toEqual({ isNative: true, platform: 'android' });
  });

  it('returns non-native for a normal browser UA', () => {
    expect(detectNativeApp('Mozilla/5.0 (Macintosh) Safari/605.1.15')).toEqual({
      isNative: false,
      platform: null,
    });
  });
});

describe('shellOrigin', () => {
  it('maps platforms to Capacitor origins', () => {
    expect(shellOrigin('ios')).toBe('capacitor://localhost');
    expect(shellOrigin('android')).toBe('https://localhost');
  });
});

describe('chooseWakeLockMechanism', () => {
  it('prefers the KeepAwake plugin when present', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: true, hasWakeLockApi: true })).toBe('plugin');
  });
  it('falls back to the browser API', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: false, hasWakeLockApi: true })).toBe('browser');
  });
  it('returns none when neither exists', () => {
    expect(chooseWakeLockMechanism({ hasKeepAwakePlugin: false, hasWakeLockApi: false })).toBe('none');
  });
});

describe('shouldRegisterServiceWorker', () => {
  it('refuses inside the native app', () => {
    expect(shouldRegisterServiceWorker({ isNative: true, hasServiceWorker: true, isSecureContext: true })).toBe(false);
  });
  it('requires serviceWorker support and a secure context', () => {
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: true, isSecureContext: true })).toBe(true);
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: false, isSecureContext: true })).toBe(false);
    expect(shouldRegisterServiceWorker({ isNative: false, hasServiceWorker: true, isSecureContext: false })).toBe(false);
  });
});
```

Run: `npm test -- tests/native-app.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

`src/utils/native-app.ts`:
```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/native-app.test.ts` → PASS (8 tests). Then `npm test` → full suite green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/native-app.ts tests/native-app.test.ts
git commit -m "feat: native shell detection utility"
```

---

### Task 2: Vendored bridge contract + drift test

**Repo:** sprout-track
**Files:**
- Create: `src/utils/bridge-contract.ts` (copy), `tests/bridge-contract.test.ts`

**Interfaces:**
- Consumes: `/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts` (source of truth — copy only).
- Produces: `BRIDGE_CONTRACT_VERSION`, `WebToNativeMessage`, `NativeToWebMessage`, `encodeMessage`, `decodeMessage` (same exports as the mobile repo's file).

- [ ] **Step 1: Copy the contract verbatim, adding only a provenance header**

```bash
{ echo '// VENDORED from mobile-app-v1/shared/bridge-contract.ts — do not edit here.'; \
  echo '// Update the source file first, then re-copy. tests/bridge-contract.test.ts guards drift.'; \
  cat /Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts; } \
  > src/utils/bridge-contract.ts
```

- [ ] **Step 2: Write the drift-guard tests**

`tests/bridge-contract.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  BRIDGE_CONTRACT_VERSION,
  decodeMessage,
  encodeMessage,
} from '@/src/utils/bridge-contract';

describe('vendored bridge contract', () => {
  it('is version 1', () => {
    expect(BRIDGE_CONTRACT_VERSION).toBe(1);
  });

  it('round-trips a loggedOut message', () => {
    const decoded = decodeMessage(encodeMessage({ type: 'loggedOut', reason: 'switch-family' }));
    expect(decoded).toEqual({
      v: BRIDGE_CONTRACT_VERSION,
      msg: { type: 'loggedOut', reason: 'switch-family' },
    });
  });

  it('rejects a payload with a missing required field', () => {
    expect(decodeMessage(JSON.stringify({ v: 1, msg: { type: 'loggedOut' } }))).toBeNull();
  });

  it('rejects messages from a newer contract version', () => {
    const raw = JSON.stringify({ v: BRIDGE_CONTRACT_VERSION + 1, msg: { type: 'appResumed' } });
    expect(decodeMessage(raw)).toBeNull();
  });

  it('matches the mobile repo source byte-for-byte after the vendor header', () => {
    // Drift guard: if this fails, re-copy from mobile-app-v1/shared/bridge-contract.ts.
    // Uses node fs because vitest runs in node environment.
    const fs = require('node:fs') as typeof import('node:fs');
    const vendored = fs
      .readFileSync('src/utils/bridge-contract.ts', 'utf8')
      .split('\n')
      .slice(2)
      .join('\n');
    const source = fs.readFileSync(
      '/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts',
      'utf8'
    );
    expect(vendored).toBe(source);
  });
});
```

Note: the byte-for-byte test depends on the sibling checkout existing at that absolute path; guard it so CI elsewhere doesn't break — wrap the final test body: `if (!fs.existsSync('/Users/johnoverton/Development/mobile-app-v1/shared/bridge-contract.ts')) return;` as its first line.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/bridge-contract.test.ts` → PASS (5 tests).

- [ ] **Step 4: Commit**

```bash
git add src/utils/bridge-contract.ts tests/bridge-contract.test.ts
git commit -m "feat: vendor mobile bridge contract with drift guard"
```

---

### Task 3: Bridge event navigation (`native-bridge.ts`)

**Repo:** sprout-track
**Files:**
- Create: `src/utils/native-bridge.ts`, `tests/native-bridge.test.ts`

**Interfaces:**
- Consumes: `detectNativeApp`, `shellOrigin` (Task 1); `encodeMessage`, `WebToNativeMessage` (Task 2).
- Produces (used by Tasks 4, 8):
  ```ts
  export function shellReturnUrl(userAgent: string, msg: WebToNativeMessage): string | null
  export function navigateToShell(msg: WebToNativeMessage): boolean  // false in normal browsers
  ```

- [ ] **Step 1: Write the failing tests**

`tests/native-bridge.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shellReturnUrl } from '@/src/utils/native-bridge';
import { decodeMessage } from '@/src/utils/bridge-contract';

const IOS_UA = 'Mozilla/5.0 (iPhone) SproutTrackApp/0.1.0 (ios)';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14) SproutTrackApp/0.1.0 (android)';

describe('shellReturnUrl', () => {
  it('builds a capacitor origin URL with the encoded event for iOS', () => {
    const url = shellReturnUrl(IOS_UA, { type: 'loggedOut', reason: 'switch-family' });
    expect(url).toMatch(/^capacitor:\/\/localhost\/\?bridge-event=/);
    const encoded = decodeURIComponent(url!.split('bridge-event=')[1]);
    expect(decodeMessage(encoded)).toEqual({
      v: 1,
      msg: { type: 'loggedOut', reason: 'switch-family' },
    });
  });

  it('uses the https origin for Android', () => {
    const url = shellReturnUrl(ANDROID_UA, { type: 'loggedOut', reason: 'logout-401' });
    expect(url).toMatch(/^https:\/\/localhost\/\?bridge-event=/);
  });

  it('returns null for a normal browser UA', () => {
    expect(shellReturnUrl('Mozilla/5.0 Safari', { type: 'sessionExpired' })).toBeNull();
  });
});
```

Run: `npm test -- tests/native-bridge.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement**

`src/utils/native-bridge.ts`:
```ts
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
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/native-bridge.test.ts` → PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add src/utils/native-bridge.ts tests/native-bridge.test.ts
git commit -m "feat: shell return navigation via bridge-event query param"
```

---

### Task 4: Logout handoff to the shell

**Repo:** sprout-track
**Files:**
- Modify: `app/(app)/[slug]/client-layout.tsx` (two logout sites: the `router.push(logoutDestination(...))` at ~line 369 inside `handleLogout`, and the `window.location.href = logoutDestination(...)` at ~line 1036)

**Interfaces:**
- Consumes: `navigateToShell` (Task 3).
- Produces: when running in the shell, every logout path (user logout, idle logout, 401-refresh-failure via `FamilyProvider onLogout`) navigates to the shell with `{ type: 'loggedOut', reason }` instead of the web marketing/login pages. The shell's launch flow then either silently re-logs-in (default fast-path) or shows the family list.

No new unit test: `client-layout.tsx` is a React client component outside the node-test seam; the pure pieces (`shellReturnUrl`) are covered by Task 3. Verification is behavioral (Step 3).

- [ ] **Step 1: Add the import**

In `app/(app)/[slug]/client-layout.tsx`, alongside the existing `logoutDestination` import from `@/src/utils/session-timeout`, add:
```ts
import { navigateToShell } from '@/src/utils/native-bridge';
```

- [ ] **Step 2: Guard both logout navigations**

At the `handleLogout` site (currently `router.push(logoutDestination({ isAccountAuth, familySlug, reason }));`), change to:
```ts
    if (navigateToShell({ type: 'loggedOut', reason })) return;
    router.push(logoutDestination({ isAccountAuth, familySlug, reason }));
```

At the second site (currently `window.location.href = logoutDestination({ isAccountAuth, familySlug, reason });`), change to:
```ts
    if (navigateToShell({ type: 'loggedOut', reason })) return;
    window.location.href = logoutDestination({ isAccountAuth, familySlug, reason });
```

- [ ] **Step 3: Verify**

Run: `npm test` (full suite still green — no behavior change in tested modules) and `npx tsc --noEmit` → clean.
Browser check: `npm run dev`, log in to a family, log out → behavior unchanged (normal UA → `navigateToShell` returns false).

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/[slug]/client-layout.tsx"
git commit -m "feat: hand logout back to the native shell when running in-app"
```

---

### Task 5: Wake lock via KeepAwake plugin

**Repo:** sprout-track
**Files:**
- Modify: `src/hooks/useWakeLock.ts`

**Interfaces:**
- Consumes: `getCapacitorPlugin`, `chooseWakeLockMechanism` (Task 1).
- Produces: same hook API (`{ isActive, isSupported, request, release }`); on native with the KeepAwake plugin available, uses `KeepAwake.keepAwake()` / `KeepAwake.allowSleep()` instead of `navigator.wakeLock`.

The decision logic (`chooseWakeLockMechanism`) is already unit-tested in Task 1; the hook change is thin glue.

- [ ] **Step 1: Implement**

Replace `src/hooks/useWakeLock.ts` with:
```ts
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { chooseWakeLockMechanism, getCapacitorPlugin } from '@/src/utils/native-app';

interface KeepAwakePlugin {
  keepAwake(): Promise<void>;
  allowSleep(): Promise<void>;
}

function keepAwakePlugin(): KeepAwakePlugin | null {
  return getCapacitorPlugin<KeepAwakePlugin>('KeepAwake');
}

function mechanism(): 'plugin' | 'browser' | 'none' {
  return chooseWakeLockMechanism({
    hasKeepAwakePlugin: keepAwakePlugin() !== null,
    hasWakeLockApi: 'wakeLock' in navigator,
  });
}

export function useWakeLock() {
  const [isActive, setIsActive] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setIsSupported(mechanism() !== 'none');
  }, []);

  const request = useCallback(async () => {
    const how = mechanism();
    if (how === 'none') return;
    try {
      if (how === 'plugin') {
        await keepAwakePlugin()!.keepAwake();
        setIsActive(true);
        return;
      }
      sentinelRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);
      sentinelRef.current.addEventListener('release', () => {
        setIsActive(false);
      });
    } catch (err) {
      console.error('Wake Lock request failed:', err);
      setIsActive(false);
    }
  }, []);

  const release = useCallback(async () => {
    if (mechanism() === 'plugin') {
      try {
        await keepAwakePlugin()!.allowSleep();
      } catch {
        // Already released
      }
      setIsActive(false);
      return;
    }
    if (sentinelRef.current) {
      try {
        await sentinelRef.current.release();
      } catch {
        // Already released
      }
      sentinelRef.current = null;
      setIsActive(false);
    }
  }, []);

  // Auto-acquire on mount and re-acquire on visibility change
  useEffect(() => {
    if (mechanism() === 'none') return;

    request();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, [request, release]);

  return { isActive, isSupported, request, release };
}
```

- [ ] **Step 2: Verify**

Run: `npm test` → green; `npx tsc --noEmit` → clean.
Browser check: nursery mode still acquires the browser wake lock (devtools console shows no errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useWakeLock.ts
git commit -m "feat: use KeepAwake plugin for wake lock inside the native shell"
```

---

### Task 6: Camera strategy on native

**Repo:** sprout-track
**Files:**
- Modify: `src/utils/photoUtils.ts` (the `CameraCapabilityFlags` type and `decideCameraStrategy`, ~line 126), `src/hooks/useCameraStrategy.ts`
- Test: `tests/photoUtils.test.ts` (extend)

**Interfaces:**
- Consumes: `isNativeApp` (Task 1).
- Produces: `decideCameraStrategy` gains a `isNativeApp: boolean` flag; native → always `'native-capture'` (the WebView's file input with `capture="environment"` opens the OS camera — no Capacitor Camera plugin needed).

- [ ] **Step 1: Write the failing tests**

Append to `tests/photoUtils.test.ts` (match the file's existing describe/import style — it already imports `decideCameraStrategy`):
```ts
describe('decideCameraStrategy in the native app', () => {
  it('always uses native capture inside the shell', () => {
    expect(
      decideCameraStrategy({ isNativeApp: true, coarsePointer: false, maxTouchPoints: 0, hasMediaDevices: true })
    ).toBe('native-capture');
  });

  it('is unchanged outside the shell', () => {
    expect(
      decideCameraStrategy({ isNativeApp: false, coarsePointer: false, maxTouchPoints: 0, hasMediaDevices: true })
    ).toBe('webcam-modal');
  });
});
```

Run: `npm test -- tests/photoUtils.test.ts` → FAIL (type error / wrong strategy). Note: existing call sites/tests must be updated with the new flag; TypeScript will list them.

- [ ] **Step 2: Implement**

In `src/utils/photoUtils.ts`: add `isNativeApp: boolean;` to `CameraCapabilityFlags`, and make the first line of `decideCameraStrategy`:
```ts
  if (flags.isNativeApp) return 'native-capture';
```

In `src/hooks/useCameraStrategy.ts`: import `{ isNativeApp } from '@/src/utils/native-app'` and pass the flag in `check()`:
```ts
      decideCameraStrategy({
        isNativeApp: isNativeApp(),
        coarsePointer: window.matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints,
        hasMediaDevices: !!navigator.mediaDevices?.getUserMedia,
      })
```

Update any existing `decideCameraStrategy` tests in `tests/photoUtils.test.ts` to pass `isNativeApp: false` (preserving their current expectations).

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/photoUtils.test.ts` → PASS; `npm test` → full green; `npx tsc --noEmit` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/utils/photoUtils.ts src/hooks/useCameraStrategy.ts tests/photoUtils.test.ts
git commit -m "feat: force native camera capture strategy inside the shell"
```

---

### Task 7: Suppress the service worker in the native app

**Repo:** sprout-track
**Files:**
- Modify: `src/lib/notifications/client.ts` (`registerPwaServiceWorker`, ~lines 92-110)

**Interfaces:**
- Consumes: `shouldRegisterServiceWorker`, `isNativeApp` (Task 1 — the gate logic is already tested there).
- Produces: no SW registration inside the shell (its caching would fight shell navigation; the native app doesn't need PWA installability).

- [ ] **Step 1: Implement**

In `src/lib/notifications/client.ts`, import `{ isNativeApp, shouldRegisterServiceWorker } from '@/src/utils/native-app';` and replace the two guard clauses at the top of `registerPwaServiceWorker` with:
```ts
  if (
    !shouldRegisterServiceWorker({
      isNative: isNativeApp(),
      hasServiceWorker: 'serviceWorker' in navigator,
      isSecureContext: window.isSecureContext,
    })
  ) {
    if (!window.isSecureContext) console.warn('PWA service worker requires HTTPS (or localhost)');
    return;
  }
```

- [ ] **Step 2: Verify**

Run: `npm test` → green; `npx tsc --noEmit` → clean. Browser check: `npm run dev`, devtools Application tab still shows `sw.js` registered on localhost.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/client.ts
git commit -m "feat: skip service worker registration inside the native shell"
```

---

### Task 8: "Switch Family" side-nav item

**Repo:** sprout-track
**Files:**
- Modify: `src/components/ui/side-nav/side-nav.types.ts` (SideNavProps), `src/components/ui/side-nav/index.tsx` (footer), `app/(app)/[slug]/client-layout.tsx` (both `<SideNav ...>` sites, ~lines 794 and 893), `src/localization/translations/en.json`

**Interfaces:**
- Consumes: `isNativeApp` (Task 1), `navigateToShell` (Task 3), existing `FooterButton` in side-nav.
- Produces: optional `onSwitchFamily?: () => void` prop on SideNav; when provided, a footer button labeled `t('Switch Family')` renders above Logout. The shell treats `loggedOut` with reason `'switch-family'` as "show the family list, keep the session".

- [ ] **Step 1: Add the prop and footer button**

`side-nav.types.ts` — add to `SideNavProps`:
```ts
  /** Renders a "Switch Family" footer button (used inside the native mobile shell). */
  onSwitchFamily?: () => void;
```

`index.tsx` — add `ArrowLeftRight` to the existing `lucide-react` import, accept `onSwitchFamily` in the component's destructured props, and in the footer (before the Settings/Logout `FooterButton`s) add:
```tsx
          {onSwitchFamily && (
            <FooterButton
              icon={<ArrowLeftRight aria-hidden="true" />}
              label={t('Switch Family')}
              onClick={onSwitchFamily}
            />
          )}
```

- [ ] **Step 2: Wire it in client-layout**

In `app/(app)/[slug]/client-layout.tsx`, at BOTH `<SideNav` sites, add alongside `onLogout`:
```tsx
              onSwitchFamily={
                isNativeApp()
                  ? () => navigateToShell({ type: 'loggedOut', reason: 'switch-family' })
                  : undefined
              }
```
with `import { isNativeApp } from '@/src/utils/native-app';` added to the imports (navigateToShell import exists from Task 4).

- [ ] **Step 3: Localization**

Add `"Switch Family": "Switch Family"` to `src/localization/translations/en.json`, then:
```bash
node scripts/check-missing-translations.js
```
Fill in the new key's translations in `es.json` ("Cambiar de familia"), `fr.json` ("Changer de famille"), `de.json` ("Familie wechseln"), `it.json` ("Cambia famiglia").

- [ ] **Step 4: Verify and commit**

Run: `npm test` → green; `npx tsc --noEmit` → clean. Browser check: side-nav renders WITHOUT the new button (normal UA).
```bash
git add src/components/ui/side-nav app/\(app\)/\[slug\]/client-layout.tsx src/localization/translations
git commit -m "feat: switch-family side-nav action for the native shell"
```

---

### Task 9: DeviceToken Prisma model + migration

**Repo:** sprout-track
**Files:**
- Modify: `prisma/schema.prisma` (new model + back-relations on `Family`, `Account`, `Caretaker`)
- Create: migration via prisma CLI

**Interfaces:**
- Consumes: existing `PushSubscription` conventions (cuid id, required `familyId`, indexes).
- Produces (used by Tasks 10-12): `prisma.deviceToken` with fields `{ id, token (unique), platform, accountId?, caretakerId?, familyId, failureCount, lastFailureAt?, lastSuccessAt?, createdAt, updatedAt }`.

- [ ] **Step 1: Add the model**

Append to `prisma/schema.prisma` (next to `PushSubscription`), SQLite+Postgres-safe types only:
```prisma
model DeviceToken {
  id            String    @id @default(cuid())
  token         String    @unique
  platform      String // 'ios' | 'android'
  accountId     String?
  caretakerId   String?
  familyId      String
  failureCount  Int       @default(0)
  lastFailureAt DateTime?
  lastSuccessAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  account   Account?   @relation(fields: [accountId], references: [id])
  caretaker Caretaker? @relation(fields: [caretakerId], references: [id])
  family    Family     @relation(fields: [familyId], references: [id])

  @@index([accountId])
  @@index([caretakerId])
  @@index([familyId])
}
```
And add back-relations: `deviceTokens DeviceToken[]` to the `Family` model (next to `pushSubscriptions PushSubscription[]`), and `deviceTokens DeviceToken[]` to both `Account` and `Caretaker` models.

- [ ] **Step 2: Generate the migration**

```bash
npm run prisma:generate
npx prisma migrate dev --name add_device_token
```
Expected: a new `prisma/migrations/<timestamp>_add_device_token/` directory; `prisma generate` succeeds.

- [ ] **Step 3: Verify and commit**

Run: `npm test` → green (schema change breaks nothing); `npx tsc --noEmit` → clean.
```bash
git add prisma
git commit -m "feat: DeviceToken model for native push"
```

---

### Task 10: Device-token registration API

**Repo:** sprout-track
**Files:**
- Create: `app/api/notifications/device-tokens/route.ts`, `app/api/notifications/device-tokens/validation.ts`, `tests/device-token-validation.test.ts`

**Interfaces:**
- Consumes: `withAuthContext`, `AuthResult` from `app/api/utils/auth`; `prisma.deviceToken` (Task 9).
- Produces: `POST /api/notifications/device-tokens` body `{ token, platform }` (upsert by unique token, scoped to `authContext`), `DELETE /api/notifications/device-tokens?token=...` (family-verified delete). Plus pure `parseDeviceTokenBody(body: unknown): { token: string; platform: 'ios' | 'android' } | null`.

- [ ] **Step 1: Write the failing validator tests**

`tests/device-token-validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseDeviceTokenBody } from '@/app/api/notifications/device-tokens/validation';

describe('parseDeviceTokenBody', () => {
  it('accepts a valid ios body', () => {
    expect(parseDeviceTokenBody({ token: 'abc123', platform: 'ios' })).toEqual({
      token: 'abc123',
      platform: 'ios',
    });
  });

  it('accepts android and trims the token', () => {
    expect(parseDeviceTokenBody({ token: '  t1  ', platform: 'android' })).toEqual({
      token: 't1',
      platform: 'android',
    });
  });

  it('rejects unknown platforms, empty/oversized tokens, and non-objects', () => {
    expect(parseDeviceTokenBody({ token: 't', platform: 'web' })).toBeNull();
    expect(parseDeviceTokenBody({ token: '', platform: 'ios' })).toBeNull();
    expect(parseDeviceTokenBody({ token: 'x'.repeat(4097), platform: 'ios' })).toBeNull();
    expect(parseDeviceTokenBody(null)).toBeNull();
    expect(parseDeviceTokenBody('token')).toBeNull();
  });
});
```

Run: `npm test -- tests/device-token-validation.test.ts` → FAIL.

- [ ] **Step 2: Implement the validator**

`app/api/notifications/device-tokens/validation.ts`:
```ts
export interface DeviceTokenBody {
  token: string;
  platform: 'ios' | 'android';
}

const MAX_TOKEN_LENGTH = 4096;

export function parseDeviceTokenBody(body: unknown): DeviceTokenBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { token, platform } = body as { token?: unknown; platform?: unknown };
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_TOKEN_LENGTH) return null;
  if (platform !== 'ios' && platform !== 'android') return null;
  return { token: trimmed, platform };
}
```

Run: `npm test -- tests/device-token-validation.test.ts` → PASS.

- [ ] **Step 3: Implement the route**

`app/api/notifications/device-tokens/route.ts` (modeled on `app/api/notifications/subscribe/route.ts`):
```ts
import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../db';
import { ApiResponse } from '../../types';
import { withAuthContext, AuthResult } from '../../utils/auth';
import { parseDeviceTokenBody } from './validation';

async function handlePost(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  const { familyId, accountId, caretakerId } = authContext;

  if (!familyId) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'User is not associated with a family.' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const parsed = parseDeviceTokenBody(body);
  if (!parsed) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: 'Invalid device token payload.' },
      { status: 400 }
    );
  }

  const data = {
    platform: parsed.platform,
    familyId,
    accountId: accountId ?? null,
    caretakerId: caretakerId ?? null,
  };
  const record = await prisma.deviceToken.upsert({
    where: { token: parsed.token },
    update: data,
    create: { token: parsed.token, ...data },
  });

  return NextResponse.json<ApiResponse<{ id: string }>>({ success: true, data: { id: record.id } });
}

async function handleDelete(req: NextRequest, authContext: AuthResult): Promise<NextResponse<ApiResponse<null>>> {
  const { familyId } = authContext;
  const token = req.nextUrl.searchParams.get('token');

  if (!familyId || !token) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Missing token or family context.' },
      { status: 400 }
    );
  }

  const record = await prisma.deviceToken.findUnique({ where: { token } });
  if (!record || record.familyId !== familyId) {
    return NextResponse.json<ApiResponse<null>>(
      { success: false, error: 'Device token not found.' },
      { status: 404 }
    );
  }

  await prisma.deviceToken.delete({ where: { token } });
  return NextResponse.json<ApiResponse<null>>({ success: true });
}

export const POST = withAuthContext(handlePost);
export const DELETE = withAuthContext(handleDelete);
```

- [ ] **Step 4: Verify and commit**

Run: `npm test` → green; `npx tsc --noEmit` → clean.
```bash
git add app/api/notifications/device-tokens tests/device-token-validation.test.ts
git commit -m "feat: device token registration API"
```

---

### Task 11: FCM send module (`fcmPush.ts`)

**Repo:** sprout-track
**Files:**
- Create: `src/lib/notifications/fcmPush.ts`, `tests/fcm-push.test.ts`
- Modify: `documentation/Admin-Documentation/environment-variables.md` (notification section: document `FCM_SERVICE_ACCOUNT_JSON`)

**Interfaces:**
- Consumes: `jsonwebtoken` (already a dependency), `prisma.deviceToken` (Task 9), `NotificationPayload` type from the existing push module (import it exactly as `timerCheck.ts` does — check its import line and reuse).
- Produces (used by Task 12):
  ```ts
  export function loadFcmServiceAccount(env?: NodeJS.ProcessEnv): { projectId: string; clientEmail: string; privateKey: string } | null
  export function isFcmConfigured(): boolean
  export function buildFcmMessage(token: string, payload: NotificationPayload): Record<string, unknown>
  export async function sendToDeviceTokens(
    target: { familyId: string; caretakerId?: string | null; accountId?: string | null },
    payload: NotificationPayload
  ): Promise<number>   // returns number sent; no-op (0) when FCM unconfigured or no matching tokens
  ```
  Token selection: `familyId` matches AND (`caretakerId` matches target's OR `accountId` matches target's); when target has neither caretakerId nor accountId, no tokens are selected. Send result handling mirrors the web-push 410 pattern: FCM `UNREGISTERED`/404 → delete the DeviceToken row; other failures → `failureCount++` and `lastFailureAt`; success → reset `failureCount`, set `lastSuccessAt`.

- [ ] **Step 1: Write the failing tests (pure parts only)**

`tests/fcm-push.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildFcmMessage, loadFcmServiceAccount } from '@/src/lib/notifications/fcmPush';

const SA = {
  project_id: 'sprout-test',
  client_email: 'svc@sprout-test.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
};

describe('loadFcmServiceAccount', () => {
  it('parses inline JSON from FCM_SERVICE_ACCOUNT_JSON', () => {
    const env = { FCM_SERVICE_ACCOUNT_JSON: JSON.stringify(SA) } as NodeJS.ProcessEnv;
    expect(loadFcmServiceAccount(env)).toEqual({
      projectId: 'sprout-test',
      clientEmail: 'svc@sprout-test.iam.gserviceaccount.com',
      privateKey: SA.private_key,
    });
  });

  it('returns null when unset, malformed, or missing fields', () => {
    expect(loadFcmServiceAccount({} as NodeJS.ProcessEnv)).toBeNull();
    expect(loadFcmServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: '{not json' } as NodeJS.ProcessEnv)).toBeNull();
    expect(
      loadFcmServiceAccount({ FCM_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'x' }) } as NodeJS.ProcessEnv)
    ).toBeNull();
  });
});

describe('buildFcmMessage', () => {
  const payload = {
    title: 'Feed timer',
    body: 'Aria — 3h since last feed',
    icon: '/sprout-128.png',
    badge: '/sprout-128.png',
    tag: 'timer-baby1-FEED_TIMER_EXPIRED',
    data: { eventType: 'FEED_TIMER_EXPIRED', babyId: 'baby1' },
  };

  it('maps payload to an FCM v1 message with string-only data', () => {
    const msg = buildFcmMessage('tok1', payload as never) as {
      message: {
        token: string;
        notification: { title: string; body: string };
        data: Record<string, string>;
        android: { collapse_key: string };
        apns: { headers: Record<string, string> };
      };
    };
    expect(msg.message.token).toBe('tok1');
    expect(msg.message.notification).toEqual({ title: 'Feed timer', body: 'Aria — 3h since last feed' });
    expect(msg.message.data).toEqual({ eventType: 'FEED_TIMER_EXPIRED', babyId: 'baby1' });
    expect(Object.values(msg.message.data).every((v) => typeof v === 'string')).toBe(true);
    expect(msg.message.android.collapse_key).toBe('timer-baby1-FEED_TIMER_EXPIRED');
    expect(msg.message.apns.headers['apns-collapse-id']).toBe('timer-baby1-FEED_TIMER_EXPIRED');
  });

  it('omits collapse fields when the payload has no tag', () => {
    const msg = buildFcmMessage('tok1', { ...payload, tag: undefined } as never) as {
      message: Record<string, unknown>;
    };
    expect(msg.message.android).toBeUndefined();
    expect(msg.message.apns).toBeUndefined();
  });
});
```

Run: `npm test -- tests/fcm-push.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/lib/notifications/fcmPush.ts`:
```ts
/**
 * Native push channel: FCM HTTP v1, called directly with fetch. Sits beside the
 * VAPID web-push path (push.ts) and mirrors its token-lifecycle handling:
 * unregistered tokens are deleted, transient failures increment failureCount.
 * Configured via FCM_SERVICE_ACCOUNT_JSON (inline Firebase service-account JSON);
 * unconfigured deployments no-op.
 */

import jwt from 'jsonwebtoken';
import prisma from '../../../app/api/db';
import type { NotificationPayload } from './push';

export interface FcmServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function loadFcmServiceAccount(env: NodeJS.ProcessEnv = process.env): FcmServiceAccount | null {
  const raw = env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (
      typeof parsed.project_id !== 'string' ||
      typeof parsed.client_email !== 'string' ||
      typeof parsed.private_key !== 'string'
    ) {
      return null;
    }
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    return null;
  }
}

export function isFcmConfigured(): boolean {
  return loadFcmServiceAccount() !== null;
}

export function buildFcmMessage(token: string, payload: NotificationPayload): Record<string, unknown> {
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.data ?? {})) {
    data[key] = String(value);
  }
  const message: Record<string, unknown> = {
    token,
    notification: { title: payload.title, body: payload.body },
    data,
  };
  if (payload.tag) {
    message.android = { collapse_key: payload.tag };
    message.apns = { headers: { 'apns-collapse-id': payload.tag } };
  }
  return { message };
}

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(account: FcmServiceAccount): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }
  const assertion = jwt.sign(
    { scope: FCM_SCOPE, aud: OAUTH_TOKEN_URL },
    account.privateKey,
    { algorithm: 'RS256', issuer: account.clientEmail, expiresIn: 3600 }
  );
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`FCM OAuth token request failed: ${res.status}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

interface FcmSendResult {
  success: boolean;
  unregistered: boolean;
}

async function sendFcm(account: FcmServiceAccount, token: string, payload: NotificationPayload): Promise<FcmSendResult> {
  const accessToken = await getAccessToken(account);
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildFcmMessage(token, payload)),
    }
  );
  if (res.ok) return { success: true, unregistered: false };
  const body = await res.text();
  const unregistered = res.status === 404 || body.includes('UNREGISTERED');
  console.error(`[FCM] send failed (${res.status}): ${body.slice(0, 300)}`);
  return { success: false, unregistered };
}

/**
 * Send `payload` to the device tokens belonging to the given caretaker/account
 * within the family. Returns the number of successful sends.
 */
export async function sendToDeviceTokens(
  target: { familyId: string; caretakerId?: string | null; accountId?: string | null },
  payload: NotificationPayload
): Promise<number> {
  const account = loadFcmServiceAccount();
  if (!account) return 0;
  if (!target.caretakerId && !target.accountId) return 0;

  const ownerFilter: object[] = [];
  if (target.caretakerId) ownerFilter.push({ caretakerId: target.caretakerId });
  if (target.accountId) ownerFilter.push({ accountId: target.accountId });

  const tokens = await prisma.deviceToken.findMany({
    where: { familyId: target.familyId, OR: ownerFilter },
  });

  let sent = 0;
  for (const deviceToken of tokens) {
    try {
      const result = await sendFcm(account, deviceToken.token, payload);
      if (result.success) {
        sent += 1;
        await prisma.deviceToken.update({
          where: { id: deviceToken.id },
          data: { failureCount: 0, lastSuccessAt: new Date() },
        });
      } else if (result.unregistered) {
        await prisma.deviceToken.delete({ where: { id: deviceToken.id } });
      } else {
        await prisma.deviceToken.update({
          where: { id: deviceToken.id },
          data: { failureCount: { increment: 1 }, lastFailureAt: new Date() },
        });
      }
    } catch (error) {
      console.error('[FCM] unexpected send error:', error);
    }
  }
  return sent;
}
```

Note: verify the `NotificationPayload` import path against how `timerCheck.ts` imports it (same directory, `./push` or a types module) and adjust the import to match; if `payload.data`'s type isn't indexable, use the same type the payload literals carry.

- [ ] **Step 3: Document the env var**

In `documentation/Admin-Documentation/environment-variables.md`, notification section, add a row/entry:
```
| `FCM_SERVICE_ACCOUNT_JSON` | (unset) | Inline Firebase service-account JSON enabling native (FCM/APNs) push for the mobile app. Unset = native push disabled; web push is unaffected. |
```

- [ ] **Step 4: Run tests and commit**

Run: `npm test -- tests/fcm-push.test.ts` → PASS; `npm test` → full green; `npx tsc --noEmit` → clean.
```bash
git add src/lib/notifications/fcmPush.ts tests/fcm-push.test.ts documentation/Admin-Documentation/environment-variables.md
git commit -m "feat: FCM HTTP v1 send module with token lifecycle"
```

---

### Task 12: Wire FCM into send sites + deployment-config flag

**Repo:** sprout-track
**Files:**
- Modify: `src/lib/notifications/timerCheck.ts` (inside `sendTimerNotification`, after the `sendNotificationWithLogging` call at ~line 284), `src/lib/notifications/activityHook.ts` (after the `sendNotificationWithLogging(...).catch(...)` call at ~line 320), `app/api/deployment-config/route.ts`

**Interfaces:**
- Consumes: `sendToDeviceTokens`, `isFcmConfigured` (Task 11).
- Produces: native pushes fire for the same events, users, and localized payloads as web pushes. `GET /api/deployment-config` gains `nativePushEnabled: boolean`.

- [ ] **Step 1: Wire timerCheck**

In `src/lib/notifications/timerCheck.ts`, add the import:
```ts
import { sendToDeviceTokens } from './fcmPush';
```
Inside `sendTimerNotification`, immediately after the existing `await sendNotificationWithLogging(...)` call, add (the `payload` variable and `preference.subscription` are in scope; `baby.familyId` is selected by the existing query):
```ts
  if (baby.familyId) {
    sendToDeviceTokens(
      {
        familyId: baby.familyId,
        caretakerId: preference.subscription.caretakerId,
        accountId: preference.subscription.accountId,
      },
      payload
    ).catch((error) => console.error('[FCM] timer push failed:', error));
  }
```
If `preference.subscription` does not select `caretakerId`/`accountId` in the enclosing query, add those two fields to that query's `select`/`include` block — do not fetch the subscription again.

- [ ] **Step 2: Wire activityHook**

In `src/lib/notifications/activityHook.ts`, add the same import, and after the existing `sendNotificationWithLogging(...).catch(...)` statement add (`familyId` context: use the same variable the enclosing function scopes preferences by — the exploration shows the hook resolves the family through the activity's baby; reuse whatever `familyId`/`baby.familyId` variable is in scope):
```ts
      sendToDeviceTokens(
        {
          familyId,
          caretakerId: preference.subscription.caretakerId,
          accountId: preference.subscription.accountId,
        },
        payload
      ).catch((error) => console.error('[FCM] activity push failed:', error));
```
Same note about ensuring `caretakerId`/`accountId` are selected on the subscription.

- [ ] **Step 3: deployment-config flag**

In `app/api/deployment-config/route.ts`, add the import `import { isFcmConfigured } from '../../../src/lib/notifications/fcmPush';` (match the file's existing relative-import style) and add to the `config` object:
```ts
      nativePushEnabled: isFcmConfigured(),
```

- [ ] **Step 4: Verify and commit**

Run: `npm test` → green; `npx tsc --noEmit` → clean.
Manual check: `npm run dev`, `curl -s localhost:3000/api/deployment-config` → response includes `"nativePushEnabled": false` (env unset).
```bash
git add src/lib/notifications/timerCheck.ts src/lib/notifications/activityHook.ts app/api/deployment-config/route.ts
git commit -m "feat: send native pushes beside web push and expose nativePushEnabled"
```

---

### Task 13: Client-side native push registration

**Repo:** sprout-track
**Files:**
- Create: `src/utils/native-push.ts`
- Modify: `app/(app)/[slug]/client-layout.tsx` (one `useEffect` in the authenticated shell), `tests/native-app.test.ts` (extend with the gate test)

**Interfaces:**
- Consumes: `isNativeApp`, `getCapacitorPlugin`, `detectNativeApp` (Task 1); `POST /api/notifications/device-tokens` (Task 10); `GET /api/deployment-config` `nativePushEnabled` (Task 12).
- Produces:
  ```ts
  export function shouldAttemptNativePush(flags: { isNative: boolean; hasPlugin: boolean; nativePushEnabled: boolean }): boolean
  export async function registerNativePushToken(): Promise<void>  // full flow; safe no-op outside the shell
  ```

- [ ] **Step 1: Write the failing gate test**

Create `tests/native-push.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldAttemptNativePush } from '@/src/utils/native-push';

describe('shouldAttemptNativePush', () => {
  it('requires native, plugin, and server support', () => {
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: true, nativePushEnabled: true })).toBe(true);
    expect(shouldAttemptNativePush({ isNative: false, hasPlugin: true, nativePushEnabled: true })).toBe(false);
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: false, nativePushEnabled: true })).toBe(false);
    expect(shouldAttemptNativePush({ isNative: true, hasPlugin: true, nativePushEnabled: false })).toBe(false);
  });
});
```

Run: `npm test -- tests/native-push.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/utils/native-push.ts`:
```ts
'use client';

/**
 * Registers this device for native (FCM/APNs) push when running inside the
 * mobile shell. Safe no-op everywhere else. Permission is requested here —
 * i.e. after a successful login, never on first launch.
 */

import { detectNativeApp, getCapacitorPlugin, isNativeApp } from './native-app';

interface PushNotificationsPlugin {
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: 'registration', cb: (token: { value: string }) => void): Promise<unknown>;
}

export function shouldAttemptNativePush(flags: {
  isNative: boolean;
  hasPlugin: boolean;
  nativePushEnabled: boolean;
}): boolean {
  return flags.isNative && flags.hasPlugin && flags.nativePushEnabled;
}

let attempted = false;

export async function registerNativePushToken(): Promise<void> {
  if (attempted) return;
  const plugin = getCapacitorPlugin<PushNotificationsPlugin>('PushNotifications');

  let nativePushEnabled = false;
  try {
    const res = await fetch('/api/deployment-config');
    const json = (await res.json()) as { data?: { nativePushEnabled?: boolean } };
    nativePushEnabled = Boolean(json.data?.nativePushEnabled);
  } catch {
    return;
  }

  if (!shouldAttemptNativePush({ isNative: isNativeApp(), hasPlugin: plugin !== null, nativePushEnabled })) {
    return;
  }
  attempted = true;

  try {
    const permission = await plugin!.requestPermissions();
    if (permission.receive !== 'granted') return;

    await plugin!.addListener('registration', (token) => {
      const platform = detectNativeApp(navigator.userAgent).platform;
      void fetch('/api/notifications/device-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') ?? ''}`,
        },
        body: JSON.stringify({ token: token.value, platform }),
      });
    });
    await plugin!.register();
  } catch (error) {
    console.error('[NativePush] registration failed:', error);
  }
}
```

- [ ] **Step 3: Call it from the authenticated shell**

In `app/(app)/[slug]/client-layout.tsx`, add `import { registerNativePushToken } from '@/src/utils/native-push';` and, near the component's other mount effects in the authenticated branch, add:
```ts
  useEffect(() => {
    if (isNativeApp()) void registerNativePushToken();
  }, []);
```
(`isNativeApp` import exists from Task 8.)

- [ ] **Step 4: Verify and commit**

Run: `npm test` → all green; `npx tsc --noEmit` → clean.
```bash
git add src/utils/native-push.ts tests/native-push.test.ts "app/(app)/[slug]/client-layout.tsx"
git commit -m "feat: register native push tokens from the authenticated app"
```

---

### Task 14 (Repo: mobile-app-v1): Shell user-agent + push/keep-awake plugins

**Repo:** `/Users/johnoverton/Development/mobile-app-v1`
**Files:**
- Modify: `capacitor.config.ts`, `package.json` (installs)

- [ ] **Step 1: Append the platform user agents and install plugins**

In `capacitor.config.ts`, add to the config object:
```ts
  ios: {
    appendUserAgent: 'SproutTrackApp/0.1.0 (ios)',
  },
```
and extend the existing `android` block:
```ts
  android: {
    allowMixedContent: false,
    appendUserAgent: 'SproutTrackApp/0.1.0 (android)',
  },
```

```bash
cd /Users/johnoverton/Development/mobile-app-v1
npm i @capacitor-community/keep-awake @capacitor/push-notifications
npm run build && npx cap sync android
```
Expected: cap sync lists the two new plugins alongside the existing six.

- [ ] **Step 2: Verify and commit**

Run: `npm test` → 67 passing; `npm run build` → clean.
```bash
git add capacitor.config.ts package.json package-lock.json android
git commit -m "feat: shell user agent and keep-awake/push plugins"
```

---

### Task 15 (Repo: mobile-app-v1): Handle `?bridge-event=` on shell boot

**Repo:** `/Users/johnoverton/Development/mobile-app-v1`
**Files:**
- Create: `src/services/bridge-events.ts`, `src/services/bridge-events.test.ts`
- Modify: `src/App.tsx` (launch effect)

**Interfaces:**
- Consumes: `decodeMessage` from `shared/bridge-contract.ts`; the launch flow in `App.tsx` (`openDefault`, auto-open logic).
- Produces:
  ```ts
  export type BootAction = 'auto-open' | 'show-server-list'
  export function bootActionFromSearch(search: string): BootAction
  // '?bridge-event=' with loggedOut reason 'switch-family' → 'show-server-list'
  // any other decodable loggedOut/sessionExpired → 'auto-open' (default fast-path silently re-logs-in)
  // absent/malformed → 'auto-open'
  export function stripBridgeEvent(): void  // history.replaceState removing the param
  ```

- [ ] **Step 1: Write the failing tests**

`src/services/bridge-events.test.ts`:
```ts
import { expect, test } from 'vitest'
import { bootActionFromSearch } from './bridge-events'
import { encodeMessage } from '../../shared/bridge-contract'

const search = (msg: Parameters<typeof encodeMessage>[0]) =>
  `?bridge-event=${encodeURIComponent(encodeMessage(msg))}`

test('switch-family shows the server list', () => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason: 'switch-family' }))).toBe('show-server-list')
})

test('a 401 logout falls through to auto-open (silent re-login)', () => {
  expect(bootActionFromSearch(search({ type: 'loggedOut', reason: 'logout-401' }))).toBe('auto-open')
})

test('absent or malformed params auto-open', () => {
  expect(bootActionFromSearch('')).toBe('auto-open')
  expect(bootActionFromSearch('?bridge-event=%7Bnot-json')).toBe('auto-open')
})
```

Run: `npm test bridge-events` → FAIL.

- [ ] **Step 2: Implement**

`src/services/bridge-events.ts`:
```ts
import { decodeMessage } from '../../shared/bridge-contract'

export type BootAction = 'auto-open' | 'show-server-list'

/** Interpret a ?bridge-event= param the web app used to hand control back to the shell. */
export function bootActionFromSearch(search: string): BootAction {
  const raw = new URLSearchParams(search).get('bridge-event')
  if (!raw) return 'auto-open'
  const decoded = decodeMessage(raw)
  if (decoded?.msg.type === 'loggedOut' && decoded.msg.reason === 'switch-family') {
    return 'show-server-list'
  }
  return 'auto-open'
}

export function stripBridgeEvent(): void {
  const url = new URL(window.location.href)
  if (url.searchParams.has('bridge-event')) {
    url.searchParams.delete('bridge-event')
    window.history.replaceState(null, '', url.toString())
  }
}
```

In `src/App.tsx`, in the launch effect, before the auto-open branch: import `{ bootActionFromSearch, stripBridgeEvent }` and compute
```ts
    const bootAction = bootActionFromSearch(window.location.search)
    stripBridgeEvent()
```
then gate the fast path: only call the auto-open path when `bootAction === 'auto-open'`; when `'show-server-list'`, `setScreen({ name: 'server-list' })` directly (keeping the existing welcome-guard semantics for the empty-registry case).

- [ ] **Step 3: Verify and commit**

Run: `npm test` → all green (existing App tests unaffected: no param present in jsdom by default); `npm run build` → clean.
```bash
git add src/services/bridge-events.ts src/services/bridge-events.test.ts src/App.tsx
git commit -m "feat: honor bridge-event handoff from the web app"
```

---

### Task 16 (Repo: mobile-app-v1): Sync docs

**Repo:** `/Users/johnoverton/Development/mobile-app-v1`
**Files:**
- Modify: `README.md` ("Known v0 limitations" section)

- [ ] **Step 1: Update the limitations list**

Replace the session-handoff limitation bullet (silent injection now ships once the sprout-track branch deploys) with:
```markdown
- Silent session handoff requires a Sprout Track server running the native-aware
  layer (sprout-track branch `feature/native-aware-layer`); older servers fall
  back to showing the web login screen once.
- Native push requires the server to set `FCM_SERVICE_ACCOUNT_JSON`; the app
  skips the permission prompt when `/api/deployment-config` reports
  `nativePushEnabled: false`.
```
Keep the bridge-spike and biometric-gate bullets as they are.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: note server version requirements for handoff and push"
```

---

## Out of Scope (deferred)

- Notification-tap deep-link routing into a specific family/screen.
- Per-device notification preferences for native tokens (web-push `NotificationPreference` stays subscription-scoped).
- `NotificationLog` rows for FCM sends (DeviceToken's own failure/success fields cover v1).
- FCM config via the encrypted DB `NotificationConfig` + admin UI (env-only for v1).
- On-device bridge spike validation (Capacitor bridge injection on `allowNavigation` hosts) — still the gate before store submission.
- `capturePhoto` bridge message (native webview file inputs already open the OS camera; revisit only if UX demands the Camera plugin).
- `sessionInjected` / `appResumed` native→web messages: there is no shell→remote-page channel without a custom native plugin, and neither is needed for v1 (silent re-login happens shell-side before navigation; the web app's own visibility handlers cover resume). The contract keeps them for a future native-plugin phase.
