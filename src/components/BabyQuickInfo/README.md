# BabyQuickInfo Component

A comprehensive tabbed component that displays information about a baby, including notifications, contacts, and quick stats.

## Features

- Responsive tabbed interface with these tabs:
  - **Notifications**: Shows last activities (poop, bath, measurements) and upcoming events
  - **Contacts**: Lists contacts associated with the baby
  - **Allergens**: Combined allergen list — entries derived from reaction-flagged food/feed logs (read-only, with a "From food log"/"From feed log" tag, the date first recorded, and a link to that day in the log timeline) merged with manually recorded allergens (name + type badge + optional reaction description; inline add form and soft delete)
  - **Quick Stats**: Displays detailed statistics about the baby's activities
- Vertical tab navigation on medium and larger screens for better organization
- Displays in a full-page form that slides in from the right
- Shows the baby's full name and age
- Color-coded based on baby's gender (blue for male, pink for female)
- Includes a close button to dismiss the form
- Responsive design for mobile and desktop
- Dark mode support

## Usage

Import and use the component in your layout or page component:

```tsx
import { BabyQuickInfo } from "@/src/components/BabyQuickInfo";

export function MyComponent() {
  const { selectedBaby } = useBaby();
  const [quickInfoOpen, setQuickInfoOpen] = useState(false);

  // Function to calculate baby's age
  const calculateAge = (birthday: Date) => {
    // Age calculation logic
  };

  return (
    <>
      <Button onClick={() => setQuickInfoOpen(true)}>
        View Baby Info
      </Button>
      
      <BabyQuickInfo
        isOpen={quickInfoOpen}
        onClose={() => setQuickInfoOpen(false)}
        selectedBaby={selectedBaby}
        calculateAge={calculateAge}
      />
    </>
  );
}
```

## Implementation Details

The BabyQuickInfo component is built using:

- React functional components with TypeScript
- FormPage component from the project's UI library
- TailwindCSS for styling via utility functions
- Lucide React for icons
- Date-fns for date formatting

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `NotificationsTab.tsx` - Notifications tab implementation
- `ContactsTab.tsx` - Contacts tab implementation
- `AllergensTab.tsx` - Allergens tab implementation (merged derived + manual allergen list)
- `StatsTab.tsx` - Quick stats tab implementation
- `baby-quick-info.styles.ts` - Style definitions using TailwindCSS
- `baby-quick-info.css` - Dark mode style overrides
- `baby-quick-info.types.ts` - TypeScript type definitions
- `README.md` - Documentation

## Props

| Prop | Type | Description |
|------|------|-------------|
| `isOpen` | `boolean` | Whether the form is open |
| `onClose` | `() => void` | Function to call when the form should be closed |
| `selectedBaby` | `Baby \| null` | The currently selected baby |
| `calculateAge` | `(birthDate: Date) => string` | Optional function to calculate the age of a baby |

## Component Structure

The component uses the FormPage component from the UI library, which provides:

1. **Form Header** - Contains the title "{Baby}'s Information"
2. **Tab Navigation** - Allows switching between Notifications, Contacts, and Quick Stats tabs
3. **Form Content** - Displays the content of the active tab
4. **Form Footer** - Contains the close button

## API Dependencies

The component relies on several API endpoints:

- `/api/baby-last-activities` - Fetches the most recent activities for a baby
- `/api/baby-upcoming-events` - Fetches upcoming calendar events for a baby
- `/api/contact` - Fetches all contacts
- `/api/timeline` - Fetches recent activities for a baby
- `/api/food-log/progress` - Fetches allergens derived from reaction-flagged food/feed logs
- `/api/baby-allergen` - Lists, creates, and soft-deletes manually recorded allergens

## Mobile Considerations (React Native)

When adapting this component for React Native, consider the following:

- **Styling**: The TailwindCSS classes will need to be replaced with React Native's StyleSheet
- **Form Page**: Replace with a React Native Modal or custom slide-in component
- **Tab Navigation**: Use React Native's TabView or a similar component
- **Layout**: Ensure the layout is optimized for various mobile screen sizes
- **Scrolling**: Implement proper scrolling behavior for content that exceeds the screen height
