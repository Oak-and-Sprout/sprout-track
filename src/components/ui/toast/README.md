# Toast Component

A flexible toast notification component for displaying temporary messages, alerts, and feedback to users.

## Features

- Multiple visual variants (info, success, warning, error)
- Auto-dismiss with configurable duration
- Manual dismissal support
- Dark mode support
- Accessible with proper ARIA attributes
- Responsive design for mobile and desktop
- Customizable icons and actions
- Smooth enter/exit animations

## Props

The Toast component accepts the following props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'info' \| 'success' \| 'warning' \| 'error'` | `'info'` | Visual style variant of the toast |
| `message` | `string` | **required** | The main message to display in the toast |
| `title` | `string` | `undefined` | Optional title/heading for the toast |
| `duration` | `number \| null` | `5000` | Duration in milliseconds before auto-dismiss. Set to `0` or `null` to prevent auto-dismiss |
| `dismissible` | `boolean` | `true` | Whether the toast can be dismissed by the user |
| `onDismiss` | `() => void` | `undefined` | Callback function called when the toast is dismissed |
| `icon` | `React.ReactNode` | `undefined` | Optional custom icon. If not provided, a default icon will be used based on variant |
| `action` | `{ label: string; onClick: () => void }` | `undefined` | Optional action button to display in the toast |
| `className` | `string` | `undefined` | Additional CSS classes to apply to the toast |

## Usage Examples

### Basic Toast

```tsx
import { Toast } from "@/components/ui/toast"

export function MyComponent() {
  return (
    <Toast
      variant="success"
      message="Changes saved successfully!"
    />
  )
}
```

### Toast Variants

```tsx
import { Toast } from "@/components/ui/toast"

export function ToastVariants() {
  return (
    <div className="flex flex-col gap-4">
      <Toast variant="info" message="This is an informational message" />
      <Toast variant="success" message="Operation completed successfully!" />
      <Toast variant="warning" message="Please review your changes" />
      <Toast variant="error" message="An error occurred. Please try again." />
    </div>
  )
}
```

### Toast with Title

```tsx
import { Toast } from "@/components/ui/toast"

export function ToastWithTitle() {
  return (
    <Toast
      variant="warning"
      title="Account Expired"
      message="Your subscription has expired. Please upgrade to continue."
    />
  )
}
```

### Custom Duration

```tsx
import { Toast } from "@/components/ui/toast"

export function CustomDurationToast() {
  return (
    <Toast
      variant="info"
      message="This toast will stay visible for 10 seconds"
      duration={10000}
    />
  )
}
```

### Non-Dismissible Toast

```tsx
import { Toast } from "@/components/ui/toast"

export function NonDismissibleToast() {
  return (
    <Toast
      variant="error"
      message="Critical error occurred"
      dismissible={false}
      duration={null}
    />
  )
}
```

### Toast with Action Button

```tsx
import { Toast } from "@/components/ui/toast"

export function ToastWithAction() {
  return (
    <Toast
      variant="warning"
      message="Your account will expire soon"
      action={{
        label: "Upgrade Now",
        onClick: () => {
          // Navigate to upgrade page
          window.location.href = "/upgrade"
        }
      }}
    />
  )
}
```

### Custom Icon

```tsx
import { Toast } from "@/components/ui/toast"

export function CustomIconToast() {
  return (
    <Toast
      variant="info"
      message="Custom icon toast"
      icon={
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          {/* Custom icon SVG */}
        </svg>
      }
    />
  )
}
```

### Toast with Dismiss Handler

```tsx
import { Toast } from "@/components/ui/toast"
import { useState } from "react"

export function ToastWithHandler() {
  const [showToast, setShowToast] = useState(true)

  return (
    <>
      {showToast && (
        <Toast
          variant="success"
          message="Item added to cart"
          onDismiss={() => {
            console.log("Toast dismissed")
            setShowToast(false)
          }}
        />
      )}
    </>
  )
}
```

## Implementation Details

The Toast component is built using:

- React's `forwardRef` for proper ref forwarding
- Class Variance Authority (CVA) for variant management
- TailwindCSS for styling
- CSS animations for enter/exit transitions
- Theme context for dark mode support

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `toast.styles.ts` - Style definitions using CVA
- `toast.types.ts` - TypeScript type definitions
- `toast.css` - Dark mode styles and animations

## Accessibility

The Toast component includes:

- Proper ARIA attributes (`role="alert"`, `aria-live="assertive"`, `aria-atomic="true"`)
- Keyboard accessible close button
- Focus management for action buttons
- Screen reader friendly announcements

## Dark Mode

The Toast component fully supports dark mode through:

- TailwindCSS dark mode classes (`dark:` prefix)
- Component-specific CSS overrides in `toast.css`
- Automatic theme detection via `useTheme` hook

## Mobile Considerations (React Native)

When adapting this component for React Native, consider the following:

- **Styling**: The TailwindCSS classes will need to be replaced with React Native's StyleSheet or a compatible styling solution like NativeWind
- **Animations**: React Native handles animations differently, so the transition effects will need to be implemented using the Animated API or react-native-reanimated
- **Positioning**: Fixed positioning works differently in React Native - consider using a portal library or absolute positioning within a parent container
- **Touch Targets**: Ensure touch targets meet minimum size requirements (44x44 points)
- **Theme**: The theme context will need to be adapted for React Native's appearance API or a similar solution

This component follows the project's cross-platform compatibility guidelines by:
1. Keeping the core logic separate from styling
2. Using a modular structure that can be adapted for different platforms
3. Avoiding web-specific APIs in the core component logic
4. Documenting all aspects that will need platform-specific implementations

## Toast Container (Future Enhancement)

For a complete toast system, you may want to create a `ToastContainer` component that manages multiple toasts and provides a context API for showing toasts from anywhere in the application. This would typically include:

- A toast context provider
- A `useToast` hook for triggering toasts
- Automatic stacking and positioning of multiple toasts
- Queue management for toast display

Example API:

```tsx
// In your app
import { ToastProvider } from "@/components/ui/toast"

function App() {
  return (
    <ToastProvider>
      {/* Your app content */}
    </ToastProvider>
  )
}

// In any component
import { useToast } from "@/components/ui/toast"

function MyComponent() {
  const { showToast } = useToast()

  const handleClick = () => {
    showToast({
      variant: "success",
      message: "Saved!",
      duration: 3000
    })
  }

  return <button onClick={handleClick}>Save</button>
}
```

