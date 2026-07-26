# No Baby Selected Component

A reusable component that displays a friendly message when no baby is selected in the application. Features a baby icon, customizable text, and full light/dark mode support.

## Features

- Baby icon from Lucide React
- Customizable title and description text
- Semantic heading (`h2`) and paragraph elements styled with the app's label typography for consistency
- Full light and dark mode support with smooth transitions
- Responsive design that works on both mobile and desktop
- Consistent styling with the rest of the application
- Accessible design with proper contrast ratios

## Components

The No Baby Selected system consists of:

1. `NoBabySelected` - The main component that displays the message

## Props

### NoBabySelected Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `"No Baby Selected"` | The title text to display |
| `description` | `string` | `"Please select a baby from the dropdown menu above."` | The description text below the title |
| `className` | `string` | `undefined` | Additional CSS classes to apply to the component |

## Usage Examples

### Basic Usage

```tsx
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';

export function MyPage() {
  const { selectedBaby } = useBaby();
  
  return (
    <div>
      {selectedBaby ? (
        <div>Baby content here...</div>
      ) : (
        <NoBabySelected />
      )}
    </div>
  );
}
```

### Custom Text

```tsx
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';

export function CalendarPage() {
  const { selectedBaby } = useBaby();
  
  return (
    <div>
      {selectedBaby ? (
        <Calendar baby={selectedBaby} />
      ) : (
        <NoBabySelected
          title="Choose a Baby"
          description="Select a baby to view their calendar activities."
        />
      )}
    </div>
  );
}
```

### With Custom Styling

```tsx
import { NoBabySelected } from '@/src/components/ui/no-baby-selected';

export function LogPage() {
  const { selectedBaby } = useBaby();
  
  return (
    <div>
      {selectedBaby ? (
        <LogTimeline baby={selectedBaby} />
      ) : (
        <NoBabySelected
          className="min-h-[600px]"
          title="Start Logging"
          description="Choose a baby to begin tracking their activities."
        />
      )}
    </div>
  );
}
```

## Implementation Details

The No Baby Selected component is built using:

- React with TypeScript for type safety
- Lucide React for the baby icon
- Semantic `h2`/`p` elements sharing the app's label typography (`labelVariants`) for consistent text styling
- Tailwind CSS for responsive design and animations
- Theme context for dark mode support
- CSS overrides for dark mode styling

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `no-baby-selected.styles.ts` - Style definitions using Tailwind classes
- `no-baby-selected.types.ts` - TypeScript type definitions
- `no-baby-selected.css` - Dark mode CSS overrides
- `README.md` - Component documentation

## Styling

The component uses a consistent design system:

### Light Mode
- White background
- Teal icon container and icon
- Gray text colors with proper hierarchy
- Smooth transitions

### Dark Mode
- Dark gray background (`gray-800`)
- Darker teal icon container with lighter teal icon
- Light gray text for better contrast
- Maintains visual hierarchy

## Accessibility

The No Baby Selected component includes:
- Proper semantic structure
- Sufficient color contrast in both light and dark modes
- Responsive design that works on all screen sizes
- Clear visual hierarchy with appropriate font sizes
- Touch-friendly design for mobile users

## Dark Mode Support

The component includes comprehensive dark mode support:

1. **Theme Integration**: Uses the application's theme context
2. **CSS Overrides**: Custom CSS file provides dark mode styling
3. **Smooth Transitions**: All color changes include smooth transitions
4. **Consistent Branding**: Maintains the app's teal color scheme in both modes

The dark mode styling includes:
- Dark gray background for the container
- Adjusted teal colors for the icon and container
- Light gray text colors for optimal readability
- Proper contrast ratios for accessibility

## Mobile Considerations (React Native)

When adapting this component for React Native, consider the following:

- **Icon**: Replace Lucide React with React Native Vector Icons or Expo Vector Icons
- **Styling**: Convert Tailwind classes to React Native StyleSheet
- **Theme**: Adapt theme context to use React Native's appearance API
- **Layout**: Use React Native's Flexbox layout system
- **Typography**: Replace Label component with React Native Text component

This component follows the project's cross-platform compatibility guidelines by:
1. Using a modular structure that can be adapted for different platforms
2. Separating styling concerns from logic
3. Providing clear documentation for platform-specific adaptations
4. Using semantic component structure
5. Implementing accessible design patterns

## Performance Considerations

- Minimal bundle size with only necessary dependencies
- Efficient re-rendering through proper prop handling
- Optimized CSS transitions
- Theme context integration without unnecessary re-renders 