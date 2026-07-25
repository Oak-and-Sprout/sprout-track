# Native App Integration (Capacitor Mobile Shell)

## Overview

Sprout Track ships a companion iOS/Android app built as a **Capacitor shell** (a
separate repository, `mobile-app-v1`). The shell is deliberately thin: it handles
pairing with a server, saved families, credential storage, and biometric unlock,
then loads **this** web app into the same WebView. There is no second UI — after
handoff, every screen the user sees is the Next.js app documented in the rest of
this folder.

That design ("one WebView, two owners") means the web app has to know when it is
running inside the shell and behave slightly differently. This document describes
that native-aware layer: how detection works, how the two sides hand control back
and forth, which capabilities are swapped for native equivalents, what changes for
app-store payment compliance, and the native push channel that sits beside web push.

**The invariant that governs all of it:** every native-aware branch is gated on
detection of the shell's user agent and **no-ops in a normal browser**. Web users
see no behavior change. Anything that cannot honor that invariant does not belong
in this layer.

## Detection — the single gate

**File:** `src/utils/native-app.ts`

The shell appends a suffix to its WebView user agent:

```
SproutTrackApp/<version> (ios|android)
```

Everything downstream keys off that string. The module is deliberately made of
pure functions so it is unit-testable without a browser:

| Function | Purpose |
|----------|---------|
| `detectNativeApp(userAgent)` | Pure parse → `{ isNative, platform }` |
| `isNativeApp()` | Browser entry point — reads `navigator.userAgent` |
| `getCapacitorPlugin<T>(name)` | Reads `window.Capacitor.Plugins[name]`, `null` if the bridge isn't injected |
| `shellOrigin(platform)` | `capacitor://localhost` (iOS) / `https://localhost` (Android) |
| `chooseWakeLockMechanism(flags)` | `'plugin' \| 'browser' \| 'none'` |
| `shouldRegisterServiceWorker(flags)` | `false` inside the shell |

### Two things to be careful about

- **`isNativeApp()` is not SSR-safe by value.** It depends on `navigator`, so a
  component that renders differently in the shell must read it in an effect and
  store it in state (`const [inShell, setInShell] = useState(false)` +
  `useEffect(() => setInShell(isNativeApp()), [])`), not inline during render.
  Reading it inline produces a hydration mismatch. `SideNav` and
  `AccountSettingsTab` both follow the effect pattern.
- **Plugin presence is independent of native-ness.** The Capacitor bridge is only
  injected on hosts the shell allow-lists, so `isNativeApp() === true` with
  `getCapacitorPlugin(...) === null` is a real state. Every plugin path needs a
  non-plugin fallback (see `openExternal`).

## The bridge contract

**File:** `src/utils/bridge-contract.ts` — **vendored, do not edit here.**

