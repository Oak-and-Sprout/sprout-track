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
app-store payment compliance, the native push channel that sits beside web push,
and the Universal/App Links the shell claims from the OS.

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

### Wake lock and immersive mode — driven natively, not by this repo

**Files (mobile-app-v1, not this repo):**
`ios/App/App/NurseryAwareViewController.swift`,
`android/app/src/main/java/com/sprouttrack/app/NurseryAwareWebViewClient.java`

Nursery mode keeps a wall-mounted tablet awake and full-screen all day. Earlier
in this project's history the shell used the Capacitor `KeepAwake` plugin, driven
from web-app JS via `navigator.wakeLock`-style calls. That doesn't work for this
app: the shell's JS (and with it, any plugin bridge call) stops running once the
WebView is handed to this remote server, so nothing on this side of the wire can
invoke a plugin to hold or release a wake lock. `KeepAwake` has been **removed**
as a shell dependency.

Instead, the shell observes the WebView's own URL natively and toggles the OS
idle timer and status bar directly, with no cooperation required from this repo:

- **iOS**: `NurseryAwareViewController` (a `CAPBridgeViewController` subclass,
  wired in via the storyboard's `customModule`) uses Key-Value Observing on
  `webView.url`, which fires on `history.pushState` navigation and not just hard
  page loads — so entering/leaving `/nursery-mode` via Next.js client-side
  routing is caught. It toggles `UIApplication.shared.isIdleTimerDisabled` and
  the status bar visibility, paired and idempotent (re-entering nursery mode
  without leaving is a no-op), and resets the idle timer in `deinit` so it can
  never be left disabled past the controller's lifetime.
- **Android**: `NurseryAwareWebViewClient` overrides `doUpdateVisitedHistory` (not
  `onPageStarted`, for the same client-side-navigation reason) and applies the
  equivalent window-flag / immersive-mode toggle.

Both sides match on the same rule: the URL's second path segment must equal
`nursery-mode` exactly, not merely start with it (`/{slug}/nursery-mode`). This
repo's job is only to keep that route stable — it has no wake-lock code of its
own to maintain.

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

## Native push channel

Native push runs **beside** VAPID web push rather than replacing it — see
[PWA and Notifications](./PWAAndNotifications.md) for the web-push architecture
this mirrors. It is entirely opt-in per deployment, and **SaaS-only**: it exists
to support the App Store / Play Store builds, which is a SaaS-hosted product.
Self-hosted deployments leave the relevant env vars unset and are completely
unaffected — no code path here behaves differently for them.

There are **two independent transports**, not one: FCM for Android, and direct
APNs (HTTP/2) for iOS. There is no Firebase iOS SDK anywhere in this stack —
Apple devices never touch Firebase. A `nativePush.ts` dispatcher owns token
selection, per-platform routing, and the token lifecycle; the transport modules
only send one message to one token and report an outcome.

### `DeviceToken` model

Patterned on `PushSubscription`, SQLite- and Postgres-compatible.
Migration: `20260720201548_add_device_token`.

```
DeviceToken {
  id            cuid
  token         String            // FCM registration token or APNs device token
  platform      String            // 'ios' | 'android'
  accountId     String?           // owner (account auth)
  caretakerId   String?           // owner (PIN auth)
  familyId      String            // always set — scoping key
  failureCount  Int     @default(0)
  lastFailureAt DateTime?
  lastSuccessAt DateTime?

  @@unique([token, familyId])
}
```

Back-relations on `Account`, `Caretaker`, and `Family`; indexed on all three
foreign keys. `platform` is a validated string rather than an enum, per the
dual-database constraint.

The unique key is the **composite** `(token, familyId)`, not `token` alone. The
same physical device token can legitimately register itself into more than one
family (a caretaker who belongs to two families installs one app), so `token`
alone can't be unique — but a token is still unique *within* a family, which is
what the registration upsert relies on. This has one consequence worth knowing:
when a token comes back `UNREGISTERED`/`Unregistered` from the transport, the
dispatcher deletes it **by token, across all families it appears in** (see
`onUnregistered` in `nativePush.ts`) — a dead device token is dead everywhere,
not just in the family that happened to trigger the send.

### Registration API

**Files:** `app/api/notifications/device-tokens/route.ts`, `validation.ts`

| Method | Behavior |
|--------|----------|
| `POST` | Upserts on the composite `(token, familyId)` key, stamping `accountId`/`caretakerId` from `authContext`. Returns `{ id }`. A token that moved to a different caretaker within the same family is re-owned rather than duplicated; a token registering into a *new* family gets its own row. Requires `withAuthContext`; no family on the auth context is a `403`. |
| `DELETE` | `?token=` — deletes **every row with that exact token**, across all families, with no auth check. See below for why. |

Both routes **404 when neither transport is configured** (`isFcmConfigured() ||
isApnsConfigured()` is false) — on a self-hosted deployment they don't exist as
far as a client can tell, the same posture as any other SaaS-only surface.

`POST` uses `withAuthContext`; ownership comes **only** from the auth context —
the client cannot name a family, caretaker, or account (the golden rule).
`parseDeviceTokenBody` is a pure validator: token must be a non-empty string
≤ 4096 chars after trimming, platform must be exactly `ios` or `android`.

**`DELETE` is unauthenticated by design.** This is a deliberate exception to the
usual auth posture, not an oversight, and it is documented at the call site
(`route.ts`, spec §D7):

- The device token itself is high-entropy and known only to the device that
  registered it — presenting it back is self-authenticating for this one
  narrow operation (delete-this-token), the same trust model as a bearer
  capability URL.
- The shell calls this specifically during **family removal**, a moment where it
  has no JWT (the credential was already cleared, or was never re-acquired for
  a background cleanup action) and acquiring one would mean firing a biometric
  prompt just to unregister a push token — clearly disproportionate.
- It is bounded tightly: the only thing this endpoint can do is delete rows
  matching an exact, unguessable token. It grants no read access, no write
  access to family data, and no enumeration oracle (`deleteMany` and the fixed
  `{success: true}` response never reveal whether a row existed). Reviewer
  verified this bounding during Task 3 of this pass.

### Send modules

**Files:** `src/lib/notifications/nativePush.ts` (dispatcher),
`src/lib/notifications/fcmPush.ts` (Android transport),
`src/lib/notifications/apnsPush.ts` (iOS transport)

`sendToDeviceTokens({ familyId, caretakerId, accountId }, payload)` in
`nativePush.ts` queries `DeviceToken` rows matching the family **and** one of the
owners, then for each row:

1. **Skips entirely** if that row's platform isn't configured
   (`isApnsConfigured()` for `ios`, `isFcmConfigured()` for `android`) — no
   transport call, no lifecycle write of any kind. This is the important
   asymmetry to hold onto: an unconfigured platform is not a failure, it's a
   no-op. Routing it through the failure path would be indistinguishable from a
   real transient error and would accrue `failureCount` on every send attempt
   forever, purely because that platform was never set up.
2. Otherwise sends via the matching transport and applies the outcome: success
   resets `failureCount` and stamps `lastSuccessAt`; an unregistered response
   deletes the token (by token, across families — see above); any other
   failure increments `failureCount` and stamps `lastFailureAt`.

`fcmPush.ts` is a **pure transport**: FCM HTTP v1, called directly with `fetch`.
There is no `firebase-admin` dependency — a service-account JWT is signed with
`jsonwebtoken` (RS256) and exchanged for an OAuth access token, cached
in-process until one minute before expiry. It does not touch the database or own
any lifecycle decision; that all moved to `nativePush.ts`.

- `loadFcmServiceAccount(env)` parses `FCM_SERVICE_ACCOUNT_JSON` and returns
  `null` on anything malformed. `isFcmConfigured()` is the boolean form.
- `buildFcmMessage(token, payload)` reuses the web-push `NotificationPayload`
  shape, stringifies all `data` values (FCM requires string values), and maps
  `payload.tag` to `android.collapse_key` so repeat timer notifications collapse
  on the device instead of stacking.
- `sendOne(token, payload)` returns `{ success, unregistered }`; `unregistered`
  is only ever `true` for a `404` whose body contains `UNREGISTERED`. Transient
  5xx/network failures never set it.

`apnsPush.ts` is the iOS equivalent: APNs over HTTP/2 (`node:http2`), configured
via `APNS_AUTH_KEY` / `APNS_KEY_ID` / `APNS_TEAM_ID` / `APNS_BUNDLE_ID` /
`APNS_PRODUCTION`. A provider JWT is signed (ES256) and cached for 45 minutes —
Apple rejects provider tokens refreshed more than once per 20 minutes, so this
cache is load-bearing, not an optimization. `unregistered` is only set for a
`410` whose body contains `Unregistered`; a `400 BadDeviceToken` is treated as an
ordinary failure, **not** a dead token, because it is far more often a
sandbox/production host mismatch than a genuinely gone device (see
[environment-variables.md](../Admin-Documentation/environment-variables.md) for
that trap).

### Send sites

Native sends are **fire-and-forget** (`.catch(console.error)`) alongside the
existing `sendNotificationWithLogging` call at each site, so a failing native
push configuration can never delay or break web push:

| Site | File |
|------|------|
| Activity created | `src/lib/notifications/activityHook.ts` |
| Feed / diaper timer expiration | `src/lib/notifications/timerCheck.ts` (`sendTimerNotification`) |
| Medicine timer expiration | `src/lib/notifications/timerCheck.ts` (`checkTimerExpirations`) |

Targeting still walks the existing per-preference loop, but the owner is resolved
through `resolvePreferenceOwner` (`src/lib/notifications/preferenceOwner.ts`)
rather than read straight off the subscription — see
[Preferences without a subscription](#preferences-without-a-subscription) below
for why. Payloads are already localized per subscriber by
`src/lib/notifications/i18n.ts`.

`sendToDeviceTokens` queries `DeviceToken` by `(familyId, owner)`, not by anything
tied to the preference row, so a user holding **both** a web preference and a
native one would otherwise receive the same payload twice on the same device.
Each send site therefore keeps a `Set` of `nativeOwnerKey(owner)` values for the
notification it is currently sending and calls `sendToDeviceTokens` **once per
distinct owner**, after the web-push loop.

### Preferences without a subscription

`NotificationPreference.subscriptionId` used to be a required FK to
`PushSubscription`, and a `PushSubscription` can only be created by
`POST /api/notifications/subscribe` with a real web-push endpoint — which is
impossible in a `WKWebView` or the Android System WebView. That is the same
platform limitation that makes native push necessary in the first place.

The consequence was that a user who **only** used the mobile app registered a
`DeviceToken`, granted permission, and then received nothing at all, forever:
no `NotificationPreference` row, and no way to create one.

So the preference is no longer bound to a subscription:

- `subscriptionId` is optional, and `caretakerId` / `accountId` / `familyId` live
  directly on `NotificationPreference`. `familyId` is **nullable** — deliberately,
  because Postgres deploys apply schema with `prisma db push`, which cannot add a
  required column with no default to a table that already has rows.
- `resolvePreferenceOwner` treats the **subscription as authoritative when
  present**, falling back to the preference's own columns only when there is none.
  A subscription's owner legitimately changes over time (`subscribe` re-owns an
  existing endpoint from the current session — a shared tablet, a PIN switch), so
  preferring the row's stamped columns would have silently changed web-push
  language, self-exclusion, and targeting. Web behavior is byte-identical.
- `GET /api/notifications/preferences` matches two shapes: rows with a stamped
  `familyId`, and legacy rows where `familyId` is null and ownership is resolved
  **through the subscription**. Without that second branch, every pre-existing row
  on a Postgres upgrade would be invisible to its owner while still firing pushes.
- `buildPreferencesWhere` short-circuits to `id: { in: [] }` when the session has
  neither a caretaker nor an account id. This is not decoration: Prisma silently
  **drops a nested empty `OR`**, so `{ OR: [{ familyId, OR: [] }] }` compiles to a
  bare `familyId = ?` and would return every owner's preferences in the family. A
  top-level `OR: []` fails closed; a nested one does not. Test it by reading
  generated SQL, never by inspecting the query object.

`NotificationSettings.tsx` gains a shell-gated path that creates a
subscription-less preference. As everywhere in this layer, `isNativeApp()` is read
in a `useEffect` into state and the branch no-ops in a browser.

Note that `NotificationLog` records the **web-push** attempt. Native sends are not
individually logged; their health is observable through `DeviceToken.failureCount`
/ `lastFailureAt` / `lastSuccessAt` and `[FCM]`/`[APNs]`-prefixed server logs.

### Client registration — owned by the shell, not this repo

There is **no `src/utils/native-push.ts` in this repo anymore.** Push permission,
token acquisition, and registration are entirely the shell's responsibility
(`mobile-app-v1/src/services/push.ts` and `push-opt-in.ts`), driven by the
shell's own UI (a post-connect permission intro) rather than by this web app
noticing it's unlocked. This repo's only involvement is serving the
`/api/notifications/device-tokens` and `/api/deployment-config` endpoints the
shell calls — there is nothing left here to register a token client-side.

### Deployment flag

`GET /api/deployment-config` (unauthenticated) exposes both a legacy flat flag
and a per-platform breakdown:

```json
{ "nativePushEnabled": true, "nativePush": { "ios": true, "android": false } }
```

`nativePushEnabled` is kept for older shell builds that only know the flat
shape — App Store/Play Store review latency means an installed shell can lag
the server by a version or two, so both shapes have to keep working
simultaneously. `nativePush.{ios,android}` is what a current shell build reads
to decide, per platform, whether it's even worth prompting for permission.

## Deep links

**Files (mobile-app-v1, not this repo):**
`src/services/deep-links.ts`, `app/.well-known/apple-app-site-association/route.ts`
and `app/.well-known/assetlinks.json/route.ts` (this repo), and the Android
manifest's `intent-filter` in `mobile-app-v1/android/app/src/main/AndroidManifest.xml`.

The shell claims a handful of `https://sprout-track.com/...` paths as Universal
Links (iOS) / App Links (Android), so tapping one of these in an email or a
browser opens the app directly instead of (or before) the marketing site:

| Path | Screen |
|------|--------|
| `/setup/{token}` | The family setup wizard, landing an admin-generated `FamilySetup` token straight into the shell's wizard flow. |
| `/verify?token=...` | `AccountVerifyLink` — verifies the emailed confirmation token. |
| `/passwordreset?token=...` | The account password-reset confirmation screen. |

`/account` is **deliberately never claimed** — this is the one exclusion that
matters. `MANAGE_SUBSCRIPTION_URL` (`https://sprout-track.com/account`) is where
subscription management links out to, via `openExternal`, specifically so it
opens in the **system browser** and not inside the app. Claiming `/account` as a
deep link would silently defeat that and reopen the App Store payment-compliance
problem the shell-chrome rules (above) exist to avoid. Marketing routes (`/`,
`/pricing`, `/features`, `/privacy`, `/terms`, `/home`) are likewise left
unclaimed on both platforms.

Two platform mechanisms enforce the same claimed set, asymmetrically:

- **iOS** is server-side: the AASA (`apple-app-site-association`) route in this
  repo is the single source of truth (`claimedPaths()`), served with
  `Cache-Control` and templated with `APPLE_TEAM_ID`. iOS fetches and caches it;
  changing the claimed set here changes what iOS claims without an app update.
- **Android** is baked into the shell's `AndroidManifest.xml` at build time —
  three `pathPrefix` entries mirroring the same three paths. Changing the
  claimed set on Android requires a new app build; `assetlinks.json` in this
  repo (keyed by `ANDROID_CERT_SHA256`) only proves the app is allowed to claim
  `sprout-track.com` at all, it doesn't say which paths.

That asymmetry means the three path prefixes have to be kept in lockstep by hand
across three places (the AASA route, the Android manifest, and the shell's own
`screenForDeepLink` allow-list) — there's no single shared source across repos.
All three currently use **unbounded prefix wildcards** (`/verify*`,
`/passwordreset*`) rather than exact matches; a hypothetical future route like
`/verify-email-changed` would silently become a deep link too. No such route
exists today, so this is a known, accepted blast radius rather than a bug —
flagged as a candidate for coordinated tightening in a future release.

`AccountVerifyLink` exists as a **separate screen** from the shell's existing
`AccountVerify` because they authenticate with different credentials: the
emailed verification link carries a one-time token consumed by the
unauthenticated `POST /api/accounts/verify`, whereas `AccountVerify`'s `token`
prop is an account JWT used against the authenticated `GET /api/accounts/status`
and whose success path unconditionally writes credentials to the vault — which a
cold deep-link tap never has to offer.

Account email links (verification and password reset) moved from the old hash
form (`/#verify`, `/#passwordreset`) to real paths (`/verify`, `/passwordreset`)
so they're linkable/deep-linkable at all — a fragment is never sent to the
server or observable by a native URL-claiming mechanism. **The hash forms are
kept working indefinitely** as a compatibility fallback, not deprecated on any
timeline; anything that already has an old-style link in an inbox must keep
working.

## Operations

| Variable | Effect |
|----------|--------|
| `FCM_SERVICE_ACCOUNT_JSON` | Inline Firebase service-account JSON, enables the Android transport. Unset ⇒ Android native push disabled; web push is unaffected either way. |
| `APNS_AUTH_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION` | APNs provider credentials, enable the iOS transport. All four of the first group are required together; missing any one leaves iOS unconfigured. |
| `APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` | Not push-related — these back the AASA/assetlinks deep-link verification routes above. |

Full details, including the `APNS_PRODUCTION` sandbox/production trap, are in
[environment-variables.md](../Admin-Documentation/environment-variables.md).

Self-hosters who do not run the mobile app need to do nothing: the entire native
layer is inert without the shell's user agent, and each push transport is inert
without its own configuration. Native push is a **SaaS-only** feature.

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
| `tests/native-push-dispatch.test.ts` | Dispatcher: per-platform skip-when-unconfigured, success/failure/unregistered lifecycle |
| `tests/device-token-validation.test.ts` | Body validator edge cases |
| `tests/device-tokens.test.ts` | Registration API: composite-key upsert, 404-when-unconfigured, unauthenticated DELETE |
| `tests/fcm-push.test.ts` | Service-account parsing, message shape, collapse keys (Android transport) |
| `tests/apns-push.test.ts` | Config parsing, JWT claims, response classification, sandbox/production host (iOS transport) |

## Known limitations

- **Duplicate activity pushes.** Targeting iterates web-push subscriptions, so a
  user with several browser subscriptions in one family receives one native push
  per subscription for activity events. Timer events collapse on-device via the
  stable `payload.tag`; activity events do not.
- **Native sends are not in `NotificationLog`.** See above.
- **Biometric gating is shell-side JS**, not OS-`accessControl`-backed Keychain.
  Nothing in this repo depends on that, but it bounds the security claim of the
  handoff.
- **`keepAwake`, `capturePhoto`, `registerPushToken`, and `appResumed`** exist in
  the contract but have no sender or receiver in this repo — capabilities are
  resolved through Capacitor plugins directly instead. They are kept because the
  contract is shared and versioned.
- **A human must open Xcode once** to reconcile automatic signing and the
  Push/Associated-Domains capabilities with the Apple Developer portal before
  this ships to a real device or TestFlight — this is not automatable from the
  command line and hasn't been done as part of this pass.
- **Manual device verification of nursery mode has not been run.** The native
  URL-observation code above (KVO on iOS, `doUpdateVisitedHistory` on Android) is
  unit-tested at the host level, but entering/exiting nursery mode on a real
  device or simulator — confirming the screen actually stays awake, goes
  immersive, and cleanly reverts — is still an open manual check.

## Key Files

- `src/utils/native-app.ts` — detection, plugin access, capability gates
- `src/utils/bridge-contract.ts` — vendored message contract (**do not edit**)
- `src/utils/native-bridge.ts` — web → shell navigation
- `src/utils/native-session.ts` — shell → web session injection
- `src/utils/native-relock.ts` — locked-page decision + loop guard
- `src/utils/shell-chrome.ts` — in-shell presentation rules (IAP compliance)
- `src/utils/external-link.ts` — external-browser opener
- `src/lib/notifications/nativePush.ts` — push dispatcher: token query, per-platform routing, lifecycle
- `src/lib/notifications/fcmPush.ts` — FCM HTTP v1 transport (Android)
- `src/lib/notifications/apnsPush.ts` — APNs HTTP/2 transport (iOS)
- `app/api/notifications/device-tokens/{route,validation}.ts` — token registration API
- `app/api/deployment-config/route.ts` — exposes `nativePush`/`nativePushEnabled` to the shell
- `app/.well-known/apple-app-site-association/route.ts` — claimed-paths source of truth for iOS
- `app/.well-known/assetlinks.json/route.ts` — Android app-package verification (`ANDROID_CERT_SHA256`)
- `app/(app)/[slug]/client-layout.tsx` — where session handoff and relock are wired (no longer push — see above)
- `src/hooks/useCameraStrategy.ts`, `src/utils/photoUtils.ts` — capability overrides
- `src/lib/notifications/client.ts` — service-worker suppression
- `src/components/ui/side-nav/index.tsx`, `src/components/account-manager/AccountSettingsTab.tsx` — shell chrome consumers
- `prisma/schema.prisma` — `DeviceToken` model (`@@unique([token, familyId])`)
- `docs/superpowers/plans/2026-07-20-native-aware-layer-and-push.md` — original native-aware-layer implementation plan
- `docs/superpowers/specs/2026-07-25-native-push-and-nursery-wake-design.md` — spec for this pass (dual-transport push, deep links, native nursery wake)

**In `mobile-app-v1` (the shell repo, not this one):**
- `src/services/push.ts`, `src/services/push-opt-in.ts` — permission, token acquisition, registration (owns the whole client side of push)
- `src/services/deep-links.ts` — maps a claimed URL to a boot-time screen
- `src/screens/AccountVerifyLink.tsx` — handles the emailed `/verify?token=` deep link
- `ios/App/App/NurseryAwareViewController.swift`, `android/app/src/main/java/com/sprouttrack/app/NurseryAwareWebViewClient.java` — native nursery wake/immersive
