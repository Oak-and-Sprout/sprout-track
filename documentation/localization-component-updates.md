# Localization System - Component Updates Documentation

## Purpose

This document tracks the migration of hardcoded user-facing strings to the localization system. The localization system allows Sprout Track to support multiple languages, with user preferences stored at both the account and caretaker levels in the database. This enables users to view the interface in their preferred language (English, Spanish, French, or future languages).

The goal is to systematically replace all hardcoded strings in components and pages with calls to the `t()` function from the `useLocalization` hook, ensuring all user-facing text can be translated.

## Critical Files and Their Roles

### Core Localization System Files

#### `/src/context/localization.tsx`
**Purpose**: React context provider that manages language state and provides translation functionality throughout the application.

**Key Features**:
- Manages current language preference (defaults to 'en')
- Fetches language preference from API for authenticated users
- Falls back to localStorage for unauthenticated users
- Handles system administrator language preferences via sessionStorage
- Lazy-loads translation files for non-English languages
- Provides `t(key: string)` function for translations
- Provides `setLanguage(lang: string)` to change language preference

**Exports**:
- `LocalizationProvider` - Context provider component
- `useLocalization` - Hook to access localization context

#### `/src/localization/translations/en.json`
**Purpose**: English translation file (also serves as the fallback language).

**Structure**: Flat JSON object where keys match the English display text exactly.
```json
{
  "Welcome": "Welcome",
  "Log Entry": "Log Entry"
}
```

#### `/src/localization/translations/es.json`
**Purpose**: Spanish translation file.

**Structure**: Same keys as `en.json`, with Spanish translations as values. Empty strings (`""`) indicate missing translations.

#### `/src/localization/translations/fr.json`
**Purpose**: French translation file.

**Structure**: Same keys as `en.json`, with French translations as values. Empty strings (`""`) indicate missing translations.

#### `/src/localization/supported-languages.json`
**Purpose**: Configuration file that lists all supported language codes (ISO 639-1).

**Structure**: JSON array of language codes.
```json
["en", "es", "fr"]
```

**Usage**: The localization context reads this file to determine which languages are available and which translation files to load.

#### `/src/localization/README.md`
**Purpose**: Comprehensive documentation for the localization system, including:
- Architecture overview
- How to add new translations
- How to add new languages
- Component usage examples
- API endpoint documentation
- Best practices
- Troubleshooting guide

### Backend Files

#### `/app/api/localization/route.ts`
**Purpose**: API endpoint for managing user language preferences.

**Endpoints**:
- `GET /api/localization` - Retrieves current user's language preference
  - Returns language from `Account` table for account-based auth
  - Returns language from `Caretaker` table for caretaker-based auth
  - Returns default 'en' for unauthenticated users
  - System administrators use sessionStorage (client-side only)

- `PUT /api/localization` - Updates current user's language preference
  - Validates language code (ISO 639-1 format)
  - Updates appropriate database record based on auth type
  - System administrators use sessionStorage (client-side only)
  - Note: Language preference changes are allowed regardless of subscription status

**Authentication**: Required via `withAuthContext` wrapper.

### Database Files

#### `/prisma/schema.prisma`
**Purpose**: Database schema definition.

**Localization Fields**:
- `Account.language` - String? field with default "en" for account-based users
- `Caretaker.language` - String? field with default "en" for caretaker-based users

#### `/prisma/migrations/20260109151313_add_localization_fields/migration.sql`
**Purpose**: Database migration that adds language fields to Account and Caretaker tables.

**Actions**:
- Adds `language` column to `Account` table (default 'en')
- Adds `language` column to `Caretaker` table (default 'en')
- Updates existing records to have 'en' as default language

### UI Components

#### `/src/components/ui/side-nav/language-selector.tsx`
**Purpose**: Language switcher component that allows users to change their preferred language.

**Features**:
- Dropdown menu displaying current language code (e.g., "EN", "ES", "FR")
- Lists all supported languages with their native names
- Updates language preference via `setLanguage()` function
- Uses `useLocalization` hook to access current language and translation function
- Accessible with proper ARIA labels

