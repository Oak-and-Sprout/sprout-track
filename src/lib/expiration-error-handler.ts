/**
 * Utility function for handling account expiration errors in forms
 * 
 * This function centralizes the logic for detecting and displaying account expiration errors,
 * reducing code duplication across forms and making it easier to maintain and update messages.
 * 
 * @param response - The fetch Response object from the API call (must be a 403 error)
 * @param showToast - The showToast function from useToast hook
 * @param context - Optional context string for customizing messages (e.g., "managing contacts", "tracking baths")
 * @returns Promise<{ isExpirationError: boolean; errorData?: any }> - Returns object with isExpirationError flag and parsed errorData
 * 
 * @example
 * ```tsx
 * import { useToast } from '@/src/components/ui/toast';
 * import { handleExpirationError } from '@/src/lib/expiration-error-handler';
 * 
 * const { showToast } = useToast();
 * 
 * const response = await fetch('/api/some-endpoint', { ... });
 * if (!response.ok) {
 *   if (response.status === 403) {
 *     const { isExpirationError, errorData } = await handleExpirationError(response, showToast, 'managing contacts');
 *     if (isExpirationError) {
 *       return; // Don't close form on expiration error
 *     }
 *     // Use errorData for other 403 errors if needed
 *   }
 *   // Handle other errors...
 * }
 * ```
 */
export async function handleExpirationError(
  response: Response,
  showToast: (props: {
    variant?: 'info' | 'success' | 'warning' | 'error';
    message: string;
    title?: string;
    duration?: number | null;
    dismissible?: boolean;
    action?: {
      label: string;
      onClick: () => void;
    };
  }) => void,
  context?: string
): Promise<{ isExpirationError: boolean; errorData?: any }> {
  // Only handle 403 errors (account expiration)
  if (response.status !== 403) {
    return { isExpirationError: false };
  }

  const errorData = await response.json();
  const expirationInfo = errorData.data?.expirationInfo;

  // If there's no expiration info, it's not an expiration error
  if (!expirationInfo) {
    return { isExpirationError: false, errorData };
  }

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
  let message = errorData.error || 'Your account has expired. Please upgrade to continue.';

  // Build context-specific message suffix
  const contextSuffix = context ? ` ${context}` : '';

  if (expirationInfo?.type === 'TRIAL_EXPIRED') {
    title = 'Free Trial Ended';
    message = isAccountUser
      ? `Your free trial has ended. Upgrade to continue${contextSuffix}.`
      : `The account owner's free trial has ended. Please contact them to upgrade.`;
  } else if (expirationInfo?.type === 'PLAN_EXPIRED') {
    title = 'Subscription Expired';
    message = isAccountUser
      ? `Your subscription has expired. Please renew to continue${contextSuffix}.`
      : `The account owner's subscription has expired. Please contact them to renew.`;
  } else if (expirationInfo?.type === 'NO_PLAN') {
    title = 'No Active Subscription';
    message = isAccountUser
      ? `Subscribe now to continue${contextSuffix}.`
      : `The account owner needs to subscribe. Please contact them to upgrade.`;
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
        },
      },
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

  return { isExpirationError: true, errorData };
}

