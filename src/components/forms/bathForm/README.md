# BathForm Component

A modular form component for creating and editing bath records for a baby. This component follows the form-page pattern used throughout the application.

## Component Structure

- `index.tsx` - Main component that:
  - Manages form state and logic
  - Handles API calls and form submission
  - Provides a user-friendly interface for recording bath activities

## Features

- Create new bath records
- Edit existing bath records
- Track bath details including:
  - Bath type (Full Bath, Sponge Bath, Wipe Down, or a custom value)
  - Whether soap and/or shampoo was used
  - Water temperature
  - Bath duration
  - Additional notes
- GUI-managed bath type list (same pattern as SleepForm locations):
  - Default types can be shown/hidden via the gear icon manager (persisted per family in `Settings.bathTypeSettings` via `/api/bath-type-settings`)
  - Custom types previously used by the family are fetched from `/api/bath-log?bathTypes=true` and offered in the dropdown
  - A "Custom" option allows free-text entry of a new type
- Form validation for required fields
- Responsive design
- Multi-family support with family ID association

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls whether the form is visible |
| `onClose` | () => void | Yes | Function to call when the form should be closed |
| `babyId` | string \| undefined | Yes | ID of the baby for whom the bath is being recorded |
| `initialTime` | string | Yes | Initial time value for the form (ISO format) |
| `activity` | BathLogResponse | No | Existing bath record data (for edit mode) |
| `onSuccess` | () => void | No | Optional callback function called after successful submission |
| `familyId` | string | No | The ID of the family this bath record belongs to (for multi-family support) |

## Usage

```tsx
import BathForm from '@/src/components/forms/bathForm';
import { useFamily } from '@/src/context/family'; // Import family context

function MyComponent() {
  const [showBathForm, setShowBathForm] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<{ id: string }>();
  const { family } = useFamily(); // Get current family from context
  
  return (
    <>
      <Button onClick={() => setShowBathForm(true)}>
        Log Bath
      </Button>
      
      <BathForm
        isOpen={showBathForm}
        onClose={() => setShowBathForm(false)}
        babyId={selectedBaby?.id}
        initialTime={new Date().toISOString()}
        familyId={family?.id} // Pass the current family ID
        onSuccess={() => {
          // Refresh data or perform other actions after successful submission
        }}
      />
    </>
  );
}
```

## Form Fields

The component includes the following fields:

- **Time**: Date and time of the bath (required)
- **Bath Type**: Optional dropdown (Full Bath, Sponge Bath, Wipe Down, previously used custom types, or Custom free-text entry). Existing records without a type simply show no type.
- **Bath Options**:
  - **Soap Used**: Checkbox to indicate if soap was used
  - **Shampoo Used**: Checkbox to indicate if shampoo was used
- **Water Temperature**: Optional field to record the bath water temperature in degrees Fahrenheit
- **Duration**: Optional field to record the bath duration in minutes
- **Notes**: Text area for any additional notes about the bath

## Implementation Details

- Uses the FormPage component for consistent UI across the application
- Implements useEffect hooks to populate form data when editing
- Uses an initialization flag to prevent form reset when initialTime prop changes
- Provides validation before submission
- Handles API calls for creating and updating bath records
- Resets form after successful submission
- Styled with a consistent orange theme to match the bath activity tile
- Supports multi-family functionality by accepting a familyId prop and including it in API requests

### Multi-Family Support

The component supports multi-family functionality by:
- Accepting a `familyId` prop to associate the bath record with a specific family
- Including the family ID in the API request payload
- The API endpoint also extracts the family ID from request headers as a fallback

When using this component in a multi-family context, you should:
1. Import and use the family context to get the current family ID
2. Pass the family ID to the BathForm component
3. The component will handle sending this ID to the API
