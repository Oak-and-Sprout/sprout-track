# Adding a New Activity Type

This document describes every file and layer that must be touched when adding a new activity type to the application. It uses the "Play/Activity" feature (Tummy Time, Indoor Play, Outdoor Play, Walk) as the reference implementation.

---

## Overview

Adding a new activity requires changes across **7 layers**:

1. **Database & Schema** - Prisma model and enums
2. **API Types** - TypeScript response/create interfaces
3. **API Route** - CRUD endpoint
4. **Timeline API** - Aggregation into the unified timeline
5. **Activity Tiles & Settings** - Tile display, ordering, visibility
6. **Forms** - Create/edit form component
7. **Display Layer** - Timeline views, full log, details, filters
8. **Localization** - Translation keys in all language files

---

## 1. Database & Schema

**File:** `prisma/schema.prisma`

- Add or update the Prisma model (e.g., `PlayLog`)
- Add or update any enums (e.g., `PlayType`)
- Run `npx prisma migrate dev` to generate a migration (SQLite stores enums as strings, so enum-only changes may not produce a migration file but still require `npx prisma generate`)

---

## 2. API Types

**File:** `app/api/types.ts`

- Import the Prisma model type
- Create a `Response` type that converts `Date` fields to `string`:
  ```typescript
  export type PlayLogResponse = Omit<PlayLog, 'startTime' | 'endTime' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
    startTime: string;
    endTime: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  };
  ```
- Create a `Create` interface for the POST body

---

## 3. API Route

**File:** `app/api/<activity-name>/route.ts` (new file)

Create a CRUD route following existing patterns (e.g., `app/api/note/route.ts`):

- **GET** - Fetch by id, babyId, date range; optionally support category queries
- **POST** - Create with UTC conversion, family scoping, write protection
- **PUT** - Update by `?id=` query param
- **DELETE** - Delete by id with family scoping
- Use `withAuthContext` for authentication
- Use `checkWritePermission` for write protection
- Use `toUTC` / `formatForResponse` for timezone conversion
- Call `notifyActivityCreated` for push notifications

---

## 4. Timeline API

**File:** `app/api/timeline/route.ts`

- Add the new response type to imports and `ActivityTypeWithCaretaker` union
- Add a `prisma.<model>.findMany(...)` query to the `Promise.all()` block
- Format response dates with `formatForResponse()`
- Spread formatted results into the `allActivities` array

---

## 5. Activity Tiles & Settings

### 5a. Activity Tile Types
**File:** `src/components/ui/activity-tile/activity-tile.types.ts`
- Add the response type to `ActivityType` union
- Add the variant name (e.g., `'play'`) to `ActivityTileVariant`

### 5b. Activity Tile Styles
**File:** `src/components/ui/activity-tile/activity-tile.styles.ts`
- Add variant to `button.variants`, `iconContainer.variants`, `icon.variants`
- Add default icon path to `icon.defaultIcons`

### 5c. Activity Tile Utils
**File:** `src/components/ui/activity-tile/activity-tile-utils.ts`
- Add a type guard in `getActivityVariant()` to detect the new activity type
- Add description logic in the `useActivityDescription` hook

### 5d. Activity Tile Icon
**File:** `src/components/ui/activity-tile/activity-tile-icon.tsx` (if using custom icon rendering)
- Add icon rendering for the new variant (e.g., overlapping lucide icons)

### 5e. Activity Tile Group
**File:** `src/components/ActivityTileGroup/index.tsx`
- Import the response type
- Add `onXxxClick` prop to the interface
- Add the variant string to the `ActivityType` union and all `allActivityTypes` arrays (there are multiple occurrences - use find/replace)
- Add to `originalOrderRef` and `originalVisibleRef` defaults
- Add display name to `activityDisplayNames` record
- Add case in `renderActivityTile()` with a stub activity object

### 5f. Activity Settings API
**File:** `app/api/activity-settings/route.ts`
- Add the variant name to the `defaultSettings.order` and `defaultSettings.visible` arrays
- Add to any other `defaultActivities` arrays in the file

---

## 6. Form Component

**Directory:** `src/components/forms/<ActivityName>Form/`

### 6a. `index.tsx` (new file)
- Use `FormPage`, `FormPageContent`, `FormPageFooter` wrappers
- Accept `isOpen`, `onClose`, `babyId`, `initialTime`, `activity?` (for edit mode), `onSuccess?` props
- Use `useTimezone`, `useTheme`, `useToast`, `useLocalization` hooks
- Handle create (POST) and edit (PUT) modes
- Use `handleExpirationError` for 403 responses

