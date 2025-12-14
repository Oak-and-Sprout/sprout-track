# ShareButton Component

A specialized button component for sharing family login URLs with cross-platform sharing capabilities. Built with accessibility and mobile-first design in mind.

## Features

- Automatic URL generation using app configuration (domain, HTTPS settings)
- Configurable URL suffix for different types of sharing (login, setup, etc.)
- Native Web Share API support for mobile devices
- Fallback to clipboard copy for desktop browsers
- Visual feedback for successful copy operations
- Multiple visual variants (default, outline, ghost, link)
- Multiple size options (default, sm, lg, icon)
- Support for all standard button HTML attributes
- Accessible focus states with keyboard navigation support
- Follows the project's design system with matching colors

## Props

The ShareButton component accepts all standard HTML button attributes plus the following:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `familySlug` | `string` | required | The family slug used to generate the share URL |
| `familyName` | `string` | `undefined` | Optional family name for share content and accessibility |
| `appConfig` | `{ rootDomain: string; enableHttps: boolean }` | `undefined` | Optional app config to avoid API calls (performance optimization) |
| `urlSuffix` | `string` | `""` | Optional URL suffix to append to the path (e.g., "/dashboard" for custom routes) |
| `variant` | `'default' \| 'outline' \| 'ghost' \| 'link'` | `'ghost'` | Visual style variant of the button |
| `size` | `'default' \| 'sm' \| 'lg' \| 'icon'` | `'sm'` | Size variant of the button |
| `showText` | `boolean` | `true` | Whether to show the text label next to the icon |
| `asChild` | `boolean` | `false` | When true, the button will render its children as a slot |
| `className` | `string` | `undefined` | Additional CSS classes to apply to the button |

## Usage Examples

### Basic ShareButton (Family URL)

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function MyComponent() {
  return (
    <ShareButton 
      familySlug="my-family-slug"
      familyName="The Smith Family"
      // urlSuffix="" is the default - generates direct family URL
    />
  )
}
```

### Setup Token Sharing

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function SetupInvitation() {
  const setupToken = "abc123";
  
  return (
    <ShareButton 
      familySlug={`setup/${setupToken}`}
      familyName="Family Setup Invitation"
      variant="outline"
      showText={true}
    />
  )
}
```

### ShareButton Variants

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function ShareButtonVariants() {
  const familySlug = "sample-family";
  const familyName = "The Johnson Family";
  
  return (
    <div className="flex flex-col gap-4">
      <ShareButton familySlug={familySlug} familyName={familyName} variant="default" />
      <ShareButton familySlug={familySlug} familyName={familyName} variant="outline" />
      <ShareButton familySlug={familySlug} familyName={familyName} variant="ghost" />
      <ShareButton familySlug={familySlug} familyName={familyName} variant="link" />
    </div>
  )
}
```

### ShareButton Sizes

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function ShareButtonSizes() {
  const familySlug = "sample-family";
  
  return (
    <div className="flex flex-wrap gap-4 items-end">
      <ShareButton familySlug={familySlug} size="sm" />
      <ShareButton familySlug={familySlug} size="default" />
      <ShareButton familySlug={familySlug} size="lg" />
      <ShareButton familySlug={familySlug} size="icon" />
    </div>
  )
}
```

### Icon-Only ShareButton (Compact)

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function CompactTable() {
  return (
    <div className="flex gap-2">
      {/* Other action buttons */}
      <ShareButton 
        familySlug="my-family"
        familyName="The Smith Family"
        variant="outline"
        size="sm"
        showText={false}
      />
    </div>
  )
}
```

### Performance Optimized (Multiple ShareButtons)

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function FamilyTable({ families, appConfig }) {
  return (
    <table>
      <tbody>
        {families.map(family => (
          <tr key={family.id}>
            <td>{family.name}</td>
            <td>
              <ShareButton 
                familySlug={family.slug}
                familyName={family.name}
                appConfig={appConfig} // Pass once, reuse for all buttons
                variant="outline"
                size="sm"
                showText={false}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### In Login Header (With Text)

```tsx
import { ShareButton } from "@/components/ui/share-button"

