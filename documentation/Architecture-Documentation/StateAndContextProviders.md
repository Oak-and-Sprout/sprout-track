# State and Context Providers

## Overview

Sprout Track uses React Context for global state management. Context providers are nested in two layers — the root layout provides localization and timezone, and the app-shell layouts nest the rest — each handling a specific domain. Data fetching throughout the app uses `useEffect` + `fetch` with loading and error states — React Query is not used. The `FamilyProvider` injects auth tokens into all fetch requests automatically.

## Provider Hierarchy

The root layout (`app/layout.tsx`) wraps the whole app (outermost first):

```
LocalizationProvider       ← i18n translations
  └── TimezoneProvider     ← Timezone detection and formatting
```

The app shell (`app/(app)/[slug]/client-layout.tsx`, mirrored by the nursery layout at `app/(nursery)/[slug]/nursery-mode/layout.tsx`) nests the rest:

```
DeploymentProvider         ← Deployment config (SaaS vs self-hosted)
  └── LocalizationProvider ← i18n (re-provided inside the app shell)
        └── FamilyProvider ← Family context, auth, fetch wrapper
              └── BabyProvider  ← Selected baby, active sleep/feed state
                    └── ThemeProvider  ← Light/dark theme management
                          └── ToastProvider  ← App-wide toast notifications
```

Order matters — inner providers can access outer provider values.

## Context Providers

### DeploymentProvider
**File:** `app/context/deployment.tsx`
**Purpose:** Fetches deployment configuration and exposes feature flags.

| Value | Type | Purpose |
|-------|------|---------|
| `isSaasMode` | boolean | SaaS deployment mode |
| `isSelfHosted` | boolean | Self-hosted deployment mode |
| `accountsEnabled` | boolean | Account registration available |
| `registrationAllowed` | boolean | New registrations open |
| `betaEnabled` | boolean | Beta signup enabled |
| `notificationsEnabled` | boolean | Push notifications enabled |
| `refreshConfig()` | function | Force config refresh |

**Data source:** `GET /api/deployment-config`
**Caching:** 5-minute cache, re-fetches on window focus.

### ThemeProvider
**File:** `src/context/theme.tsx`
**Purpose:** Manages light/dark theme toggle by adding/removing `dark` class on `<html>`.

| Value | Type | Purpose |
|-------|------|---------|
| `theme` | 'light' \| 'dark' | Current theme |
| `toggleTheme()` | function | Switch theme |
| `useSystemTheme` | boolean | Follow OS preference |
| `toggleUseSystemTheme()` | function | Toggle OS sync |

**Persistence:** `localStorage` keys `theme` and `useSystemTheme`.
**System sync:** When `useSystemTheme` is true, listens to `matchMedia('prefers-color-scheme: dark')` changes.

### LocalizationProvider
**File:** `src/context/localization.tsx`
**Purpose:** Provides translation function and language management.

| Value | Type | Purpose |
|-------|------|---------|
| `t(key)` | function | Translate a string (key = English text) |
| `language` | string | Current language/locale code (e.g., en, de, es, fr, it, nl, nb, pt-PT, pt-BR, ro) |
| `setLanguage(lang)` | function | Change language |
| `isLoading` | boolean | Translation files loading |

**Storage strategy (3-tier):**
1. Account-based auth → `Account.language` in database (via `PUT /api/localization`)
2. Caretaker-based auth → `Caretaker.language` in database
3. Unauthenticated → `localStorage`
4. System admins → `sessionStorage` key `sysadmin_language`

**Translation loading:** English is bundled; all other languages (configured in `src/localization/supported-languages.json`) are lazy-loaded on demand.

### FamilyProvider
**File:** `src/context/family.tsx`
**Purpose:** The most critical provider. Manages family context, authentication state, and provides the authenticated fetch wrapper.

