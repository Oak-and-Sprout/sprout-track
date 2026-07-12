# FeedForm Component

A modular form component for creating and editing feeding records for a baby. This component follows the form-page pattern used throughout the application and has been refactored into subcomponents for better maintainability.

## Component Structure

- `index.tsx` - Main container component that:
  - Manages shared state and form logic
  - Handles API calls and form submission
  - Fetches the last feed type to pre-populate the form
  - Conditionally renders the appropriate subcomponent based on feed type

- Subcomponents:
  - `BreastFeedForm.tsx` - Handles breast feeding UI with:
    - Side selection (Left/Right)
    - Timer functionality for tracking feeding duration
    - Play/pause controls for the timer
  
  - `BottleFeedForm.tsx` - Manages bottle feeding with:
    - Amount input with increment/decrement controls
    - Unit selection (oz/ml)
  
  - `SolidsFeedForm.tsx` - Handles solids feeding with:
    - Amount input with increment/decrement controls
    - Unit selection (tbsp/g)
    - Food description input

## Features

- Create new feeding records
- Edit existing feeding records
- Support for different feeding types (Breast, Bottle, Solids)
- Automatic fetching of last feeding amount for convenience
- Timer functionality for tracking breastfeeding duration
- Form validation for required fields
- Responsive design
- Multi-family support with family ID association

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls whether the form is visible |
| `onClose` | () => void | Yes | Function to call when the form should be closed |
| `babyId` | string \| undefined | Yes | ID of the baby for whom the feeding is being recorded |
| `initialTime` | string | Yes | Initial time value for the form (ISO format) |
| `activity` | FeedLogResponse | No | Existing feeding record data (for edit mode) |
| `onSuccess` | () => void | No | Optional callback function called after successful submission |
| `familyId` | string | No | The ID of the family this feeding record belongs to (for multi-family support) |

## Usage

```tsx
import FeedForm from '@/src/components/forms/FeedForm';
import { useFamily } from '@/src/context/family'; // Import family context

function MyComponent() {
  const [showFeedForm, setShowFeedForm] = useState(false);
  const [selectedBaby, setSelectedBaby] = useState<{ id: string }>();
  const { family } = useFamily(); // Get current family from context
  
  return (
    <>
      <Button onClick={() => setShowFeedForm(true)}>
        Log Feeding
      </Button>
      
      <FeedForm
        isOpen={showFeedForm}
        onClose={() => setShowFeedForm(false)}
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

The component dynamically shows different fields based on the selected feeding type:

### All Feeding Types
- **Time**: Date and time of the feeding (required)
- **Type**: Type of feeding (Breast, Bottle, Solids) (required)

### Breast Feeding (BreastFeedForm)
- **Side**: Which breast was used (Left or Right) (required)
  - Editable when editing an existing record: a Left/Right toggle changes the recorded side, and the entered duration follows the newly selected side
- **Duration**: Timer for tracking feeding duration with:
  - Start/pause controls for real-time tracking
  - Editable hours, minutes, and seconds fields for manual adjustment
  - Separate tracking for each breast's feeding time
- **Active session side correction**: while a live session is running (or paused), a "Started on the wrong side? Fix it" button reassigns the time accrued so far to the other side via `PUT /api/active-breastfeed?action=swap` (distinct from Switch Side, which changes which side accrues time going forward)

### Bottle Feeding (BottleFeedForm)
- **Amount**: Amount of milk/formula (with increment/decrement buttons)
- **Unit**: Measurement unit (oz or ml)

### Solids Feeding (SolidsFeedForm)
- **Amount**: Amount of food (with increment/decrement buttons)
- **Unit**: Measurement unit (tbsp or g)
- **Food**: Description of the food given

## Implementation Details

- Uses the FormPage component for consistent UI across the application
- Implements a modular component architecture for better maintainability
- Manages shared state in the main component while delegating UI rendering to subcomponents
- Implements useEffect hooks to populate form data when editing
- Uses an initialization flag to prevent form reset when initialTime prop changes
- Automatically fetches the last feeding type and amount for convenience
- Fetches default units from user settings
- Provides validation before submission
- Handles API calls for creating and updating feeding records
- Implements timer functionality for tracking breastfeeding duration
- Supports manual editing of duration times for flexibility
- Validates time inputs to ensure they are within valid ranges
- Resets form after successful submission
- Supports multi-family functionality by accepting a familyId prop and including it in API requests

### Multi-Family Support

The component supports multi-family functionality by:
- Accepting a `familyId` prop to associate the feeding record with a specific family
- Including the family ID in the API request payload
- The API endpoint also extracts the family ID from request headers as a fallback

When using this component in a multi-family context, you should:
1. Import and use the family context to get the current family ID
2. Pass the family ID to the FeedForm component
3. The component will handle sending this ID to the API
