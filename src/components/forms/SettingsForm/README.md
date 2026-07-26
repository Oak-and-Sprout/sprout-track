# Form Components

This directory contains form implementations that use the FormPage component.

## SettingsForm

The SettingsForm component is a full-screen form that allows users to configure application settings. It includes:

- **Family Management**: Edit family name and URL slug with validation
- **Security Configuration**: Security PIN management
- **Database Management**: Database backup and restore functionality  
- **Baby Management**: Add, edit, and select babies
- **Caretaker Management**: Add and edit caretakers
- **Contact Management**: Add and edit contacts
- **Units Configuration**: Set default units for measurements
- **Debug Settings**: Toggle debug features

### Usage

```tsx
import SettingsForm from '@/src/components/forms/SettingsForm';
import { useFamily } from '@/src/context/family'; // Import family context

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const { family } = useFamily(); // Get current family from context
  
  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Open Settings
      </Button>
      
      <SettingsForm
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onBabySelect={(id: string) => {
          // Handle baby selection
        }}
        onBabyStatusChange={() => {
          // Refresh babies list
        }}
        selectedBabyId={selectedBabyId}
        familyId={family?.id} // Pass the current family ID
      />
    </>
  );
}
```

## Family Information Management

The SettingsForm now includes comprehensive family management capabilities:

### Family Name Editing
- **View Mode**: Displays current family name in a disabled input field
- **Edit Mode**: Allows editing with inline Save/Cancel buttons
- **Validation**: Ensures family name is not empty before saving

### Family Slug/URL Editing
- **View Mode**: Shows current slug in a disabled input with ShareButton
- **Edit Mode**: Provides real-time validation with the following features:
  - **Uniqueness Check**: Validates slug uniqueness across all families
  - **Debounced Validation**: Checks uniqueness 500ms after typing stops
  - **Visual Feedback**: Shows loading spinner during validation
  - **Error Display**: Clear error messages for duplicate slugs
  - **ShareButton Integration**: Easily share family login URL

### API Integration
The form uses the following endpoints:
- `GET /api/family` - Fetch current family data
- `PUT /api/family` - Update family name and slug
- `GET /api/family/by-slug/[slug]` - Check slug availability
- `GET /api/app-config/public` - Get app configuration for ShareButton

### Validation Logic
The slug validation follows the same patterns as the family-manager:
```tsx
// Real-time uniqueness checking with debouncing
const checkSlugUniqueness = useCallback(async (slug: string, currentFamilyId: string) => {
  // Skip validation for empty slugs
  if (!slug || slug.trim() === '') return;
  
  // Call API to check if slug exists
  // Show error if slug is taken by another family
  // Clear error if slug is available
}, []);

// Debounced validation (500ms delay)
useEffect(() => {
  if (familyEditData.slug && family?.id) {
    const timeoutId = setTimeout(() => {
      checkSlugUniqueness(familyEditData.slug!, family.id);
    }, 500);
    return () => clearTimeout(timeoutId);
  }
}, [familyEditData.slug, family?.id, checkSlugUniqueness]);
```

## Sleep Location Management

`SleepLocationManager.tsx` is a self-contained manager rendered as the "Sleep Locations" section of `ConfigTab.tsx`. It lists every distinct sleep location for the family (defaults plus custom values) with usage counts, and supports show/hide toggles, renaming and merging custom locations (updating all existing sleep entries), deleting unused values, and one-click merge suggestions for near-duplicates (case/whitespace variants). It fetches from `GET/PUT/DELETE /api/sleep-locations` and saves visibility via the existing `POST /api/sleep-location-settings`; all endpoints are scoped by the authenticated user's family. Shared list-building/validation logic lives in `src/utils/sleepLocationUtils.ts` (unit tested in `tests/sleepLocationUtils.test.ts`), and the default location values live in `src/constants/sleepLocations.ts`.

## Implementation Details

The form components in this directory follow these patterns:

1. They use the FormPage component from `@/src/components/ui/form-page` for consistent layout and behavior
2. They include FormPageContent for the scrollable form area
3. They include FormPageFooter for action buttons
4. They handle their own data fetching and state management
5. They follow the container/presentational pattern where appropriate
6. They support multi-family functionality by accepting a familyId prop

### Multi-Family Support

The SettingsForm component supports multi-family functionality by:
- Accepting a `familyId` prop to associate settings with a specific family
- Including the family ID in the settings API request payload
- Passing the family ID to child form components (BabyForm, ContactForm)
- The API endpoints also extract the family ID from request headers as a fallback

When using this component in a multi-family context, you should:
1. Import and use the family context to get the current family ID
2. Pass the family ID to the SettingsForm component
3. The component will handle sending this ID to the API and child components

### ShareButton Integration

The ShareButton component is integrated into the family slug field:
- **Placement**: Appears next to the slug input when not in edit mode
- **Configuration**: Uses app config for proper URL generation
- **Performance**: App config is fetched once and reused
- **Styling**: Matches form button styling with outline variant and small size

```tsx
{family?.slug && (
  <ShareButton
    familySlug={family.slug}
    familyName={family.name}
    appConfig={appConfig || undefined}
    variant="outline"
    size="sm"
    showText={false}
  />
)}
```

## Mobile Considerations

These form components are designed with mobile-first principles:
- On mobile screens, form content is centered
- On screens above 600px, form content is left-aligned
- All interactive elements have appropriate touch targets
- Forms slide in from the right side of the screen with smooth animations
- Family editing controls stack properly on small screens

## Error Handling

The form includes comprehensive error handling:
- **Network Errors**: Graceful handling of API failures
- **Validation Errors**: Clear user feedback for invalid data
- **Loading States**: Visual indicators during save operations
- **Slug Conflicts**: Immediate feedback for duplicate slugs

## Security Considerations

- **Authentication**: All family operations require valid authentication
- **Authorization**: Users can only edit their own family data
- **Validation**: Server-side validation prevents invalid data
- **Debouncing**: Reduces API calls during slug validation
