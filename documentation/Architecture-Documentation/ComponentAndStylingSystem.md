# Component and Styling System

## Overview

Sprout Track's UI is built from 34 base UI primitives in `src/components/ui/`, composed into feature components and forms. Styling uses TailwindCSS with Class Variance Authority (CVA) for light mode variants and plain CSS with `html.dark` selectors for dark mode. This dual-file approach is intentional and must not be replaced with Tailwind's `dark:` classes.

## Component File Structure

Each UI component follows a standardized folder structure:

```
src/components/ui/button/
├── index.tsx              # Component implementation
├── button.styles.ts       # CVA variant definitions (light mode, Tailwind classes)
├── button.css             # Dark mode overrides (html.dark selectors)
├── button.types.ts        # TypeScript interfaces
└── README.md              # Props documentation and usage examples
```

### `index.tsx` — Component Implementation
Imports CVA variants from styles, applies dark mode CSS classes alongside CVA classes:

```typescript
import { buttonVariants } from './button.styles';
import './button.css';

const Button = ({ variant, size, className, ...props }) => {
  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        'button-dark-' + variant,  // Dark mode class hook
        className
      )}
      {...props}
    />
  );
};
```

### `*.styles.ts` — CVA Variant Definitions
Defines light mode styles using Tailwind utility classes:

```typescript
import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        success: 'bg-green-600 text-white hover:bg-green-700',
        info: 'bg-blue-600 text-white hover:bg-blue-700',
        warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        xl: 'h-12 rounded-md px-10 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

### `*.css` — Dark Mode Overrides
Uses `html.dark` CSS selectors to override light mode styles:

```css
html.dark .button-dark-default {
  background-color: #3b82f6;
  color: #ffffff;
}

html.dark .button-dark-outline {
  border-color: #4b5563;
  color: #d1d5db;
  background-color: transparent;
}

html.dark .button-dark-ghost {
  color: #d1d5db;
}

html.dark .button-dark-ghost:hover {
  background-color: #374151;
}
```

### Why NOT Tailwind `dark:` Classes

Tailwind's `dark:` utility classes respond to the **operating system's** color scheme preference (`prefers-color-scheme`). Sprout Track has an **in-app theme toggle** controlled by `ThemeProvider`, which adds/removes the `dark` class on the `<html>` element.

If `dark:` classes were used, the theme toggle would not work — the OS preference would override the user's in-app choice. The `html.dark .class-name` CSS approach ensures the toggle works correctly regardless of system settings.

**Tailwind config confirms this:**
```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',  // Class-based dark mode
  // ...
};
```

## UI Primitive Inventory

34 components in `src/components/ui/`:

| Component | Purpose |
|-----------|---------|
| `accordion` | Collapsible content sections |
| `account-button` | Account access button |
| `account-expiration-banner` | Subscription expiration notice |
| `activity-tile` | Activity indicator tile (with timer) |
| `badge` | Status/label badge |
| `button` | Primary button (9 variants, 5 sizes) |
| `calendar` | Monthly calendar grid |
| `card` | Content card container |
| `checkbox` | Checkbox input |
| `date-time-picker` | Date/time selection |
| `dialog` | Dialog/modal (Radix UI based) |
| `dropdown-menu` | Dropdown menu (Radix UI based) |
| `dynamic-title.tsx` | Dynamic page title |
| `extended-time-input` | Enhanced time input |
| `form-page` | Full-screen form container with tabs |
| `input` | Text input |
| `input-button` | Input with integrated button |
| `label` | Form label |
| `mobile-menu` | Mobile navigation hamburger menu |
| `modal` | Modal overlay (Radix UI based) |
| `no-baby-selected` | Empty state when no baby selected |
| `popover` | Popover container (Radix UI based) |
| `progress` | Progress bar |
| `select` | Select dropdown |
| `share-button` | Content sharing button |
| `side-nav` | Side navigation panel |
| `status-bubble` | Status indicator bubble |
| `switch` | Toggle switch |
| `table` | Data table with sorting |
| `textarea` | Multi-line text input |
| `theme-toggle` | Light/dark mode toggle |
| `time-entry` | Time entry with AM/PM |
| `time-input` | Simple time input |
| `toast` | Toast notification system |

## Feature Components

Feature components live at the root of `src/components/` in named folders. They compose UI primitives and handle data fetching (container/presentational pattern).

| Component | Purpose |
|-----------|---------|
| `Calendar/` | Monthly calendar view with activity indicators |
| `CalendarDayView/` | Day view for calendar |
| `Timeline/` | Activity timeline with filtering and pagination |
| `FullLogTimeline/` | Complete activity timeline |
| `Reports/` | Reporting interface with growth charts |
| `DailyStats/` | Daily statistics dashboard |
| `BabySelector/` | Baby selection dropdown |
| `SetupWizard/` | 3-step family setup (Family → Security → Baby) |
| `ActiveFeedBanner/` | Shows active breastfeeding session |
| `BackupRestore/` | Database backup and restore |
| `GuardianUpdate/` | Guardian update section |
| `LoginSecurity/` | Login security settings |
| `account-manager/` | Account management components |
| `familymanager/` | System admin family management |
| `features/nursery-mode/` | Nursery mode for tablets |

## Form Components

Forms live in `src/components/forms/`, one folder per activity type. They use standard React state management (`useState`, `useEffect`), not React Hook Form.

**Pattern:**
- Each form receives baby data and callbacks via props
- Form state managed with `useState`
- Validation handled inline or with utility functions
- Submit handler calls API via `authenticatedFetch`
- Loading and error states displayed via UI primitives

**Available forms:**
ActivityForm, AppConfigForm, BabyForm, BabyQuickStats, BathForm, CalendarEventForm, CaretakerForm, ContactForm, DiaperForm, FamilyForm, FeedForm, FeedbackForm, GiveMedicineForm, MeasurementForm, MedicineForm, MilestoneForm, NoteForm, PumpForm, SettingsForm, SleepForm, VaccineForm

## Container/Presentational Pattern

Pages act as containers that fetch data and pass it to presentational components:

```
app/(app)/[slug]/page.tsx          ← Container: fetches data, manages state
  └── src/components/DailyStats/   ← Presentational: renders UI from props
        └── src/components/ui/     ← Primitives: pure UI elements
```

## Responsive Design

- Tailwind breakpoints for responsive layouts
- Mobile-first approach
- `mobile-menu` component for mobile navigation
- `side-nav` for desktop navigation
- Nursery mode optimized for tablet screens

## Key Files

- `src/components/ui/button/` — Canonical example of the component pattern
- `src/components/ui/form-page/` — Form layout wrapper used by all form components
- `src/components/ui/toast/` — Toast notification system
- `src/context/theme.tsx` — ThemeProvider that controls `html.dark` class
- `tailwind.config.js` — Tailwind configuration with `darkMode: 'class'`
