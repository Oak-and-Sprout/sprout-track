# Toast Notification System - Implementation Guide

## Overview

The toast notification system provides a global, non-intrusive way to display temporary messages, alerts, and feedback to users throughout the application. It's particularly useful for displaying account expiration warnings and other important notifications.

## Architecture

### Component Structure

The toast system consists of three main parts:

1. **Toast Component** (`src/components/ui/toast/index.tsx`)
   - Individual toast notification UI component
   - Supports multiple variants: `info`, `success`, `warning`, `error`
   - Handles auto-dismiss, manual dismissal, and action buttons

2. **Toast Provider** (`src/components/ui/toast/toast-provider.tsx`)
   - Manages global toast state
   - Provides `useToast` hook for showing toasts from any component
   - Renders `ToastContainer` that displays all active toasts

3. **Toast Container**
   - Fixed positioning container (top-center by default)
   - Manages multiple simultaneous toasts
   - Handles animations and stacking

### File Structure

```
src/components/ui/toast/
├── index.tsx              # Main Toast component
├── toast-provider.tsx     # ToastProvider and useToast hook
├── toast.types.ts         # TypeScript type definitions
├── toast.styles.ts        # Style variants using CVA
├── toast.css              # Dark mode styles and animations
└── README.md              # Component documentation
```

## Setup

### 1. Add ToastProvider to Layout

The `ToastProvider` must wrap your application content to enable toast functionality:

```tsx
// app/(app)/[slug]/layout.tsx
import { ToastProvider } from '@/src/components/ui/toast';

export default function AppLayout({ children }) {
  return (
    <DeploymentProvider>
      <FamilyProvider>
        <BabyProvider>
          <TimezoneProvider>
            <ThemeProvider>
              <ToastProvider>
                <AppContent>{children}</AppContent>
              </ToastProvider>
            </ThemeProvider>
          </TimezoneProvider>
        </BabyProvider>
      </FamilyProvider>
    </DeploymentProvider>
  );
}
```

### 2. Basic Usage

Any component can show a toast using the `useToast` hook:

```tsx
import { useToast } from '@/src/components/ui/toast';

function MyComponent() {
  const { showToast } = useToast();

  const handleAction = () => {
    showToast({
      variant: 'success',
      message: 'Operation completed successfully!',
      duration: 3000
    });
  };

  return <button onClick={handleAction}>Do Something</button>;
}
```

## Toast API

### `showToast` Function

```typescript
showToast({
  variant?: 'info' | 'success' | 'warning' | 'error',  // Default: 'info'
  message: string,                                      // Required: Main message
  title?: string,                                       // Optional: Toast title
  duration?: number | null,                            // Auto-dismiss time (ms), null = no auto-dismiss
  dismissible?: boolean,                                // Default: true
  action?: {                                           // Optional: Action button
    label: string,
    onClick: () => void
  }
})
```

### Examples

#### Simple Info Toast
```tsx
showToast({
  variant: 'info',
  message: 'This is an informational message'
});
```

#### Success Toast with Title
```tsx
showToast({
  variant: 'success',
  title: 'Saved!',
  message: 'Your changes have been saved successfully.',
  duration: 3000
});
```

#### Warning Toast with Action Button
```tsx
showToast({
  variant: 'warning',
  title: 'Account Expired',
  message: 'Your subscription has expired. Please renew to continue.',
  duration: 6000,
  action: {
    label: 'Upgrade Now',
    onClick: () => {
      // Handle upgrade action
      window.dispatchEvent(new CustomEvent('openPaymentModal'));
    }
  }
});
```

#### Error Toast (Non-dismissible)
```tsx
showToast({
  variant: 'error',
  title: 'Error',
  message: 'Something went wrong. Please try again.',
  dismissible: true,
  duration: null  // Won't auto-dismiss
});
```

## Account Expiration Integration

### Overview

The toast system is integrated with the soft account expiration feature to provide user-friendly notifications when expired accounts attempt write operations.

### Implementation Pattern

When a write operation fails due to account expiration (403 error), the form should:

1. **Detect the expiration error** (403 status)
2. **Parse expiration information** from the API response
3. **Determine user type** (account user vs caretaker/system user)
4. **Show appropriate toast** based on user type

### Example: DiaperForm Implementation

