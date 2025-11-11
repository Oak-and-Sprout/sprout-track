# Account Modal Component

A registration-focused modal component that provides account creation and login functionality for user accounts in Sprout Track.

## Features

- **Registration Focused**: Defaults to registration mode with clear transition to login
- **Enhanced Password Security**: Comprehensive password validation (8+ chars, mixed case, numbers, special characters)
- **Clean Design**: Modern UI with gradient header, visual separators, and Sprout Track branding
- **Dark Mode Support**: Full dark mode theming with CSS custom properties
- **Smart Form Validation**: Real-time client-side validation with detailed error messages
- **Success States**: Visual feedback for successful registration with auto-close
- **Error Handling**: Clear, specific error messages for validation and API failures
- **Account Registration**: Full integration with the `/api/accounts/register` endpoint for secure user account creation
- **Family Setup Integration**: Account registration creates user accounts; family setup happens later via SetupWizard
- **Intuitive Mode Transitions**: Clean header-based toggle for switching between registration and login with hover effects

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | `required` | Whether the modal is open |
| `onClose` | `() => void` | `required` | Callback function to close the modal |
| `initialMode` | `'login' \| 'register'` | `'register'` | Initial mode when modal opens |

## Usage Examples

### Basic Usage

```tsx
import AccountModal from "@/src/components/modals/AccountModal";
import { useState } from "react";

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Account
      </button>
      
      <AccountModal 
        open={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  )
}
```

### Opening in Registration Mode

```tsx
import AccountModal from "@/src/components/modals/AccountModal";
import { useState } from "react";

export function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Sign Up
      </button>
      
      <AccountModal 
        open={isOpen} 
        onClose={() => setIsOpen(false)}
        initialMode="register"
      />
    </>
  )
}
```

## Form Fields

### Login Mode
- **Email**: Valid email address (required)
- **Password**: At least 8 characters with letters and numbers (required)

### Registration Mode
- **Email**: Valid email address (required)
- **Password**: At least 8 characters with letters and numbers (required)
- **First Name**: User's first name (required)
- **Last Name**: User's last name (optional)

## Validation Rules

### Email Validation
- Must match standard email regex pattern: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### Password Validation
- Minimum 8 characters
- Must contain at least one lowercase letter (a-z)
- Must contain at least one uppercase letter (A-Z)
- Must contain at least one number (0-9)
- Must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)

### Registration Validation
- All email and password rules apply
- First name cannot be empty

## API Integration

### Registration Flow
1. User submits registration form
2. Client-side validation runs
3. POST request to `/api/accounts/register` (creates user account only)
4. Success: Shows verification message, auto-closes after 3 seconds
5. Error: Displays error message in the modal

**Note**: Account registration only creates the user account. Family setup (family name, slug, babies, caretakers) happens later through the SetupWizard component after email verification and initial login.

### Current Status
- ✅ **Registration**: Fully implemented with email verification
- ⏳ **Login**: Placeholder implementation (shows "coming soon" message)
- ⏳ **Password Reset**: Not yet implemented
- ⏳ **Email Verification UI**: Handled via email links

## Design System

### Color Scheme
- **Primary**: Teal/Emerald gradient (`#0d9488` to `#059669`)
- **Background**: Light gray gradient with backdrop blur
- **Text**: Proper contrast ratios for accessibility
- **Errors**: Red tones for error states
- **Success**: Green tones for success states

### Typography
- **Header**: Large, bold typography for "Welcome Back"/"Create Account"
- **Labels**: Medium weight, smaller font size
- **Help Text**: Light weight, muted colors
- **Buttons**: Medium weight, appropriate sizing

### Responsive Design
- Optimized for mobile and desktop
- Responsive grid for name fields
- Proper touch targets for mobile devices

## Dark Mode Support

The modal includes comprehensive dark mode support via CSS:

```css
html.dark .account-modal-content {
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid #334155;
}
```

All text, backgrounds, and interactive elements adapt to dark mode.

## Accessibility

### Features Included
- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Focus Management**: Proper focus states and outline indicators
- **ARIA Labels**: Semantic HTML with proper labeling
- **Screen Reader Support**: Compatible with assistive technologies
- **Color Contrast**: WCAG AA compliant contrast ratios

### Focus States
- Custom focus indicators for better visibility
- Different colors for light and dark modes
- 2px outline with proper offset

## Security Considerations

### Client-Side Validation
- Email format validation prevents basic input errors
- Password strength requirements enforce security standards
- Form sanitization for all text inputs

### API Security
- Registration endpoint includes rate limiting (5 attempts per IP per 24 hours)
- Server-side validation mirrors client-side rules
- Secure password hashing with PBKDF2
- Email verification required before account activation

## Future Enhancements

### Planned Features
1. **Login Implementation**: Complete login functionality with session management
2. **Password Reset**: Forgot password flow with email reset links
3. **Social Login**: OAuth integration for Google, Apple, GitHub
4. **Remember Me**: Optional session persistence
5. **Two-Factor Auth**: Enhanced security options

### Mobile Considerations (React Native)

When adapting this component for React Native, consider:

- Replace `Dialog` with React Native `Modal`
- Use React Native's `TextInput` components
- Implement custom validation feedback
- Adapt styling to React Native StyleSheet
- Handle keyboard avoiding behavior
- Implement proper navigation integration

## Integration Notes

### Home Page
The modal is integrated into the home page header:
- Button positioned between sign up and theme toggle
- Uses `User` icon from Lucide React
- Consistent styling with other header elements
- Responsive behavior on mobile devices

### State Management
- Local state management with React hooks
- Form data reset on modal open/close
- Error state management with clear user feedback
- Success state with auto-dismiss functionality

## Testing Considerations

### Unit Tests
- Form validation logic
- Mode switching functionality
- Error handling scenarios
- Success state management

### Integration Tests
- API endpoint integration
- Email verification flow
- Rate limiting behavior
- Error response handling

### E2E Tests
- Complete registration workflow
- Modal open/close behavior
- Form submission and validation
- Success/error state transitions