**Usage**: Can be added to navigation, settings, or account pages to allow users to switch languages.

**Status**: ✅ Component exists and is ready to use

### Automation Scripts

#### `/scripts/extract-localization-strings.js`
**Purpose**: Automated script to extract hardcoded strings from components and pages.

**Features**:
- Scans all `.ts` and `.tsx` files in `src/` and `app/` directories
- Uses TypeScript AST to accurately identify JSX text content
- Extracts user-facing strings (skips code, URLs, comments, etc.)
- Adds new strings to all language files (`en.json`, `es.json`, `fr.json`)
- Replaces hardcoded strings with `t('Text')` calls
- Automatically adds `useLocalization` import and hook when needed
- Creates detailed log file in dry-run mode

**Usage**:
```bash
# Dry run (preview changes)
node scripts/extract-localization-strings.js --dry-run

# Actually make changes
node scripts/extract-localization-strings.js

# Target specific file/directory
node scripts/extract-localization-strings.js --path=src/components/MyComponent.tsx
```

#### `/scripts/extract-localization-strings-README.md`
**Purpose**: Documentation for the extraction script, including usage examples, what it skips, and troubleshooting.

### Layout Files (Provider Setup)

The following layout files include `LocalizationProvider` to ensure localization is available throughout the app:

- `/app/layout.tsx` - Root layout
- `/app/(app)/[slug]/layout.tsx` - Main app layout
- `/app/(auth)/layout.tsx` - Authentication layout
- `/app/home/layout.tsx` - Home page layout
- `/app/account/layout.tsx` - Account layout
- `/app/account/family-setup/layout.tsx` - Account family setup layout
- `/app/family-select/layout.tsx` - Family selection layout
- `/app/family-manager/layout.tsx` - Family manager layout
- `/app/family-manager/login/layout.tsx` - Family manager login layout

**Status**: ✅ All layout files have been updated to include `LocalizationProvider`

## Migration Checklist

### Phase 1: Core System Setup ✅ COMPLETE
- [x] Create localization context (`/src/context/localization.tsx`)
- [x] Create translation file structure (`/src/localization/translations/`)
- [x] Create supported languages configuration (`/src/localization/supported-languages.json`)
- [x] Create localization README (`/src/localization/README.md`)
- [x] Update database schema (add `language` fields to Account and Caretaker)
- [x] Create database migration
- [x] Create API endpoint (`/app/api/localization/route.ts`)
- [x] Add LocalizationProvider to all layout files
- [x] Create extraction script (`/scripts/extract-localization-strings.js`)
- [x] Create extraction script documentation

### Phase 2: Component Migration (In Progress)

The following files contain hardcoded strings that need to be migrated to use the localization system. Numbers in parentheses indicate approximate number of strings found.

#### App Pages
- [ ] `app/(app)/[slug]/calendar/page.tsx` (10 strings)
- [ ] `app/(app)/[slug]/full-log/page.tsx` (10 strings)
- [ ] `app/(app)/[slug]/layout.tsx` (1 string)
- [ ] `app/(app)/[slug]/log-entry/page.tsx` (13 strings)
- [ ] `app/(app)/[slug]/page.tsx` (3 strings)
- [ ] `app/(app)/[slug]/reports/page.tsx` (1 string)
- [ ] `app/(auth)/login/page.tsx` (8 strings)
- [ ] `app/account/family-setup/page.tsx` (37 strings)
- [ ] `app/account/payment-cancelled/page.tsx` (6 strings)
- [ ] `app/account/payment-success/page.tsx` (10 strings)
- [ ] `app/family-manager/layout.tsx` (3 strings)
- [ ] `app/family-manager/login/page.tsx` (5 strings)
- [ ] `app/family-manager/page.tsx` (7 strings)
- [ ] `app/family-select/page.tsx` (6 strings)
- [ ] `app/home/page.tsx` (68 strings)
- [ ] `app/page.tsx` (1 string)
- [ ] `app/setup/[token]/page.tsx` (3 strings)
- [ ] `app/setup/page.tsx` (1 string)