```tsx
// src/components/forms/DiaperForm/index.tsx
import { useToast } from '@/src/components/ui/toast';

export default function DiaperForm({ ... }) {
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ... form validation ...

    const response = await fetch('/api/diaper-log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : '',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Check if this is an account expiration error
      if (response.status === 403) {
        const errorData = await response.json();
        const expirationInfo = errorData.data?.expirationInfo;
        
        // Determine user type from JWT token
        let isAccountUser = false;
        let isSysAdmin = false;
        try {
          const token = localStorage.getItem('authToken');
          if (token) {
            const payload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            isAccountUser = decodedPayload.isAccountAuth || false;
            isSysAdmin = decodedPayload.isSysAdmin || false;
          }
        } catch (error) {
          console.error('Error parsing JWT token:', error);
        }
        
        // Determine expiration type and message
        let variant: 'warning' | 'error' = 'warning';
        let title = 'Account Expired';
        let message = errorData.error || 'Your account has expired.';
        
        if (expirationInfo?.type === 'TRIAL_EXPIRED') {
          title = 'Free Trial Ended';
          message = isAccountUser 
            ? 'Your free trial has ended. Upgrade to continue tracking.'
            : 'The account owner\'s free trial has ended. Please contact them to upgrade.';
        } else if (expirationInfo?.type === 'PLAN_EXPIRED') {
          title = 'Subscription Expired';
          message = isAccountUser
            ? 'Your subscription has expired. Please renew to continue.'
            : 'The account owner\'s subscription has expired. Please contact them to renew.';
        } else if (expirationInfo?.type === 'NO_PLAN') {
          title = 'No Active Subscription';
          message = isAccountUser
            ? 'Subscribe now to continue tracking your baby\'s activities.'
            : 'The account owner needs to subscribe. Please contact them to upgrade.';
        }
        
        // Show toast notification with appropriate action
        if (isAccountUser && !isSysAdmin) {
          // Account user: show upgrade button that opens PaymentModal
          showToast({
            variant,
            title,
            message,
            duration: 6000,
            action: {
              label: 'Upgrade Now',
              onClick: () => {
                // Dispatch event to open PaymentModal (layout listens for this)
                window.dispatchEvent(new CustomEvent('openPaymentModal'));
              }
            }
          });
        } else {
          // Caretaker or system user: show message without upgrade button
          showToast({
            variant,
            title,
            message,
            duration: 6000,
            // No action button for caretakers
          });
        }
        
        // Don't close the form, let user see the error
        return;
      }
      
      // Handle other errors...
      throw new Error('Failed to save diaper log');
    }

    // Success handling...
  };
}
```

### Key Points

1. **User Type Detection**: Parse JWT token to determine if user is account owner or caretaker
2. **Conditional Messaging**: Different messages for account users vs caretakers
3. **Action Button**: Only show upgrade button for account users
4. **Event-Based Modal**: Use `openPaymentModal` event to trigger PaymentModal (see below)

## PaymentModal Integration

### Event-Based Architecture

The toast system integrates with PaymentModal using a custom event pattern:

1. **Toast dispatches event**: When account user clicks "Upgrade Now"
2. **Layout listens for event**: Opens PaymentModal when event is received
3. **Modal fetches account status**: Gets current subscription info
4. **User completes payment**: Modal handles Stripe checkout

### Layout Implementation

```tsx
// app/(app)/[slug]/layout.tsx
import PaymentModal from '@/src/components/account-manager/PaymentModal';

function AppContent({ children }) {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAccountStatus, setPaymentAccountStatus] = useState<any>(null);
  const [isAccountAuth, setIsAccountAuth] = useState<boolean>(false);

  // Listen for payment modal requests from child components
  useEffect(() => {
    const handleOpenPayment = () => {
      // Check if user is an account user before opening modal
      const authToken = localStorage.getItem('authToken');
      if (!authToken) return;
      
      try {
        const payload = authToken.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        const isAccountUser = decodedPayload.isAccountAuth || false;
        
        // Only open PaymentModal for account users
        if (!isAccountUser) {
          console.log('PaymentModal can only be opened by account users');
          return;
        }
      } catch (error) {
        console.error('Error parsing JWT token for payment modal:', error);
        return;
      }
      
      // Fetch account status for PaymentModal
      const fetchAccountStatusForPayment = async () => {
        try {
          const response = await fetch('/api/accounts/status', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setPaymentAccountStatus({
                accountStatus: data.data.accountStatus || 'active',
                planType: data.data.planType || null,
                subscriptionActive: data.data.subscriptionActive || false,
                trialEnds: data.data.trialEnds || null,
                planExpires: data.data.planExpires || null,
                subscriptionId: data.data.subscriptionId || null,
              });
              setShowPaymentModal(true);
            }
          }
        } catch (error) {
          console.error('Error fetching account status for payment modal:', error);
        }
      };
      
      fetchAccountStatusForPayment();
    };
    
    window.addEventListener('openPaymentModal', handleOpenPayment);
    return () => window.removeEventListener('openPaymentModal', handleOpenPayment);
  }, []);

  return (
    <>
      {/* ... other content ... */}
      
      {/* Payment Modal - can be opened from toast or other components */}
      {isAccountAuth && paymentAccountStatus && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          accountStatus={paymentAccountStatus}
          onPaymentSuccess={() => {
            setShowPaymentModal(false);
            // Refresh page to get updated subscription status
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
```

