# Localization System

## Overview

The localization system provides multi-language support for the Sprout Track application. It allows users to view the interface in their preferred language, with preferences stored at both the account and caretaker levels. The system uses a JSON-based translation file structure and provides a React context for easy access to translations throughout the application.

## Architecture

The localization system consists of several components:

1. **Translation Files**: JSON files containing translations for all supported languages
2. **Localization Context**: React context that manages language state and provides translation functions
3. **API Endpoint**: Backend API for storing and retrieving user language preferences
4. **Database Storage**: Language preferences stored in `Account` and `Caretaker` tables

### How It Works

1. The `LocalizationProvider` wraps the application and manages the current language state
2. On mount, it attempts to fetch the user's language preference from the API (if authenticated)
3. If the API call fails or the user is not authenticated, it falls back to `localStorage`
4. Components use the `useLocalization` hook to access translations via the `t()` function
5. When a user changes their language, the preference is saved to both the database (via API) and `localStorage`

## Translation File Structure

Translations are stored in **per-language JSON files** under `src/localization/translations/`.

- `en.json`: English (also acts as the fallback)
- `es.json`: Spanish
- `fr.json`: French
- Supported languages are configured in `src/localization/supported-languages.json`.

Each file is a flat map of **translation key → translated string**. Translation keys match their English text exactly.

```json
{
  "Welcome": "Welcome",
  "Log Entry": "Log Entry"
}
```

### Key Naming Conventions

- Translation keys **match their English text exactly** (including capitalization and spacing).
- Example: `t('Log Entry')` displays `"Log Entry"` in English.

## Adding New Translations

To add a new translation:

1. Open `/src/localization/translations/en.json` (and optionally `es.json` / `fr.json`)
2. Add a new key with translations for all supported languages:

```json
{
  "English text": "English text"
}
```

And in `es.json` / `fr.json`:

```json
{
  "English text": "Texto en español"
}
```

3. Use the key in your component:

```typescript
import { useLocalization } from '@/src/context/localization';

function MyComponent() {
  const { t } = useLocalization();
  return <div>{t('English text')}</div>;
}
```

## Adding New Languages

To add support for a new language:

1. Determine the ISO 639-1 language code (e.g., "de" for German, "it" for Italian)
2. Add a new language file in `src/localization/translations/` (e.g., `de.json`) and add keys/values there:

```json
{
  "Welcome": "Willkommen"
}
```

3. The system will automatically support the new language once translations are added
4. Users can select the new language through the language switcher (when implemented)

## Using Translations in Components

### Basic Usage

```typescript
import { useLocalization } from '@/src/context/localization';

function MyComponent() {
  const { t, language } = useLocalization();
  
  return (
    <div>
      <h1>{t('Welcome')}</h1>
      <button>{t('Save')}</button>
      <p>Current language: {language}</p>
    </div>
  );
}
```

### Changing Language

```typescript
import { useLocalization } from '@/src/context/localization';

function LanguageSwitcher() {
  const { language, setLanguage } = useLocalization();
  
  const handleLanguageChange = async (newLang: string) => {
    await setLanguage(newLang);
    // Language is automatically saved to database and localStorage
  };
  
  return (
    <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  );
}
```

### Loading State

```typescript
import { useLocalization } from '@/src/context/localization';

function MyComponent() {
  const { t, isLoading } = useLocalization();
  
  if (isLoading) {
    return <div>{t('Loading')}...</div>;
  }
  
  return <div>{t('Welcome')}</div>;
}
```

## Language Preference Storage

The system stores language preferences at different levels based on authentication type:

### Account-Based Authentication

- **Storage**: `Account.language` field in the database
- **Scope**: Applies to all devices where the user is logged in with their account
- **Persistence**: Persists across sessions and devices
- **API**: Uses `accountId` from JWT token to fetch/update preference

### Caretaker-Based Authentication (PIN)

- **Storage**: `Caretaker.language` field in the database
- **Scope**: Applies to the specific caretaker profile
- **Persistence**: Persists across sessions for that caretaker
- **API**: Uses `caretakerId` from auth context to fetch/update preference

### Unauthenticated Users

- **Storage**: `localStorage` only
- **Scope**: Per-device, per-browser
- **Persistence**: Lost if browser data is cleared
- **Fallback**: When user authenticates, preference can be migrated to database

## API Endpoints

### GET /api/localization

Retrieves the current user's language preference.

**Authentication**: Required (via JWT token)

**Response**:
```json
{
  "success": true,
  "data": {
    "language": "en"
  }
}
```

**Behavior**:
- Automatically determines if user is account-based or caretaker-based
- Returns language from appropriate database table
- Defaults to "en" if no preference is set

### PUT /api/localization

Updates the current user's language preference.

**Authentication**: Required (via JWT token)

**Request Body**:
```json
{
  "language": "es"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "language": "es"
  }
}
```

**Validation**:
- Language code must be a valid ISO 639-1 code (2 characters)
- Checks write permissions for expired accounts
- Updates appropriate record (Account or Caretaker) based on auth type

**Error Response**:
```json
{
  "success": false,
  "error": "Invalid language code"
}
```

## Best Practices

1. **Always use translation keys**: Never hardcode user-facing strings in components
2. **Provide English fallback**: Always include "en" translation for every key
3. **Use descriptive keys**: Choose keys that clearly indicate their purpose
4. **Group related translations**: Use consistent prefixes for related strings
5. **Test all languages**: Verify translations display correctly in all supported languages
6. **Handle missing translations**: The system falls back to English, but ensure all keys have translations
7. **Keep translations concise**: UI space is limited; keep translations brief
8. **Consider context**: Some words may need different translations based on context (consider adding context-specific keys)

## Troubleshooting

### Translation key not found

**Symptom**: Component displays the English text (the key) instead of the translated text for the selected language.

**Solution**: 
- Check that the key exists in `src/localization/translations/en.json`
- Verify the key name matches exactly (case-sensitive)
- Check that the selected language has a non-empty translation value for that key
- Check browser console for warnings about missing keys

### Language preference not persisting

**Symptom**: Language resets to default after page refresh

**Solution**:
- Check that user is authenticated (API requires authentication)
- Verify API endpoint is working (check network tab)
- Check browser console for API errors
- Verify database has language field populated

### API returns 401 Unauthorized

**Symptom**: Language preference not loading from API

**Solution**:
- Verify JWT token is present in localStorage
- Check that token is not expired
- Ensure user is properly authenticated
- System will fallback to localStorage if API fails

### Translations not updating

**Symptom**: Changing language doesn't update displayed text

**Solution**:
- Verify component is using `useLocalization` hook
- Check that `t()` function is being called with correct key
- Ensure component re-renders when language changes
- Check that translation file has the key for the selected language

## Future Enhancements

- Language switcher UI component
- Support for language variants (e.g., en-US, en-GB)
- Pluralization support
- Date/time formatting based on language
- Number formatting based on locale
- Split translation files by feature/page for better organization
- Translation management interface for non-developers