#### Component Files
- [ ] `src/components/account-manager/AccountSettingsTab.tsx` (73 strings)
- [ ] `src/components/account-manager/FamilyPeopleTab.tsx` (24 strings)
- [ ] `src/components/account-manager/index.tsx` (7 strings)
- [ ] `src/components/account-manager/PaymentHistory.tsx` (10 strings)
- [ ] `src/components/account-manager/PaymentModal.tsx` (18 strings)
- [ ] `src/components/BabyQuickInfo/ContactsTab.tsx` (2 strings)
- [ ] `src/components/BabyQuickInfo/index.tsx` (5 strings)
- [ ] `src/components/BabyQuickInfo/NotificationsTab.tsx` (15 strings)
- [ ] `src/components/BabyQuickInfo/StatsTab.tsx` (5 strings)
- [ ] `src/components/BackupRestore/AdminPasswordResetModal.tsx` (8 strings)
- [ ] `src/components/BackupRestore/index.tsx` (1 string)
- [ ] `src/components/Calendar/index.tsx` (1 string)
- [ ] `src/components/CalendarDayView/index.tsx` (6 strings)
- [ ] `src/components/CalendarEvent/index.tsx` (3 strings)
- [ ] `src/components/DailyStats/index.tsx` (3 strings)
- [ ] `src/components/debugSessionTimer/index.tsx` (5 strings)
- [ ] `src/components/debugTimezone/index.tsx` (17 strings)
- [ ] `src/components/ExpiredAccountMessage/index.tsx` (4 strings)
- [ ] `src/components/familymanager/AccountView.tsx` (9 strings)
- [ ] `src/components/familymanager/ActiveInviteView.tsx` (12 strings)
- [ ] `src/components/familymanager/BetaSubscriberView.tsx` (6 strings)
- [ ] `src/components/familymanager/FamilyView.tsx` (9 strings)
- [ ] `src/components/familymanager/FeedbackThreadModal/index.tsx` (12 strings)
- [ ] `src/components/familymanager/FeedbackView.tsx` (8 strings)
- [ ] `src/components/forms/AppConfigForm/index.tsx` (35 strings)
- [ ] `src/components/forms/BabyForm/BabyForm.tsx` (10 strings)
- [ ] `src/components/forms/BabyQuickStats/index.tsx` (7 strings)
- [ ] `src/components/forms/BathForm/index.tsx` (6 strings)
- [ ] `src/components/forms/CalendarEventForm/ContactSelector.tsx` (1 string)
- [ ] `src/components/forms/CalendarEventForm/index.tsx` (19 strings)
- [ ] `src/components/forms/CalendarEventForm/RecurrenceSelector.tsx` (4 strings)
- [ ] `src/components/forms/CaretakerForm/CaretakerForm.tsx` (14 strings)
- [ ] `src/components/forms/ContactForm/index.tsx` (7 strings)
- [ ] `src/components/forms/DiaperForm/index.tsx` (17 strings)
- [ ] `src/components/forms/FamilyForm/index.tsx` (48 strings)
- [ ] `src/components/forms/FeedbackForm/FeedbackMessagesView.tsx` (2 strings)
- [ ] `src/components/forms/FeedbackForm/FeedbackPage.tsx` (2 strings)
- [ ] `src/components/forms/FeedbackForm/index.tsx` (9 strings)
- [ ] `src/components/forms/FeedForm/BottleFeedForm.tsx` (3 strings)
- [ ] `src/components/forms/FeedForm/BreastFeedForm.tsx` (6 strings)
- [ ] `src/components/forms/FeedForm/index.tsx` (5 strings)
- [ ] `src/components/forms/FeedForm/SolidsFeedForm.tsx` (3 strings)
- [ ] `src/components/forms/GiveMedicineForm/index.tsx` (8 strings)
- [ ] `src/components/forms/MeasurementForm/index.tsx` (9 strings)
- [ ] `src/components/forms/MedicineForm/ActiveDosesTab.tsx` (8 strings)
- [ ] `src/components/forms/MedicineForm/ContactSelector.tsx` (1 string)
- [ ] `src/components/forms/MedicineForm/GiveMedicineTab.tsx` (6 strings)
- [ ] `src/components/forms/MedicineForm/index.tsx` (1 string)
- [ ] `src/components/forms/MedicineForm/ManageMedicinesTab.tsx` (7 strings)
- [ ] `src/components/forms/MedicineForm/MedicineForm.tsx` (11 strings)
- [ ] `src/components/forms/MilestoneForm/index.tsx` (10 strings)
- [ ] `src/components/forms/NoteForm/index.tsx` (6 strings)
- [ ] `src/components/forms/PumpForm/index.tsx` (8 strings)
- [ ] `src/components/forms/SettingsForm/index.tsx` (37 strings)
- [ ] `src/components/forms/SleepForm/index.tsx` (12 strings)
- [ ] `src/components/FullLogTimeline/FullLogActivityDetails.tsx` (3 strings)
- [ ] `src/components/FullLogTimeline/FullLogActivityList.tsx` (8 strings)
- [ ] `src/components/FullLogTimeline/FullLogFilter.tsx` (4 strings)
- [ ] `src/components/LoginSecurity/AccountLogin.tsx` (6 strings)
- [ ] `src/components/LoginSecurity/PinLogin.tsx` (6 strings)
- [ ] `src/components/modals/AccountModal/index.tsx` (43 strings)
- [ ] `src/components/modals/BabyModal.tsx` (10 strings)
- [ ] `src/components/modals/CaretakerModal.tsx` (12 strings)
- [ ] `src/components/modals/changelog/index.tsx` (4 strings)
- [ ] `src/components/modals/ChangePinModal.tsx` (5 strings)
- [ ] `src/components/modals/DiaperModal.tsx` (15 strings)
- [ ] `src/components/modals/FeedModal.tsx` (14 strings)
- [ ] `src/components/modals/NoteModal.tsx` (4 strings)
- [ ] `src/components/modals/privacy-policy/index.tsx` (4 strings)
- [ ] `src/components/modals/SettingsModal.tsx` (11 strings)
- [ ] `src/components/modals/SleepModal.tsx` (16 strings)
- [ ] `src/components/modals/terms-of-use/index.tsx` (4 strings)
- [ ] `src/components/Reports/ActivityTab.tsx` (4 strings)
- [ ] `src/components/Reports/BathChartModal.tsx` (3 strings)
- [ ] `src/components/Reports/BathStatsSection.tsx` (4 strings)
- [ ] `src/components/Reports/DiaperChartModal.tsx` (2 strings)
- [ ] `src/components/Reports/DiaperStatsSection.tsx` (3 strings)
- [ ] `src/components/Reports/FeedingChartModal.tsx` (3 strings)
- [ ] `src/components/Reports/FeedingStatsSection.tsx` (6 strings)
- [ ] `src/components/Reports/GrowthChart.tsx` (12 strings)
- [ ] `src/components/Reports/HeatmapsTab.tsx` (5 strings)
- [ ] `src/components/Reports/index.tsx` (4 strings)
- [ ] `src/components/Reports/MilestonesTab.tsx` (3 strings)
- [ ] `src/components/Reports/PumpingChartModal.tsx` (3 strings)
- [ ] `src/components/Reports/PumpingStatsSection.tsx` (6 strings)
- [ ] `src/components/Reports/SleepChartModal.tsx` (1 string)
- [ ] `src/components/Reports/SleepLocationChartModal.tsx` (1 string)
- [ ] `src/components/Reports/SleepLocationsChartModal.tsx` (1 string)
- [ ] `src/components/Reports/SleepStatsSection.tsx` (9 strings)
- [ ] `src/components/Reports/StatsTab.tsx` (2 strings)
- [ ] `src/components/Reports/TemperatureStatsSection.tsx` (4 strings)
- [ ] `src/components/SetupWizard/BabySetupStage.tsx` (13 strings)
- [ ] `src/components/SetupWizard/FamilySetupStage.tsx` (6 strings)
- [ ] `src/components/SetupWizard/index.tsx` (3 strings)
- [ ] `src/components/SetupWizard/SecuritySetupStage.tsx` (11 strings)
- [ ] `src/components/Timeline/TimelineActivityDetails.tsx` (3 strings)
- [ ] `src/components/Timeline/TimelineActivityList.tsx` (3 strings)
- [ ] `src/components/Timeline/TimelineFilter.tsx` (1 string)
- [ ] `src/components/Timeline/TimelineV2/TimelineV2ActivityList.tsx` (3 strings)
- [ ] `src/components/Timeline/TimelineV2/TimelineV2DailyStats.tsx` (7 strings)
- [ ] `src/components/ui/account-button/index.tsx` (10 strings)
- [ ] `src/components/ui/account-expiration-banner/index.tsx` (3 strings)
- [ ] `src/components/ui/calendar/index.tsx` (2 strings)
- [ ] `src/components/ui/dialog/index.tsx` (1 string)
- [ ] `src/components/ui/input-button/index.tsx` (1 string)
- [ ] `src/components/ui/share-button/index.tsx` (1 string)
- [ ] `src/components/ui/side-nav/index.tsx` (6 strings)
- [ ] `src/components/ui/table/index.tsx` (2 strings)
- [ ] `src/components/ui/theme-toggle/index.tsx` (1 string)
- [ ] `src/components/ui/time-entry/index.tsx` (2 strings)