## Styling and Positioning

For detailed information about styling, positioning, animations, and component API, see the [Toast Component README](../src/components/ui/toast/README.md).

## Best Practices

### When to Use Toasts

✅ **Good Use Cases:**
- Account expiration warnings
- Form submission success/error messages
- Temporary status updates
- Non-critical notifications

❌ **Avoid Using Toasts For:**
- Critical errors that require immediate action
- Long-form messages (use modals instead)
- Information that needs to persist (use banners or inline messages)

### Duration Guidelines

- **Info**: 5000ms (5 seconds)
- **Success**: 3000ms (3 seconds)
- **Warning**: 6000ms (6 seconds) - longer for important warnings
- **Error**: 5000ms or `null` (no auto-dismiss) for critical errors

### User Type Handling

Always check user type when showing account-related toasts:

```tsx
// ✅ Good: Check user type
const isAccountUser = decodedPayload.isAccountAuth || false;
if (isAccountUser) {
  showToast({
    message: 'Your account has expired.',
    action: { label: 'Upgrade', onClick: handleUpgrade }
  });
} else {
  showToast({
    message: 'Please contact the account owner to upgrade.'
    // No action button
  });
}

// ❌ Bad: Assume all users can upgrade
showToast({
  message: 'Account expired.',
  action: { label: 'Upgrade', onClick: handleUpgrade }
});
```

## Applying to Other Forms

To add expiration handling to other forms (FeedForm, SleepForm, etc.), follow this pattern:

1. **Import useToast hook**
```tsx
import { useToast } from '@/src/components/ui/toast';
```

2. **Add error handling in submit handler**
```tsx
if (!response.ok && response.status === 403) {
  // Parse expiration error and show toast
  // (Copy pattern from DiaperForm)
}
```

3. **Check user type and show appropriate message**
   - Account users: Show upgrade button
   - Caretakers: Show contact owner message

## Testing

### Manual Testing Checklist

- [ ] Toast appears for expired account users
- [ ] Toast appears for caretakers (different message)
- [ ] "Upgrade Now" button opens PaymentModal (account users only)
- [ ] Toast auto-dismisses after duration
- [ ] Toast can be manually dismissed
- [ ] Multiple toasts stack correctly
- [ ] Dark mode styling works correctly
- [ ] Mobile responsive positioning works
- [ ] Toast doesn't block form interaction

### Test Scenarios

1. **Expired Account User**
   - Try to create log entry
   - Should see toast with "Upgrade Now" button
   - Clicking button should open PaymentModal

2. **Caretaker User**
   - Try to create log entry with expired account
   - Should see toast asking to contact account owner
   - No upgrade button should appear

3. **System Admin**
   - Should bypass expiration checks (not applicable)

## Troubleshooting

### Toast Not Appearing

- Check that `ToastProvider` wraps your component tree
- Verify `useToast` hook is called within provider context
- Check browser console for errors

### PaymentModal Not Opening

- Verify `openPaymentModal` event listener is set up in layout
- Check that user is account user (not caretaker)
- Verify account status API call succeeds
- Check browser console for errors

### Styling Issues

- Verify `toast.css` is imported in `toast-provider.tsx`
- Check that dark mode classes are applied correctly
- Verify Tailwind classes are available

## Related Documentation

- **Component Documentation**: `src/components/ui/toast/README.md`
- **Soft Expiration Implementation**: `documentation/soft-account-expiration-implementation.md`
- **Action List**: `documentation/soft-expiration-action-list.md`
- **Modal Approach**: `documentation/MODAL_APPROACH_SUMMARY.md`

## Future Enhancements

Potential improvements to consider:

1. **Toast Queue Management**: Limit number of simultaneous toasts
2. **Persistent Toasts**: Option to persist across page navigation
3. **Toast History**: Track and display recent toasts
4. **Custom Positions**: Allow configuring toast position per toast
5. **Rich Content**: Support for images, links, and formatted content

