# Extract Localization Strings Script

This script automatically scans your components and pages for hardcoded strings, adds them to the per-language translation files under `src/localization/translations/`, and replaces them with `t()` calls.

## Usage

```bash
# Scan all files and update translation files and source files
node scripts/extract-localization-strings.js

# Dry run - see what would be changed without making changes
# Creates a detailed log file: localization-extraction-log.txt
node scripts/extract-localization-strings.js --dry-run

# Scan a specific file or directory
node scripts/extract-localization-strings.js --path=src/components/MyComponent.tsx
```

## What It Does

1. **Scans** all `.ts` and `.tsx` files in `src/` and `app/` directories
2. **Extracts** hardcoded strings that look like user-facing text:
   - JSX text content (text between tags)
3. **Adds** new strings to per-language translation files:
   - `src/localization/translations/en.json` (English)
   - `src/localization/translations/es.json` (Spanish)
   - `src/localization/translations/fr.json` (French)
   
   New keys are added to **all** language files:
   - English gets the key text as its value
   - Other languages get a blank value (`""`) to be filled in later
4. **Replaces** hardcoded strings in source files with `t('Text')` calls
5. **Adds** `useLocalization` import and hook call if needed

## Dry Run Mode

When using `--dry-run`, the script creates a detailed log file (`localization-extraction-log.txt`) that includes:

- **Summary**: Total new strings, files scanned, files with changes
- **New Translations**: List of all keys that would be added to language files
- **File Changes**: For each file, shows:
  - File path
  - Line number for each string found
  - Type of string (jsx-text)
  - Original code
  - String that would be extracted
  - What it would become (the `t()` call)

This allows you to review exactly what would change before running the script for real.

## What It Skips

The script intelligently skips:
- URLs and file paths
- Already translated strings (already in `t()` calls)
- Very short strings (< 2 characters)
- Very long strings (> 200 characters, likely code blocks)
- Code-like identifiers (camelCase, snake_case, kebab-case)

## Examples

### Before
```tsx
function MyComponent() {
  return (
    <div>
      <h1>Welcome</h1>
      <button>Save</button>
    </div>
  );
}
```

### After
```tsx
import { useLocalization } from '@/src/context/localization';

function MyComponent() {
  const { t } = useLocalization();
  return (
    <div>
      <h1>{t('Welcome')}</h1>
      <button>{t('Save')}</button>
    </div>
  );
}
```

## Translation File Updates

New strings are added to `src/localization/translations/en.json` (and mirrored as blank keys in other language files):

```json
{
  "Welcome": "Welcome",
  "Save": "Save"
}
```

## Notes

- **Always review changes** before committing - the script tries to be smart but may need manual adjustments
- **Test your code** after running the script to ensure everything still works
- **Fill in translations** for Spanish and French after the script runs
- The script preserves existing translations - it only adds new ones
- Use `--dry-run` first to see what would change

## Troubleshooting

**Issue**: Script replaces strings that shouldn't be translated
- **Solution**: Manually revert those changes and add those strings to the skip list in the script

**Issue**: Script doesn't find all strings
- **Solution**: Some strings may need manual extraction (especially in complex expressions)

**Issue**: Import statement added in wrong place
- **Solution**: Manually move the import to the correct location