The message format shared by both repos lives in
`mobile-app-v1/shared/bridge-contract.ts` and is copied verbatim into this repo
under a two-line vendor header. `tests/bridge-contract.test.ts` includes a
byte-for-byte drift guard against the source file (skipped when the mobile repo
isn't checked out alongside). **Changing the contract means changing both copies
in the same commit set.**

Messages are versioned and validated on decode; a message from a *newer* contract
version is rejected rather than partially interpreted.

```ts
export const BRIDGE_CONTRACT_VERSION = 1

type WebToNativeMessage =
  | { type: 'keepAwake'; on: boolean }
  | { type: 'capturePhoto' }
  | { type: 'sessionExpired' }
  | { type: 'loggedOut'; reason: string }
  | { type: 'registerPushToken'; jwt: string }

type NativeToWebMessage =
  | { type: 'sessionInjected'; slug: string; token: string; caretakerId?: string }
  | { type: 'appResumed' }
```

`encodeMessage` produces `{"v":1,"msg":{...}}`; `decodeMessage` returns `null` for
anything malformed, unknown, or too new. Not every message in the contract is used
by this repo — the contract is the union of both sides' vocabulary.

## Control handoff between shell and web app

Both directions are **URL-based**. No native plugin is required, which is what
keeps the whole layer functional even when the Capacitor bridge isn't injected.

### Web → shell: `?bridge-event=`

**File:** `src/utils/native-bridge.ts`

```
{shellOrigin}/?bridge-event=<uriEncoded(encodeMessage(msg))>
```

`navigateToShell(msg)` builds that URL and assigns `window.location.href`.
**It returns `false` and does nothing in a normal browser**, which makes it safe
to use as a guard clause in shared code paths:

```ts
if (navigateToShell({ type: 'loggedOut', reason })) return;
router.push(logoutDestination({ isAccountAuth, familySlug, reason }));
```

The shell reads and immediately strips the parameter on boot. Current senders:

| Trigger | Message | Why |
|---------|---------|-----|
| User logout, idle timeout, failed token refresh | `loggedOut` + reason | The shell owns the logged-out state; the web login must never appear inside the app |
| "Switch Family" / "Exit to My Families" side-nav action | `loggedOut`, reason `switch-family` | Returns the user to the shell's saved-families list |
| Family page loads locked | `sessionExpired` | Asks the shell to re-establish a session (see below) |

### Shell → web: `#bridge-session=`

**File:** `src/utils/native-session.ts`

The shell authenticates against the server itself (it holds the saved credentials
and the biometric gate), then navigates to the family's page with the resulting
session in a **fragment**:

```
{base}/{slug}/log-entry#bridge-session=<uriEncoded(encodeMessage(sessionInjected))>
```

A fragment rather than a query string matters here: fragments are not transmitted
in the request line, so the token never reaches the server's access logs.

`consumeInjectedSession()` runs during the `isUnlocked` state initializer in
`app/(app)/[slug]/client-layout.tsx` — before anything reads `unlockTime` — and:

1. Bails out unless the fragment is present **and** `isNativeApp()`.
2. Decodes and validates the message, and requires `msg.slug` to equal the first
   path segment of the current URL. A session minted for one family cannot be
   replayed onto another.
3. Writes `authToken`, `unlockTime`, and (when present) `caretakerId` to
   `localStorage` — the same keys the web login screens write, so the rest of the
   app is unaware a handoff happened.
4. **Always strips the fragment** via `history.replaceState` — valid or not — so
   the token does not linger in the URL or in back/forward history.
5. Fires `seedTimeoutSettings()`, which populates `authLifeSeconds` /
   `idleTimeSeconds` from `GET /api/settings/auth-life` and
   `GET /api/settings/idle-time`, mirroring what `PinLogin` / `AccountLogin` do.
   Failure is non-fatal; session-timeout falls back to its defaults.

`consumeInjectedSessionFrom(env)` is the pure, injectable core (hash, pathname,
storage, `replaceUrl`, `now`) and is what the tests exercise.

### Locked-page policy: never show the web login in the shell

**File:** `src/utils/native-relock.ts`

If a family page loads and the session is *not* unlocked, a browser shows the web
login screen. Inside the shell that is wrong — the shell owns authentication, and
its login UI is the one the user paired with. `decideNativeRelock` picks between
three outcomes:

| Decision | When |
|----------|------|
| `app` | Session is unlocked — render normally |
| `show-login` | Not in the shell, **or** the loop guard tripped |
| `return-to-shell` | In the shell, locked, no recent bounce for this family |

`return-to-shell` writes a `nativeReauthAttempt` marker
(`{ slug, at }` in `localStorage`) and calls
`navigateToShell({ type: 'sessionExpired' })`. While the WebView navigates away,
the layout renders a **plain teal backdrop with no children** — the login markup
is never mounted, not even for a frame.

The marker exists to break a redirect loop: if we already bounced for this family
within `REAUTH_LOOP_WINDOW_MS` (15 s) and are *still* locked, the reconnect isn't
sticking, so we degrade to `show-login` rather than ping-pong forever. The marker
is cleared as soon as the session is unlocked. If `localStorage` is unavailable the
guard degrades to always bouncing, which is the safe direction.

The decision is computed **once, at mount** (`useState` initializer) so that later
re-renders can't retrigger navigation.

## Capability overrides

Each of these swaps a browser API for the platform equivalent when — and only
when — the shell provides it.

### Wake lock → KeepAwake plugin

**File:** `src/hooks/useWakeLock.ts`

Nursery mode keeps a wall-mounted tablet awake all day. The W3C Wake Lock API
isn't reliably available in a Capacitor WebView, so the hook resolves its
mechanism through `chooseWakeLockMechanism`: the `KeepAwake` Capacitor plugin
wins if present, then `navigator.wakeLock`, then nothing. `isSupported` reflects
the resolved mechanism rather than the browser API alone, and `request()` /
`release()` branch on it. The plugin path has no sentinel and therefore no
`release` event — `isActive` is set directly.

### Camera → OS capture

**Files:** `src/hooks/useCameraStrategy.ts`, `src/utils/photoUtils.ts`

`decideCameraStrategy` returns `'native-capture'` unconditionally in the shell
(first check, ahead of the pointer/`mediaDevices` heuristics). A WebView file
input with `capture` hands off to the OS camera, which is both better UX and more
reliable than `getUserMedia` inside a WebView.

### Service worker → suppressed

**File:** `src/lib/notifications/client.ts`

`registerPwaServiceWorker()` is gated on `shouldRegisterServiceWorker({ isNative,
hasServiceWorker, isSecureContext })`. Inside the shell the service worker is
pointless (there is nothing to install, and native push does not route through
it) and its scope fights the shell's origin. The "requires HTTPS" console warning
is only emitted when HTTPS is genuinely the blocker, not when native-ness is.

## App-store payment compliance

Apple and Google prohibit surfacing non-store payment flows inside a native app.
Presentation rules are isolated as pure functions so the policy is testable and
lives in one place.

**File:** `src/utils/shell-chrome.ts`

| Function | Web | In shell |
|----------|-----|----------|
| `sideNavFooterButtons(isNative)` | `switch-family`, `settings`, `logout` | `settings`, `exit-to-families` |
| `trialCtaMode(isNative)` | `payment-modal` | `external` |
| `shellSubscriptionControls(isNative, kind, hasFamily)` | payment actions + history visible | actions and history hidden; external manage link + explanatory note when the plan is manageable (`trial`/`active`/`expired` **and** the account has a family) |

Consumers:

- **`src/components/ui/side-nav/index.tsx`** renders its footer from
  `sideNavFooterButtons`. In the shell, "Logout" is replaced by
  **"Exit to My Families"** (wired to `onSwitchFamily`, falling back to
  `onLogout`), because from the user's point of view they are leaving the family,
  not the app. `switch-family` renders only when the `onSwitchFamily` prop is
  supplied — `client-layout.tsx` supplies it only in the shell. The trial CTA
  becomes an external link, and `PaymentModal` is **not mounted at all** rather
  than merely hidden.
- **`src/components/account-manager/AccountSettingsTab.tsx`** hides every
  payment button, does not mount `PaymentModal` or `PaymentHistory`, and shows
  "Subscriptions are managed on the web, not in this app." plus a link out.

**File:** `src/utils/external-link.ts`

`openExternal(url)` prefers the Capacitor `Browser` plugin (system browser) and
falls back to `window.open(url, '_blank', 'noopener')`, which the shell's WebView
also hands to the OS. `MANAGE_SUBSCRIPTION_URL` (`https://sprout-track.com/account`)
is the single canonical destination.

## Native push channel (FCM)

Native push runs **beside** VAPID web push rather than replacing it — see
[PWA and Notifications](./PWAAndNotifications.md) for the web-push architecture
this mirrors. It is entirely opt-in per deployment.

### `DeviceToken` model

Patterned on `PushSubscription`, SQLite- and Postgres-compatible.
Migration: `20260720201548_add_device_token`.

```
DeviceToken {
  id            cuid
  token         String  @unique   // FCM registration token
  platform      String            // 'ios' | 'android'
  accountId     String?           // owner (account auth)
  caretakerId   String?           // owner (PIN auth)
  familyId      String            // always set — scoping key
  failureCount  Int     @default(0)
  lastFailureAt DateTime?
  lastSuccessAt DateTime?
}
```

Back-relations on `Account`, `Caretaker`, and `Family`; indexed on all three
foreign keys. `platform` is a validated string rather than an enum, per the
dual-database constraint.

### Registration API

**Files:** `app/api/notifications/device-tokens/route.ts`, `validation.ts`

| Method | Behavior |
|--------|----------|
| `POST` | Upserts by `token`, stamping `familyId`/`accountId`/`caretakerId` from `authContext`. Returns `{ id }`. A token that moved to a different family or caretaker is re-owned rather than duplicated. |
| `DELETE` | `?token=` — loads the record and deletes it only when `record.familyId === authContext.familyId`; otherwise 404. |

Both use `withAuthContext`. Ownership comes **only** from the auth context — the
client cannot name a family, caretaker, or account (the golden rule). No family on
the auth context is a `403`. `parseDeviceTokenBody` is a pure validator: token must
be a non-empty string ≤ 4096 chars after trimming, platform must be exactly `ios`
or `android`.

### Send module

**File:** `src/lib/notifications/fcmPush.ts`

FCM **HTTP v1**, called directly with `fetch`. There is no `firebase-admin`
dependency: a service-account JWT is signed with `jsonwebtoken` (RS256) and
exchanged for an OAuth access token, which is cached in-process until one minute
before expiry.

- `loadFcmServiceAccount(env)` parses `FCM_SERVICE_ACCOUNT_JSON` and returns
  `null` on anything malformed. `isFcmConfigured()` is the boolean form.
- `buildFcmMessage(token, payload)` reuses the web-push `NotificationPayload`
  shape, stringifies all `data` values (FCM requires string values), and maps
  `payload.tag` to `android.collapse_key` + `apns-collapse-id` so repeat timer
  notifications collapse on the device instead of stacking.
- `sendToDeviceTokens({ familyId, caretakerId, accountId }, payload)` queries
  tokens matching the family **and** one of the owners, sends to each, and
  maintains the token lifecycle: success resets `failureCount` and stamps
  `lastSuccessAt`; a `404` whose body contains `UNREGISTERED` **deletes** the
  token; any other failure increments `failureCount` and stamps `lastFailureAt`.
  Returns the number of successful sends. **An unconfigured deployment returns
  `0` immediately** — no network calls, no errors.

Only a genuine `UNREGISTERED` response deletes a token; transient 5xx/network
failures never do.

### Send sites

Native sends are **fire-and-forget** (`.catch(console.error)`) alongside the
existing `sendNotificationWithLogging` call at each site, so a failing FCM
configuration can never delay or break web push:

| Site | File |
|------|------|
| Activity created | `src/lib/notifications/activityHook.ts` |
| Feed / diaper timer expiration | `src/lib/notifications/timerCheck.ts` (`sendTimerNotification`) |
| Medicine timer expiration | `src/lib/notifications/timerCheck.ts` (`checkTimerExpirations`) |

Targeting piggybacks on the existing per-preference loop: the caretaker/account
on the matched `PushSubscription` becomes the device-token owner, so **native push
inherits the `NotificationPreference` system unchanged** — no separate preference
surface, and payloads are already localized per subscriber by
`src/lib/notifications/i18n.ts`.

Note that `NotificationLog` records the **web-push** attempt. Native sends are not
individually logged; their health is observable through `DeviceToken.failureCount`
/ `lastFailureAt` / `lastSuccessAt` and `[FCM]`-prefixed server logs.

### Client registration

**File:** `src/utils/native-push.ts`

`registerNativePushToken()` is called from `client-layout.tsx` only when
`mounted && isUnlocked && isNativeApp()` — **after login, never at first launch**,
so the OS permission prompt arrives with context. It is idempotent per page
session via a module-level `attempted` flag.

Flow: fetch `GET /api/deployment-config` → require
`shouldAttemptNativePush({ isNative, hasPlugin, nativePushEnabled })` → request
permissions → subscribe to the plugin's `registration` event → `POST` the token
and platform to `/api/notifications/device-tokens` with the current
`authToken`. Any failure is logged and swallowed.

### Deployment flag

`GET /api/deployment-config` (unauthenticated) exposes
`nativePushEnabled: isFcmConfigured()` beside the existing flags. This is what
lets the client skip the permission prompt entirely on deployments that cannot
deliver native push.

## Operations

| Variable | Effect |
|----------|--------|
| `FCM_SERVICE_ACCOUNT_JSON` | Inline Firebase service-account JSON. Unset ⇒ native push disabled and `nativePushEnabled: false`; web push is unaffected either way. Documented in [environment-variables.md](../Admin-Documentation/environment-variables.md). |

Self-hosters who do not run the mobile app need to do nothing: the entire layer is
inert without the shell's user agent, and the push channel is inert without the
service account.

Keep the shell's `appendUserAgent` version in `capacitor.config.ts` in sync with
the app version — the detection regex accepts any version, but the UA string is
the only signal the server has about which shell build it is talking to.

## Testing conventions

Native logic is written as pure functions in `src/utils/` precisely so it can be
tested in the repo's node-environment Vitest setup with no DOM and no database.
Browser entry points (`isNativeApp`, `navigateToShell`, `consumeInjectedSession`)
are thin wrappers that bind `window`/`navigator` and delegate.

| Test file | Covers |
|-----------|--------|
| `tests/native-app.test.ts` | UA parsing, plugin access, shell origins, capability gates |
| `tests/bridge-contract.test.ts` | Encode/decode, validation, version rejection, **cross-repo drift guard** |
| `tests/native-bridge.test.ts` | Return-URL construction, browser no-op |
| `tests/native-session.test.ts` | Injection, slug mismatch, fragment stripping |
| `tests/native-relock.test.ts` | Three-way decision and the loop guard |
| `tests/shell-chrome.test.ts` | Footer/CTA/subscription presentation rules |
| `tests/external-link.test.ts` | Plugin vs `window.open` fallback |
| `tests/native-push.test.ts` | Registration gate |
| `tests/device-token-validation.test.ts` | Body validator edge cases |
| `tests/fcm-push.test.ts` | Service-account parsing, message shape, collapse keys |

## Known limitations

- **Duplicate activity pushes.** Targeting iterates web-push subscriptions, so a
  user with several browser subscriptions in one family receives one FCM push per
  subscription for activity events. Timer events collapse on-device via the stable
  `payload.tag`; activity events do not.
- **No deep-link routing on tap.** A tapped native notification opens the app; it
  does not navigate to the relevant baby or activity.
- **Native sends are not in `NotificationLog`.** See above.
- **Biometric gating is shell-side JS**, not OS-`accessControl`-backed Keychain.
  Nothing in this repo depends on that, but it bounds the security claim of the
  handoff.
- **`keepAwake`, `capturePhoto`, `registerPushToken`, and `appResumed`** exist in
  the contract but have no sender or receiver in this repo — capabilities are
  resolved through Capacitor plugins directly instead. They are kept because the
  contract is shared and versioned.

## Key Files

- `src/utils/native-app.ts` — detection, plugin access, capability gates
- `src/utils/bridge-contract.ts` — vendored message contract (**do not edit**)
- `src/utils/native-bridge.ts` — web → shell navigation
- `src/utils/native-session.ts` — shell → web session injection
- `src/utils/native-relock.ts` — locked-page decision + loop guard
- `src/utils/native-push.ts` — client-side FCM token registration
- `src/utils/shell-chrome.ts` — in-shell presentation rules (IAP compliance)
- `src/utils/external-link.ts` — external-browser opener
- `src/lib/notifications/fcmPush.ts` — FCM HTTP v1 send + token lifecycle
- `app/api/notifications/device-tokens/{route,validation}.ts` — token registration API
- `app/(app)/[slug]/client-layout.tsx` — where handoff, relock, and push registration are wired
- `src/hooks/useWakeLock.ts`, `src/hooks/useCameraStrategy.ts`, `src/utils/photoUtils.ts` — capability overrides
- `src/lib/notifications/client.ts` — service-worker suppression
- `src/components/ui/side-nav/index.tsx`, `src/components/account-manager/AccountSettingsTab.tsx` — shell chrome consumers
- `prisma/schema.prisma` — `DeviceToken` model
- `docs/superpowers/plans/2026-07-20-native-aware-layer-and-push.md` — original implementation plan