export function LoginHeader({ familySlug, familyName }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <h2 className="text-xl font-semibold">
        {familyName || 'Security Check'}
      </h2>
      {familySlug && familyName && (
        <ShareButton 
          familySlug={familySlug} 
          familyName={familyName}
          variant="ghost"
          size="sm"
          showText={true}
        />
      )}
    </div>
  )
}
```

## How It Works

### URL Generation

The ShareButton component automatically:

1. **With appConfig prop**: Uses the provided config directly (no API call)
2. **Without appConfig prop**: Fetches app configuration from `/api/app-config/public`
3. Uses `rootDomain` and `enableHttps` settings to build the complete URL
4. Falls back to current domain if API is unavailable
5. Generates URLs in format: `{protocol}://{domain}/{familySlug}{urlSuffix}`

### URL Types

The component supports different URL types via the `urlSuffix` prop:

- **Family URLs** (default): `urlSuffix=""` → `https://domain.com/family-slug`
- **Setup Token URLs**: `urlSuffix=""` → `https://domain.com/setup/abc123`
- **Custom URLs**: `urlSuffix="/dashboard"` → `https://domain.com/family-slug/dashboard`

### Performance Optimization

For pages with multiple ShareButtons (like tables), pass the `appConfig` prop to avoid duplicate API calls:

```tsx
// ✅ Good: One API call, multiple buttons
const [appConfig, setAppConfig] = useState(null);

useEffect(() => {
  fetch('/api/app-config/public')
    .then(r => r.json())
    .then(data => setAppConfig(data.data));
}, []);

// Pass to all ShareButton instances
<ShareButton appConfig={appConfig} ... />

// ❌ Bad: Multiple API calls for same data
<ShareButton ... /> // API call #1
<ShareButton ... /> // API call #2
<ShareButton ... /> // API call #3
```

### Platform Detection

The component detects platform capabilities:

- **Mobile devices**: Uses native Web Share API when available
- **Desktop browsers**: Falls back to clipboard copy
- **Unsupported browsers**: Shows alert with URL as final fallback

### Visual States

The button provides visual feedback:

- **Normal state**: Shows appropriate icon (Share or Copy)
- **Copied state**: Shows checkmark with green color for 2 seconds
- **Hover states**: Follows the app's design system

## Implementation Details

The ShareButton component is built using:

- React's `forwardRef` for proper ref forwarding
- Radix UI's `Slot` component for the `asChild` functionality
- Class Variance Authority (CVA) for variant management
- TailwindCSS for styling with dark mode support
- Web Share API for native mobile sharing
- Clipboard API for desktop copy functionality

The component follows a modular structure:
- `index.tsx` - Main component implementation
- `share-button.styles.ts` - Style definitions using CVA
- `share-button.types.ts` - TypeScript type definitions
- `share-button.css` - Dark mode overrides
- `README.md` - Component documentation

## Accessibility

The ShareButton component includes:

- Proper focus states with visible outlines
- Descriptive titles that change based on platform capabilities
- ARIA-compatible button structure
- Keyboard navigation support
- Screen reader friendly feedback

## Mobile Considerations (React Native)

When adapting this component for React Native, consider the following:

- **Styling**: The TailwindCSS classes will need to be replaced with React Native's StyleSheet
- **Sharing**: Use React Native's `Share` module instead of Web Share API
- **Clipboard**: Use `@react-native-clipboard/clipboard` for copy functionality
- **URL Generation**: The API calls will work the same way
- **Icons**: Replace Lucide React icons with React Native compatible icons
- **Animations**: Use React Native's Animated API for state transitions

## Security Considerations

- The component only accesses non-sensitive app configuration data
- URLs are generated client-side using public API endpoints
- No authentication tokens or sensitive data are included in share URLs
- The share URLs point to family pages (which show login UI when unauthenticated), not authenticated content

This component follows the project's cross-platform compatibility guidelines by:
1. Separating core logic from platform-specific implementations
2. Using progressive enhancement for advanced features
3. Providing comprehensive fallbacks for all functionality
4. Documenting all platform-specific requirements 