### Phase 3: Translation Completion
- [ ] Fill in Spanish translations (`es.json`)
- [ ] Fill in French translations (`fr.json`)
- [ ] Review and verify all translations for accuracy
- [ ] Test language switching functionality
- [ ] Verify translations display correctly in all supported languages

### Phase 4: Language Switcher UI Integration
- [x] Create language switcher component (`/src/components/ui/side-nav/language-selector.tsx`)
- [ ] Add language switcher to settings/account pages
- [ ] Add language switcher to side navigation (if appropriate)
- [ ] Test language switching across all pages

## Migration Process

### Using the Extraction Script

1. **Preview Changes** (Recommended first step):
   ```bash
   node scripts/extract-localization-strings.js --dry-run
   ```
   This creates `localization-extraction-log.txt` with detailed information about what would change.

2. **Review the Log File**:
   - Check `localization-extraction-log.txt` for:
     - Files that would be modified
     - Line numbers and context for each string
     - New translation keys that would be added

3. **Run the Script**:
   ```bash
   node scripts/extract-localization-strings.js
   ```
   This will:
   - Add new strings to all language files
   - Replace hardcoded strings with `t()` calls
   - Add `useLocalization` imports where needed

4. **Manual Review**:
   - Review the changes in your version control system
   - Test the modified components to ensure they still work
   - Fill in translations for Spanish and French

