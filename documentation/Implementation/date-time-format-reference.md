# Date & Time Format Settings — Developer Reference

## Overview

Date and time display formats are configurable per-family via admin settings. The setting is stored in the `Settings` model and flows through the `TimezoneContext` to all components.

**Date Format Options:** `MM/DD/YYYY` | `DD/MM/YYYY` | `YYYY-MM-DD`  
**Time Format Options:** `12h` | `24h`

---

## Architecture

```
Settings DB (dateFormat, timeFormat)
        ↓
  /api/settings (GET/PUT)
        ↓
  TimezoneContext (fetches on mount, exposes dateFormat/timeFormat)
        ↓
  ┌─────────────────────────────────┐
  │  Components using useTimezone() │ ← automatic, no extra work
  │  (27+ files)                    │
  └─────────────────────────────────┘
        ↓
  ┌─────────────────────────────────┐
  │  Components using utility       │ ← import + hook + call utility
  │  functions directly             │
  └─────────────────────────────────┘
```

---

## How to Format Dates in New Code

### Option 1: Use TimezoneContext (preferred for most components)

If your component already uses `useTimezone()` or can add it:

```tsx
import { useTimezone } from '@/app/context/timezone';

function MyComponent() {
  const { formatTime, formatDateOnly, formatDateTime } = useTimezone();

  // These automatically use the family's format settings
  const time = formatTime(isoString);           // "1:30 PM" or "13:30"
  const date = formatDateOnly(isoString);       // "Apr 6, 2026" or "6 Apr 2026" or "2026-04-06"
  const both = formatDateTime(isoString);       // "Apr 6, 2026 1:30 PM" or "2026-04-06 13:30"
}
```

### Option 2: Use utility functions directly

For more control, or when you need short dates, chart labels, or numeric formats:

```tsx
import { useTimezone } from '@/app/context/timezone';
import {
  formatTimeDisplay,
  formatDateDisplay,
  formatDateShort,
  formatDateLong,
  formatDateTimeDisplay,
} from '@/src/utils/dateFormat';

function MyComponent() {
  const { dateFormat, timeFormat } = useTimezone();
  const date = new Date(someIsoString);

  formatTimeDisplay(date, timeFormat);              // "1:30 PM" or "13:30"
  formatDateDisplay(date, dateFormat);              // "04/06/2026" or "06/04/2026" or "2026-04-06"
  formatDateShort(date, dateFormat);                // "Apr 6" or "6 Apr" or "2026-04-06"
  formatDateLong(date, dateFormat);                 // "Apr 6, 2026" or "6 Apr 2026" or "2026-04-06"
  formatDateTimeDisplay(date, dateFormat, timeFormat); // combined date + time
}
```

### Option 3: Non-React code (utilities, helpers)

For files that can't use hooks, accept the format settings as parameters:

```typescript
import { formatDateShort, DateFormatSetting, TimeFormatSetting } from '@/src/utils/dateFormat';

function myHelper(date: Date, dateFormat: DateFormatSetting) {
  return formatDateShort(date, dateFormat);
}
```

---

## Utility Functions Reference

All functions live in `src/utils/dateFormat.ts`. They are pure functions with no React dependencies.

| Function | Output (MM/DD/YYYY, 12h) | Output (DD/MM/YYYY) | Output (YYYY-MM-DD) | Use For |
|---|---|---|---|---|
| `formatTimeDisplay` | 1:30 PM | 1:30 PM | 1:30 PM | Time-only display |
| `formatDateDisplay` | 04/06/2026 | 06/04/2026 | 2026-04-06 | Full numeric date |
| `formatDateShort` | Apr 6 | 6 Apr | 2026-04-06 | Chart labels, timeline dates |
| `formatDateLong` | Apr 6, 2026 | 6 Apr 2026 | 2026-04-06 | Date with year |
| `formatDateTimeDisplay` | Apr 6, 2026 1:30 PM | 6 Apr 2026 1:30 PM | 2026-04-06 13:30 | Full date + time |

All functions accept an optional `timezone` parameter (e.g., `'America/Denver'`). When using `useTimezone()` context methods, timezone is applied automatically.

---

## Types

```typescript
type DateFormatSetting = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
type TimeFormatSetting = '12h' | '24h';
```

Both are exported from `src/utils/dateFormat.ts`.

---

## What NOT to Change

- **`toLocaleDateString('en-CA')`** — Used in chart modals for data aggregation keys (groups data by ISO date string). Changing these would break chart data grouping.
- **`type="datetime-local"` input values** — Browser-native inputs require ISO format (`yyyy-MM-ddTHH:mm`). The `formatDateForInput()` helpers in modals produce this format and must not change.
- **`type="date"` input values** — Same as above, must stay ISO.
- **`format(date, "yyyy-MM-dd'T'HH:mm")` in CalendarEventForm** — ISO format for datetime-local input values.

---

## Where Settings Are Stored

- **Database:** `Settings.dateFormat` and `Settings.timeFormat` in `prisma/schema.prisma`
- **API:** `GET/PUT /api/settings` — both fields are in `adminOnlyFields` (only admin/owner/sysadmin can change)
- **Defaults:** `MM/DD/YYYY` and `12h` (set in schema defaults and API create call)
- **UI:** Config tab in Settings form (`src/components/forms/SettingsForm/ConfigTab.tsx`)

---

## How the Context Works

1. `TimezoneProvider` (`app/context/timezone.tsx`) fetches `/api/settings` on mount using the auth token from localStorage
2. Stores `dateFormat` and `timeFormat` in state (defaults to `MM/DD/YYYY` / `12h` until fetched)
3. All context formatting methods (`formatTime`, `formatDateOnly`, `formatDateTime`) use these settings
4. When admin changes the setting in ConfigTab, `setDateTimeFormats()` is called to update context immediately — no page reload needed

---

## Checklist for Adding Date/Time Display to a New Component

1. Does the component already use `useTimezone()`?
   - **Yes:** Use `formatTime()`, `formatDateOnly()`, or `formatDateTime()` from the context. Done.
   - **No:** Import `useTimezone` and destructure `{ dateFormat, timeFormat }`, then use utility functions.
2. Is this a non-React file (utility, helper)?
   - Accept `dateFormat`/`timeFormat` as parameters. Import types and functions from `src/utils/dateFormat.ts`.
3. Is this a chart data key or input value?
   - **Do not use the format utilities.** Keep ISO format.
4. Add any new user-facing text to `src/localization/translations/en.json` and run `node scripts/check-missing-translations.js`.

---

## Related Files

| File | Purpose |
|---|---|
| `src/utils/dateFormat.ts` | Pure formatting utility functions |
| `app/context/timezone.tsx` | TimezoneContext with format-aware methods |
| `app/api/settings/route.ts` | Settings API (stores/retrieves format settings) |
| `prisma/schema.prisma` | Settings model with `dateFormat` and `timeFormat` fields |
| `src/components/forms/SettingsForm/ConfigTab.tsx` | Admin UI for changing format settings |
| `documentation/Implementation/date-time-format-settings.md` | Full implementation plan with file-by-file changes |
