# BabyForm Component

A form component for creating and editing baby profiles in the Baby Tracker application.

## Usage

```tsx
import BabyForm from '@/src/components/forms/BabyForm';
import { useFamily } from '@/src/context/family'; // Import family context

// In your component
const [showBabyForm, setShowBabyForm] = useState(false);
const [selectedBaby, setSelectedBaby] = useState<Baby | null>(null);
const [isEditing, setIsEditing] = useState(false);
const { family } = useFamily(); // Get current family from context

// To open the form for creating a new baby
const handleAddBaby = () => {
  setSelectedBaby(null);
  setIsEditing(false);
  setShowBabyForm(true);
};

// To open the form for editing an existing baby
const handleEditBaby = (baby: Baby) => {
  setSelectedBaby(baby);
  setIsEditing(true);
  setShowBabyForm(true);
};

// In your JSX
<BabyForm
  isOpen={showBabyForm}
  onClose={() => setShowBabyForm(false)}
  isEditing={isEditing}
  baby={selectedBaby}
  familyId={family?.id} // Pass the current family ID
  onBabyChange={() => {
    // Handle data refresh after baby is created or updated
    fetchData();
  }}
/>
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | boolean | Yes | Controls the visibility of the form |
| `onClose` | () => void | Yes | Function called when the form is closed |
| `isEditing` | boolean | Yes | Determines if the form is in edit mode or create mode |
| `baby` | Baby \| null | Yes | The baby object to edit (null when creating a new baby) |
| `onBabyChange` | () => void | No | Callback function called after a baby is successfully created or updated |
| `familyId` | string | No | The ID of the family this baby belongs to (for multi-family support) |
| `appearance` | `'default' \| 'storybook'` | No | Defaults to `'default'` (the classic `FormPage` slide-in). `'storybook'` renders the form inside a stacked `StorybookDrawer` for use in the account manager (nests above the account-manager drawer via Radix portals). Both appearances share the same `formData` state, validation, and `handleSubmit` — only the presentation differs. |

## Features

- Create new baby profiles
- Edit existing baby profiles
- Set warning times for feeding and diaper changes
- Mark babies as inactive (when editing)
- Form validation for required fields
- Responsive layout for mobile and desktop
- Multi-family support with family ID association

## Implementation Details

The BabyForm component uses the FormPage component from the UI library to create a full-screen form that slides in from the right side of the screen. It includes:

- A header with a title and description
- A form with fields for the baby's information
- A footer with action buttons

The component handles form submission by making API calls to the `/api/baby` endpoint with the appropriate HTTP method (POST for creating, PUT for updating).

## Multi-Family Support

The component supports multi-family functionality by:
- Accepting a `familyId` prop to associate the baby with a specific family
- Including the family ID in the API request payload
- Storing the family ID in the form data
- Handling both new baby creation and updates with the correct family association

When using this component in a multi-family context:
```tsx
import { useFamily } from '@/src/context/family';

function BabyManagement() {
  const { family } = useFamily(); // Get current family from context
  
  return (
    <BabyForm
      // Other props...
      familyId={family?.id} // Pass the current family ID
    />
  );
}
```

## Styling

The component uses the following styling approaches:
- TailwindCSS for responsive layout and styling
- Form-specific styles defined in `baby-form.styles.ts`
- Consistent with the application's design system

## Accessibility

- Proper form labels for all input fields
- Required field validation
- Keyboard navigation support
- Focus management when the form opens and closes