### 6b. CSS file (new file, if needed)
- Dark mode overrides using `html.dark` selectors

---

## 7. Display Layer

This is the most extensive layer. The new activity must be wired into **all** timeline and detail views.

### 7a. Timeline Shared Utils
**File:** `src/components/Timeline/utils.tsx`

Add the new activity detection to **all** of these functions (order matters - check before types that share similar fields):

| Function | What to add |
|---|---|
| `getActivityIcon()` | Return appropriate icon |
| `getActivityStyle()` | Return `{ bg, textColor }` |
| `getActivityDescription()` | Return `{ type, details }` for list display |
| `getActivityDetails()` | Return `{ title, details[] }` for detail panel |
| `getActivityEndpoint()` | Return API route name (e.g., `'play-log'`) |

**Important:** If the new activity shares fields with existing types (e.g., both PlayLog and SleepLog have `duration`, `startTime`, `type`), check for the new activity **before** the existing type to avoid misidentification. Use a unique field as the discriminator (e.g., `'activities' in activity`).

### 7b. Timeline Types
**File:** `src/components/Timeline/types.ts`
- Add variant to `FilterType` union
- Add variant to `onEdit` type parameter in `TimelineActivityDetailsProps`

### 7c. TimelineV2 Activity List
**File:** `src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx`
- Add activity type class detection in `activityTypeClass` block
- Add inline detail rendering in the event details IIFE
- Add color mapping in `getActivityColor()`

### 7d. TimelineV2 Daily Stats
**File:** `src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx`
- Add counting variables and counting logic in the `activities.forEach()` loop
- Add a stat tile to the `tiles` array
- **Important:** If the new activity shares fields with sleep (duration, startTime, type), add the check **before** the sleep check and `return` to skip further checks

### 7e. TimelineV2 Daily Stats CSS
**File:** `src/components/Timeline/TimelineV2/TimelineV2DailyStats.css`
- Add dark mode color rule for the icon color class

### 7f. Timeline Activity List CSS
**File:** `src/components/Timeline/timeline-activity-list.css`
- Add `.event-icon.<variant>` background and svg color rules
- Add `.timeline-event.<variant>::before` line color rule
- Add `html.dark .event-icon.<variant>` dark mode rules

### 7g. TimelineV2 Container
**File:** `src/components/Timeline/TimelineV2/index.tsx`
- Import the form component and response type
- Add variant to `editModalType` state type
- Add variant to `handleEdit` parameter type
- Add filter case in the `activeFilter` switch
- Add the edit form component in the JSX

### 7h. Timeline Container (old)
**File:** `src/components/Timeline/index.tsx`
- Same changes as TimelineV2 container above

### 7i. Timeline Activity Details
**File:** `src/components/Timeline/TimelineActivityDetails.tsx`
- Add edit handler check before existing type checks in `handleEdit()`

### 7j. FullLogTimeline Types
**File:** `src/components/FullLogTimeline/full-log-timeline.types.ts`
- Add variant to `FilterType` union
- Add variant to `onEdit` type parameter in `FullLogActivityDetailsProps`

### 7k. FullLog Filter
**File:** `src/components/FullLogTimeline/FullLogFilter.tsx`
- Import the icon
- Add filter option to `filterOptions` array

### 7l. FullLog Activity Details
**File:** `src/components/FullLogTimeline/FullLogActivityDetails.tsx`
- Add edit handler check in `handleEdit()`

### 7m. FullLogTimeline Container
**File:** `src/components/FullLogTimeline/index.tsx`
- Import the form component and response type
- Add variant to `editModalType` state type
- Add variant to `handleEdit` parameter type
- Add filter case in both `sortedActivities` and `totalPages` switch blocks
- Add search logic in `matchesSearch()`
- Add the edit form component in the JSX
- Exclude new activity from sleep form's activity prop check (if fields overlap): `!('activities' in selectedActivity)`

---

## 8. Log Entry Page

**File:** `app/(app)/[slug]/log-entry/page.tsx`
- Import the form component
- Add modal state (e.g., `showActivityModal`)
- Add `onXxxClick` handler to `ActivityTileGroup`
- Render the form component with standard props

---

## 9. Localization

**Files:**
- `src/localization/translations/en.json`
- `src/localization/translations/es.json`
- `src/localization/translations/fr.json`