### Manual Migration Process

For files that need manual attention or fine-tuning:

1. **Add Translation Keys**:
   - Open `/src/localization/translations/en.json`
   - Add the English text as both key and value: `"Your Text": "Your Text"`
   - Add the same key to `es.json` and `fr.json` with empty strings: `"Your Text": ""`

2. **Update Component**:
   ```tsx
   // Before
   import { useLocalization } from '@/src/context/localization';
   
   function MyComponent() {
     return <div>Welcome</div>;
   }
   
   // After
   import { useLocalization } from '@/src/context/localization';
   
   function MyComponent() {
     const { t } = useLocalization();
     return <div>{t('Welcome')}</div>;
   }
   ```

3. **Test**:
   - Verify the component renders correctly
   - Test language switching if available
   - Check browser console for missing translation warnings

## Notes

- Translation keys **must match the English text exactly** (including capitalization and spacing)
- Always add keys to all language files, even if translations are empty
- Use the extraction script for bulk migrations, but review changes carefully
- Some strings may need manual adjustment (e.g., dynamic content, pluralization)
- System administrators use sessionStorage for language preference (not stored in database)
- Language preference changes are allowed regardless of subscription status

## Related Documentation

- `/src/localization/README.md` - Comprehensive localization system documentation
- `/scripts/extract-localization-strings-README.md` - Extraction script documentation
- `/CLAUDE.md` - Development rules including localization guidelines
- `/.cursorrules` - Development rules including localization guidelines