| Value | Type | Purpose |
|-------|------|---------|
| `family` | object | Current family (id, slug, name, isActive) |
| `setFamily(family)` | function | Change current family |
| `families` | array | All families user has access to |
| `loadFamilies()` | function | Load available families |
| `authenticatedFetch` | function | Fetch wrapper with auth header |
| `handleLogout()` | function | Trigger logout (wired via the provider's `onLogout` prop) |

**Key behaviors:**
- **Fetch interceptor:** Overrides global `fetch` to auto-add `Authorization: Bearer <token>` header to all requests
- **401 handling:** Automatically triggers logout on 401 responses (except on login page)
- **Expiration polling:** In SaaS mode, checks account expiration every 30 seconds
- **Family resolution:** Extracts family from URL slug via `GET /api/family/by-slug/{slug}`

**Persistence:** `localStorage` key `selectedFamily` (family-specific).

### TimezoneProvider
**File:** `app/context/timezone.tsx`
**Purpose:** Client-side timezone detection and date formatting utilities.

| Value | Type | Purpose |
|-------|------|---------|
| `timezone` | string | Detected browser timezone (e.g., "America/New_York") |
| `formatDate(date)` | function | Format date for display |
| `formatTime(date)` | function | Format time for display |
| `formatDateTime(date)` | function | Format date+time for display |
| `toLocalDate(date)` | function | Convert UTC to local |
| `toUTCString(date)` | function | Convert local to UTC string |
| `getCurrentUTCString()` | function | Current time as UTC string |

**Refresh:** Re-detects timezone on window focus (handles travel/timezone changes).
**DST:** Includes DST detection and handling.

### BabyProvider
**File:** `app/context/baby.tsx`
**Purpose:** Manages selected baby state and baby list for the current family.

| Value | Type | Purpose |
|-------|------|---------|
| `selectedBaby` | object | Currently selected baby |
| `setSelectedBaby(baby)` | function | Change selected baby |
| `sleepingBabies` | Set&lt;string&gt; | IDs of babies currently sleeping (with setter) |
| `feedingBabies` | Set&lt;string&gt; | IDs of babies with active feeds (with setter) |
| `accountStatus` | object | Account trial/expiration status (account-based auth) |
| `isAccountAuth` | boolean | Whether user authenticated with an account (vs PIN) |

**Key behaviors:**
- **Family-specific storage:** Uses `localStorage` keys with pattern `{baseKey}_{familyId}` to keep selections separate per family
- **Validation:** Verifies selected baby belongs to current family
- **Auto-redirect:** Sends verified users without families to the setup page
- **Auth monitoring:** Watches `localStorage` storage events for auth token changes

### ToastProvider
**File:** `src/components/ui/toast/toast-provider.tsx` (exported from `src/components/ui/toast`)
**Purpose:** App-wide toast notifications, consumed via the `useToast()` hook. Innermost provider in the app shell.

## Custom Hooks

### useWakeLock
**File:** `src/hooks/useWakeLock.ts`
**Purpose:** Prevents screen from sleeping using the Wake Lock API. Used in nursery mode.

| Return | Type | Purpose |
|--------|------|---------|
| `isActive` | boolean | Wake lock currently held |
| `isSupported` | boolean | Browser supports Wake Lock |
| `request()` | function | Acquire wake lock |
| `release()` | function | Release wake lock |

Auto-acquires on mount, re-acquires on visibility change (tab switch back).

### useFullscreen
**File:** `src/hooks/useFullscreen.ts`
**Purpose:** Cross-browser fullscreen API support. Used in nursery mode.

| Return | Type | Purpose |
|--------|------|---------|
| `isFullscreen` | boolean | Currently in fullscreen |
| `isSupported` | boolean | Browser supports fullscreen |
| `enter()` | function | Enter fullscreen |
| `exit()` | function | Exit fullscreen |
| `toggle()` | function | Toggle fullscreen |

Handles webkit, moz, ms vendor prefixes.

### useNurserySettings
**File:** `src/hooks/useNurserySettings.ts`
**Purpose:** Fetches and saves nursery mode configuration.

| Return | Type | Purpose |
|--------|------|---------|
| `settings` | object | Current nursery settings |
| `isLoading` | boolean | Settings loading |
| `saveSettings(s)` | function | Save settings (debounced 500ms) |

**Default settings:** hue=230, brightness=15, saturation=25, visibleTiles=['feed', 'pump', 'diaper', 'sleep']
**API:** `GET/PUT /api/nursery-mode-settings`

### useNurseryColors
**File:** `src/hooks/useNurseryColors.ts`
**Purpose:** Generates HSLA color palette from nursery settings.

Takes hue, brightness, saturation as input. Returns 16 computed colors (text, subtext, border, tileBg, btnBg, accent, etc.). Uses `useMemo` for performance.

Brightness 0-50% = dark palette, 50-100% = light palette.

### useEmailValidation
**File:** `src/hooks/useEmailValidation.ts`
**Purpose:** Email format validation with state management.

| Return | Type | Purpose |
|--------|------|---------|
| `email` | string | Current email value |
| `error` | string | Validation error message |
| `isValid` | boolean | Email passes validation |
| `setEmail(e)` | function | Update email (auto-clears error) |
| `validateEmail()` | function | Trigger validation |
| `clearError()` | function | Clear error state |

### useIsMobile
**File:** `src/hooks/useIsMobile.ts`
**Purpose:** Returns `true` when the viewport width is 600px or less; updates on window resize.

### useUnit
**File:** `src/hooks/useUnit.ts`
**Purpose:** Localizes measurement unit names and symbols (`unitName()`, `unitSymbol()`), falling back to the raw `unitAbbr` when no translation exists.

### useFeedbackChat
**File:** `src/hooks/useFeedbackChat.ts`
**Purpose:** Manages feedback/support threads — fetching threads, sending replies and new feedback, uploading/deleting attachments, and read/unread state.

## Data Fetching Pattern

Throughout the application, data fetching follows this pattern:

```typescript
const [data, setData] = useState<DataType[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/some-endpoint');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };
  fetchData();
}, [dependencies]);
```

The `FamilyProvider`'s fetch interceptor automatically adds the auth token, so components don't need to manage authentication headers.

## Key Files

- `app/layout.tsx` — Root layout (LocalizationProvider, TimezoneProvider)
- `app/(app)/[slug]/client-layout.tsx` — App shell with the remaining provider nesting
- `app/(nursery)/[slug]/nursery-mode/layout.tsx` — Nursery mode layout (same provider nesting)
- `app/context/deployment.tsx` — DeploymentProvider
- `app/context/timezone.tsx` — TimezoneProvider
- `app/context/baby.tsx` — BabyProvider
- `src/context/theme.tsx` — ThemeProvider
- `src/context/localization.tsx` — LocalizationProvider
- `src/context/family.tsx` — FamilyProvider (auth integration)
- `src/components/ui/toast/toast-provider.tsx` — ToastProvider
- `src/hooks/useWakeLock.ts` — Wake Lock API hook
- `src/hooks/useFullscreen.ts` — Fullscreen API hook
- `src/hooks/useNurserySettings.ts` — Nursery settings hook
- `src/hooks/useNurseryColors.ts` — Nursery color palette hook
- `src/hooks/useEmailValidation.ts` — Email validation hook
- `src/hooks/useIsMobile.ts` — Mobile viewport detection hook
- `src/hooks/useUnit.ts` — Unit name/symbol localization hook
- `src/hooks/useFeedbackChat.ts` — Feedback thread management hook