- Add all user-facing strings as translation keys
- Keys match their English text exactly (project convention)
- After adding keys, run `node scripts/check-missing-translations.js` to verify all files are in sync and alphabetically sorted

---

## Type Discrimination Gotchas

When multiple activity types share fields (e.g., PlayLog and SleepLog both have `duration`, `startTime`, `type`):

1. **Always check the new activity before the conflicting type** in every detection function
2. Use a **unique field** as the discriminator (e.g., PlayLog has `activities`, SleepLog has `quality`)
3. When passing activities to form components, **exclude the new type** from existing checks:
   ```typescript
   // Before: matches both SleepLog and PlayLog
   activity={'duration' in selectedActivity && 'type' in selectedActivity ? selectedActivity : undefined}

   // After: excludes PlayLog
   activity={'duration' in selectedActivity && 'type' in selectedActivity && !('activities' in selectedActivity) ? selectedActivity : undefined}
   ```

---

## File Checklist

| # | File | Action |
|---|---|---|
| 1 | `prisma/schema.prisma` | Add/update model and enums |
| 2 | `app/api/types.ts` | Add response and create types |
| 3 | `app/api/<name>/route.ts` | Create CRUD route |
| 4 | `app/api/timeline/route.ts` | Add to timeline aggregation |
| 5 | `app/api/activity-settings/route.ts` | Add to default settings |
| 6 | `src/components/ui/activity-tile/activity-tile.types.ts` | Add to type unions |
| 7 | `src/components/ui/activity-tile/activity-tile.styles.ts` | Add variant styles |
| 8 | `src/components/ui/activity-tile/activity-tile-utils.ts` | Add type guard and description |
| 9 | `src/components/ui/activity-tile/activity-tile-icon.tsx` | Add icon rendering |
| 10 | `src/components/ActivityTileGroup/index.tsx` | Wire up tile and click handler |
| 11 | `src/components/forms/<Name>Form/index.tsx` | Create form component |
| 12 | `src/components/forms/<Name>Form/*.css` | Dark mode styles |
| 13 | `app/(app)/[slug]/log-entry/page.tsx` | Add form modal |
| 14 | `src/components/Timeline/types.ts` | Add to FilterType and onEdit |
| 15 | `src/components/Timeline/utils.tsx` | Add to all 5 utility functions |
| 16 | `src/components/Timeline/timeline-activity-list.css` | Add icon and line styles |
| 17 | `src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx` | Add detection and rendering |
| 18 | `src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx` | Add counting and stat tile |
| 19 | `src/components/Timeline/TimelineV2/TimelineV2DailyStats.css` | Add dark mode color |
| 20 | `src/components/Timeline/TimelineV2/index.tsx` | Add filter, form, types |
| 21 | `src/components/Timeline/index.tsx` | Add filter, form, types |
| 22 | `src/components/Timeline/TimelineActivityDetails.tsx` | Add edit handler |
| 23 | `src/components/FullLogTimeline/full-log-timeline.types.ts` | Add to FilterType and onEdit |
| 24 | `src/components/FullLogTimeline/FullLogFilter.tsx` | Add filter option |
| 25 | `src/components/FullLogTimeline/FullLogActivityDetails.tsx` | Add edit handler |
| 26 | `src/components/FullLogTimeline/index.tsx` | Add filter, search, form |
| 27 | `src/localization/translations/en.json` | Add translation keys |
| 28 | `src/localization/translations/es.json` | Add translation keys |
| 29 | `src/localization/translations/fr.json` | Add translation keys |

**Total: ~29 files** (27 modified + 2 new for form component and CSS)

After translations, run: `node scripts/check-missing-translations.js`

---

## Theming: Light & Dark Mode

The application uses a **dual styling approach** - TypeScript style objects for light mode and CSS files with `html.dark` selectors for dark mode overrides.

### How the Theme System Works

**Theme Context:** `src/context/theme.tsx`
- Manages `theme` state (`'light'` | `'dark'`) and `useSystemTheme` (boolean)
- Persists preference to `localStorage`
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` for OS preferences
- Adds/removes `dark` class on `document.documentElement`
- Exports `ThemeProvider` (wraps app) and `useTheme()` hook

**Tailwind Config:** `tailwind.config.js`
- `darkMode: 'class'` - Tailwind generates dark utilities using `html.dark` selectors (not media queries)

### The Dual Styling Pattern

Every component that needs custom styling beyond basic Tailwind follows this two-file pattern:

#### Light Mode: `.styles.ts` files
TypeScript objects exporting Tailwind class strings. These define all visual styling for light mode.

```typescript
// example-component.styles.ts
const styles = {
  container: "bg-white border-gray-200 text-gray-900",
  title: "text-sm font-semibold text-gray-800",
  icon: "text-gray-500",
};
export default styles;
```

#### Dark Mode: `.css` files
CSS files using `html.dark` selectors to override light mode styles. Use `!important` to override Tailwind utilities.

```css
/* example-component.css */
html.dark .example-container {
  background-color: #1f2937 !important; /* gray-800 */
  border-color: #374151 !important;     /* gray-700 */
  color: #e5e7eb !important;            /* gray-200 */
}

