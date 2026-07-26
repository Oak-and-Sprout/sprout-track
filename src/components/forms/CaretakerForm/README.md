# CaretakerForm Component

A full-screen form component for creating and editing caretaker profiles in the baby tracker application.

## Features

- Slide-in form layout using the FormPage component
- Form validation for all required fields
- Automatic detection of first caretaker to assign admin role
- PIN validation with confirmation
- Responsive design for both mobile and desktop

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| isOpen | boolean | Yes | Controls the visibility of the form |
| onClose | () => void | Yes | Function to call when the form is closed |
| isEditing | boolean | Yes | Whether the form is in edit mode or create mode |
| caretaker | PrismaCaretaker & { loginId?: string } \| null | Yes | The caretaker data to edit, or null for creating a new caretaker |
| onCaretakerChange | () => void | No | Optional callback function that is called after a successful form submission |
| appearance | `'default' \| 'storybook'` | No | Defaults to `'default'` (the classic `FormPage` slide-in). `'storybook'` renders the form inside a stacked `StorybookDrawer` for use in the account manager. Both appearances share the same state, validation, and `handleSubmit` — only the presentation differs. |

## Usage

```tsx
import CaretakerForm from '@/src/components/forms/CaretakerForm';

function MyComponent() {
  const [showCaretakerForm, setShowCaretakerForm] = useState(false);
  const [selectedCaretaker, setSelectedCaretaker] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleAddCaretaker = () => {
    setSelectedCaretaker(null);
    setIsEditing(false);
    setShowCaretakerForm(true);
  };

  const handleEditCaretaker = (caretaker) => {
    setSelectedCaretaker(caretaker);
    setIsEditing(true);
    setShowCaretakerForm(true);
  };

  const handleCaretakerFormClose = () => {
    setShowCaretakerForm(false);
  };

  const handleCaretakerChange = () => {
    // Fetch updated caretaker data or perform other actions
  };

  return (
    <>
      <Button onClick={handleAddCaretaker}>Add Caretaker</Button>
      
      <CaretakerForm
        isOpen={showCaretakerForm}
        onClose={handleCaretakerFormClose}
        isEditing={isEditing}
        caretaker={selectedCaretaker}
        onCaretakerChange={handleCaretakerChange}
      />
    </>
  );
}
```

## Implementation Details

- Uses the FormPage component from the UI library for consistent form layout
- Implements proper form validation for all fields
- Handles API calls to create and update caretaker profiles
- Follows the container/presentational pattern for separation of concerns
- Maintains responsive design for all screen sizes
