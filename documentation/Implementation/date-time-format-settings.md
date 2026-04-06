# Date & Time Format Settings Implementation Plan

**GitHub Issue:** [Oak-and-Sprout/sprout-track#152](https://github.com/Oak-and-Sprout/sprout-track/issues/152)  
**Date:** 2026-04-06

## Overview

Add family-level date and time format settings so an admin can configure how dates and times are displayed for everyone in the family. This is independent of localization — it's a family preference set by the admin.

### Format Options

**Date Format:**
- `MM/DD/YYYY` (04/06/2026) — default
- `DD/MM/YYYY` (06/04/2026)
- `YYYY-MM-DD` (2026-04-06)

**Time Format:**
- `12h` (1:30 PM) — default
- `24h` (13:30)

---

## Phase 1: Database & API Layer

### 1.1 Prisma Schema

**File:** `prisma/schema.prisma` (Settings model, line ~488)

Add two new fields after `includeSolidsInFeedTimer`:

```prisma
dateFormat          String   @default("MM/DD/YYYY") // "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD"
timeFormat          String   @default("12h")         // "12h" | "24h"
```

Run migration: `npx prisma migrate dev --name add_date_time_format_settings`

### 1.2 Settings API Route

**File:** `app/api/settings/route.ts`

- **handleGet** (line 31-43): Add `dateFormat: 'MM/DD/YYYY'` and `timeFormat: '12h'` to the default `create` call
- **handlePut** (line 111-116): Add `'dateFormat'` and `'timeFormat'` to the `adminOnlyFields` array

---

## Phase 2: Central Formatting Utility

### 2.1 Create `src/utils/dateFormat.ts`

New pure utility file (no React dependencies) with the core formatting logic:

```typescript
export type DateFormatSetting = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type TimeFormatSetting = '12h' | '24h';

// Core formatting functions using Intl.DateTimeFormat with formatToParts()
export function formatTimeDisplay(date: Date, timeFormat: TimeFormatSetting, timezone?: string): string
export function formatDateDisplay(date: Date, dateFormat: DateFormatSetting, timezone?: string): string
export function formatDateShort(date: Date, dateFormat: DateFormatSetting, timezone?: string): string
export function formatDateTimeDisplay(date: Date, dateFormat: DateFormatSetting, timeFormat: TimeFormatSetting, timezone?: string): string
```

**Implementation approach:** Use `Intl.DateTimeFormat` with `formatToParts()` to extract day/month/year parts, then reorder according to the `dateFormat` setting. For time, use `hour12: true/false` based on `timeFormat`.

### 2.2 Extend TimezoneContext

**File:** `app/context/timezone.tsx`

The `TimezoneProvider` already provides `formatDate()`, `formatTime()`, `formatDateOnly()`, and `formatDateTime()` to **27 components**. Extending it is the highest-leverage change.

**Changes:**
1. Add state for `dateFormat` and `timeFormat` (defaults: `'MM/DD/YYYY'`, `'12h'`)
2. Fetch `/api/settings` on mount to get family format preferences (with auth token from localStorage)
3. Expose `dateFormat`, `timeFormat`, and `setDateTimeFormats()` in context value
4. Update existing formatting methods to respect format settings:
   - `formatTime()` (line 225-231): Use `hour12: timeFormat === '12h'`
   - `formatDateOnly()` (line 236-241): Use `formatDateDisplay()` from utility
   - `formatDateTime()` (line 247-256): Use `formatDateTimeDisplay()` from utility
   - `formatDate()` (line 183-220): When no explicit `formatOptions` passed, use format-aware defaults; when explicit options ARE passed, still apply `hour12` from `timeFormat`

**New context interface additions:**
```typescript
dateFormat: DateFormatSetting;
timeFormat: TimeFormatSetting;
setDateTimeFormats: (dateFormat: DateFormatSetting, timeFormat: TimeFormatSetting) => void;
```

---

## Phase 3: Update Formatting Call Sites

### Category A: Automatic Updates (27 files — NO code changes needed)

These files use `useTimezone()` formatters and will automatically pick up new formatting:

| File | Functions Used |
|------|---------------|
| `src/components/forms/FeedForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/SleepForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/DiaperForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/BathForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/ActivityForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/PumpForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/NoteForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/MilestoneForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/MeasurementForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/GiveMedicineForm/index.tsx` | formatDate, formatTime |
| `src/components/forms/VaccineForm/VaccineHistoryTab.tsx` | formatDate |
| `src/components/forms/VaccineForm/RecordVaccineTab.tsx` | formatDate |
| `src/components/forms/MedicineForm/ActiveDosesTab.tsx` | formatDate |
| `src/components/forms/MedicineForm/GiveMedicineTab.tsx` | formatDate |
| `src/components/FullLogTimeline/FullLogExportButton.tsx` | formatDate |
| `src/components/Reports/StatsTab.tsx` | formatDate |
| `src/components/Reports/VaccineStatsSection.tsx` | formatDate |
| `src/components/ui/status-bubble/index.tsx` | formatTime |
| `src/components/ui/activity-tile/activity-tile-utils.ts` | formatTime |
| `src/components/features/nursery-mode/NurseryModeContainer.tsx` | formatDate |
| `src/components/debugTimezone/index.tsx` | formatDate, formatTime |
| `app/(app)/[slug]/full-log/page.tsx` | formatDate |
| `app/(app)/[slug]/calendar/page.tsx` | formatDate |

### Category B: Manual Updates Required

These files have hardcoded date/time formatting and need to be updated to use the centralized utility or `useTimezone()`:

#### High Priority (core display logic)

1. **`src/components/Timeline/utils.tsx`** (lines 130-165)
   - `formatTime()` function — used by TimelineV2ActivityList, FullLogActivityDetails, and more
   - Currently hardcodes `hour12: true` and `'en-US'` locale
   - Update to read `dateFormat`/`timeFormat` from the `Settings` object it already receives
   - The `Settings` type will include `dateFormat`/`timeFormat` after the Prisma migration

2. **`src/components/ui/date-time-picker/index.tsx`** (lines 107-126)
   - Uses date-fns `format(date, 'MMM d, yyyy')` and `format(date, 'h:mm a')`
   - Replace with utility calls from `src/utils/dateFormat.ts`
   - Add `useTimezone()` to get format settings

3. **`src/components/features/nursery-mode/Clock.tsx`** (lines 19-27)
   - Hardcoded `'en-US'` with `hour12: true` for clock display
   - Add `useTimezone()` to get format settings

4. **`src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx`** (lines 173-212)
   - Hardcoded `toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })`
   - Update to use utility functions with format settings

5. **`src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx`** (lines 639-645)
   - Hardcoded `toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })`
   - Update to use utility functions

6. **`src/components/FullLogTimeline/FullLogFilter.tsx`** (lines 76-82)
   - Hardcoded date range format with `toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })`
   - Update to use utility functions

7. **`src/components/FullLogTimeline/FullLogActivityDetails.tsx`** (lines 42, 191-196)
   - Uses `formatTime()` from Timeline/utils.tsx — will be updated when that utility is updated

#### Medium Priority (reports & charts — display labels only)

8. **Report Chart Modals** — Update only the display `label` formatting, NOT the `en-CA` date aggregation keys:
   - `src/components/Reports/FeedingChartModal.tsx`
   - `src/components/Reports/SleepChartModal.tsx`
   - `src/components/Reports/DiaperChartModal.tsx`
   - `src/components/Reports/BathChartModal.tsx`
   - `src/components/Reports/PlayChartModal.tsx`
   - `src/components/Reports/PumpingChartModal.tsx`
   - `src/components/Reports/SleepLocationChartModal.tsx`
   - `src/components/Reports/SleepLocationsChartModal.tsx`
   - `src/components/Reports/HealthChartModal.tsx`

9. **Report Stats Sections** (dates in stat displays):
   - `src/components/Reports/SleepStatsSection.tsx`
   - `src/components/Reports/FeedingStatsSection.tsx`
   - `src/components/Reports/DiaperStatsSection.tsx`
   - `src/components/Reports/BathStatsSection.tsx`
   - `src/components/Reports/PlayStatsSection.tsx`
   - `src/components/Reports/PumpingStatsSection.tsx`
   - `src/components/Reports/MedicineStatsSection.tsx`
   - `src/components/Reports/TemperatureStatsSection.tsx`

#### Lower Priority (less frequently viewed)

10. **`src/components/Calendar/index.tsx`** (line 231)
    - Month/year display: `toLocaleDateString('en-US', { month: 'long', year: 'numeric' })`

11. **`src/components/CalendarEventItem/index.tsx`** (lines 36, 40, 59)
    - Event time and date display with hardcoded `'en-US'`

12. **`src/components/familymanager/utils.ts`** (line 16)
    - `formatDateTime()` — admin panel date formatting

13. **Modal datetime-local inputs** — These use native HTML `<input type="datetime-local">` which is browser-formatted. The `formatDateForInput()` helpers produce ISO format for the input `value` attribute and should NOT change. However, any display text around these inputs should use the format settings:
    - `src/components/modals/SleepModal.tsx`
    - `src/components/modals/FeedModal.tsx`
    - `src/components/modals/DiaperModal.tsx`
    - `src/components/modals/NoteModal.tsx`
    - `src/components/modals/BabyModal.tsx`

14. **Monthly Report Card components:**
    - `src/components/Reports/MonthlyReportCard/` — various date displays

### Category C: DO NOT CHANGE

These use `toLocaleDateString('en-CA')` for chart data aggregation keys (ISO format for grouping). Changing these would break chart data:

- All chart modal files' data key generation lines
- `src/components/Reports/HealthTab.tsx` data aggregation

---

## Phase 4: Settings UI

### 4.1 ConfigTab.tsx

**File:** `src/components/forms/SettingsForm/ConfigTab.tsx`

Add a new "Date & Time Format" section after "Feed Timer" and before "System Administration":

```tsx
{/* Date & Time Format */}
<div className="border-t border-slate-200 pt-6">
  <h3 className="form-label mb-4">{t('Date & Time Format')}</h3>
  <div className="space-y-4">
    <div>
      <Label className="form-label">{t('Date Format')}</Label>
      <Select
        value={settings?.dateFormat || 'MM/DD/YYYY'}
        onValueChange={(value) => onSettingsChange({ dateFormat: value })}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (04/06/2026)</SelectItem>
          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (06/04/2026)</SelectItem>
          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-04-06)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div>
      <Label className="form-label">{t('Time Format')}</Label>
      <Select
        value={settings?.timeFormat || '12h'}
        onValueChange={(value) => onSettingsChange({ timeFormat: value })}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="12h">{t('12-hour')} (1:30 PM)</SelectItem>
          <SelectItem value="24h">{t('24-hour')} (13:30)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</div>
```

After saving, also call `setDateTimeFormats()` from `useTimezone()` to update the context immediately (no page reload needed).

### 4.2 Translation Keys

Add to `src/localization/translations/en.json`:
- `"Date & Time Format"`
- `"Date Format"`
- `"Time Format"`
- `"12-hour"`
- `"24-hour"`

Run `node scripts/check-missing-translations.js` to propagate to other language files.

---

## Implementation Order

1. **Phase 1** — Schema + API (foundation, everything depends on this)
2. **Phase 2.1** — Create `src/utils/dateFormat.ts` (pure utility, no dependencies)
3. **Phase 2.2** — Extend `TimezoneContext` (enables automatic updates for 27 files)
4. **Phase 4** — Settings UI (allows testing the setting)
5. **Phase 3** — Update hardcoded call sites (Category B files, by priority)

## Testing Checklist

- [ ] Changing format in ConfigTab immediately updates all visible dates/times (no page reload)
- [ ] All three date formats display correctly in Timeline, FullLog, Reports
- [ ] Both 12h and 24h time formats display correctly
- [ ] Chart data aggregation keys remain in ISO format (not affected by setting)
- [ ] Native `datetime-local` inputs are unaffected
- [ ] Non-admin users cannot change format settings (API rejects)
- [ ] New families get default `MM/DD/YYYY` / `12h` format
- [ ] Nursery mode clock respects time format
- [ ] DateTimePicker component respects both format settings
- [ ] Export (CSV/XLSX) date formats are consistent
