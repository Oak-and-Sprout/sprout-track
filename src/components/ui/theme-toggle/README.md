# Theme Toggle Component

A toggle button component that allows users to cycle between light, dark, and system themes in the application.

## Features

- Cycles between light, dark, and system themes with a single button
- Displays appropriate icon based on current theme (Sun for light mode, Moon for dark mode, Monitor for system mode)
- Visually indicates the active theme with a colored circle around the icon
- Shows the current theme and what the next theme will be when clicked
- Fully accessible with proper ARIA attributes
- Responsive design
- Consistent styling with the application's design system

## Usage

### Default Theme Toggle

```tsx
import { ThemeToggle } from '@/src/components/ui/theme-toggle';

export default function MyComponent() {
  return (
    <div>
      <ThemeToggle />
    </div>
  );
}
```

### Light Theme Toggle

```tsx
import { ThemeToggle } from '@/src/components/ui/theme-toggle';

export default function HeaderComponent() {
  return (
    <header>
      <ThemeToggle variant="light" />
    </header>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `undefined` | Additional CSS class names to apply to the theme toggle |
| `variant` | `"default" \| "light" \| "minimal"` | `"default"` | Toggle variant - "default" has full styling with helper text and backgrounds, "light" is simplified with just icon and label, "minimal" is like light but uses gray-200 text in both modes |
| `...props` | `ButtonHTMLAttributes<HTMLButtonElement>` | - | All standard button HTML attributes |

## Implementation Details

The ThemeToggle component uses the application's theme context to determine the current theme and cycle between light, dark, and system modes. 

### Default Variant
It displays:
- A Sun icon with a blue circle when in light mode
- A Moon icon with a purple circle when in dark mode
- A Monitor icon with a green circle when in system mode

The component shows both the current active theme and what the next theme will be when clicked, making it intuitive for users to understand the toggle behavior.

### Light Variant
The light variant provides a simplified interface with:
- Smaller icons (14px vs 16px)
- No colored circles or background highlighting
- Only the current theme label (no helper text)
- Smaller text size (12px vs 14px)
- Minimal padding for compact layouts

### Minimal Variant
The minimal variant is identical to the light variant in structure but uses `gray-200` (`#e5e7eb`) for both icon and label text in both light and dark modes, making it suitable for use on darker backgrounds regardless of theme.

The component is styled using TailwindCSS for light mode styles and CSS classes for dark mode styles rather than Tailwind's dark mode variants for better cross-platform compatibility.

## Accessibility

- Uses proper button semantics
- Includes appropriate ARIA labels that change based on the current theme
- Maintains sufficient color contrast in both light and dark modes
- Provides visual feedback on hover and focus states
- Clear visual indication of the active theme

## Mobile Considerations

- Uses larger touch targets suitable for mobile interaction
- Maintains consistent styling across platforms
- Designed to work well in responsive layouts