html.dark .example-title {
  color: #f3f4f6 !important; /* gray-100 */
}
```

#### Component Usage
Components import both and apply semantic CSS classes alongside Tailwind classes:

```tsx
import styles from './example-component.styles';
import './example-component.css';

const ExampleComponent = () => (
  <div className={`${styles.container} example-container`}>
    <h3 className={`${styles.title} example-title`}>Title</h3>
  </div>
);
```

The semantic class (e.g., `example-container`) is what the CSS file targets for dark mode overrides. The `.styles.ts` Tailwind classes handle light mode.

### Dark Mode Color Palette

Use these consistent colors across all dark mode CSS:

| Purpose | Tailwind | Hex |
|---------|----------|-----|
| Page/card background | gray-800 | `#1f2937` |
| Elevated/hover background | gray-700 | `#374151` |
| Active/pressed background | gray-600 | `#4b5563` |
| Primary text | gray-200 | `#e5e7eb` |
| Secondary text | gray-300 | `#d1d5db` |
| Muted/label text | gray-400 | `#9ca3af` |
| Borders | gray-600/700 | `#4b5563` / `#374151` |

### Where Dark Mode Styles Live

| Scope | File |
|-------|------|
| Global styles, `form-label`, `form-input` | `app/globals.css` |
| Activity tiles | `src/components/ui/activity-tile/activity-tile.css` |
| Timeline event icons & lines | `src/components/Timeline/timeline-activity-list.css` |
| Daily stats tiles | `src/components/Timeline/TimelineV2/TimelineV2DailyStats.css` |
| Full log timeline | `src/components/FullLogTimeline/full-log-timeline.css` |
| Form page shell | `src/components/ui/form-page/form-page.css` |
| Per-form overrides | `src/components/forms/<Name>Form/<name>-form.css` |

### Adding Dark Mode for a New Activity

When adding a new activity type, you need dark mode styles in these locations:

1. **Timeline event icon** (`timeline-activity-list.css`):
   ```css
   /* Light mode */
   .event-icon.play {
     background: #F3C4A2;
   }
   .event-icon.play svg, .event-icon.play svg path {
     color: #ffffff !important;
     stroke: #ffffff !important;
   }

   /* Dark mode */
   html.dark .event-icon.play {
     background: #F3C4A2 !important;
   }
   html.dark .event-icon.play svg, html.dark .event-icon.play svg path {
     color: #ffffff !important;
     stroke: #ffffff !important;
   }
   ```

2. **Timeline line dot** (`timeline-activity-list.css`):
   ```css
   .timeline-event.play::before {
     background: #F3C4A2 !important;
   }
   ```

3. **Daily stats icon color** (`TimelineV2DailyStats.css`):
   ```css
   html.dark .timeline-v2-daily-stats [class*="text-[#F3C4A2"] {
     color: #F3C4A2 !important;
   }
   ```

4. **Form component** (`activity-form.css`) - if the form has custom inputs, dropdowns, or buttons that need dark overrides:
   ```css
   html.dark .activity-form-input {
     background-color: transparent !important;
     border-color: #374151 !important;
   }
   html.dark .activity-type-button-active {
     background-color: rgba(243, 196, 162, 0.2) !important;
     border-color: #F3C4A2 !important;
     color: #F3C4A2 !important;
   }
   ```

### Key Rules

- **Always use `!important`** in dark mode CSS to override Tailwind utilities
- **Always use hex colors**, not Tailwind class names, in CSS files
- **Activity-specific colors** (icon colors, stat tile colors) should be **preserved** in dark mode - they provide visual identity
- **Background, text, and border** colors should shift to the dark palette
- **Add comments** with the Tailwind color name (e.g., `/* gray-700 */`) for maintainability
- The `form-label` class is globally defined in `app/globals.css` and overridden for dark mode in `src/components/ui/form-page/form-page.css` - forms using `FormPage` get this for free
