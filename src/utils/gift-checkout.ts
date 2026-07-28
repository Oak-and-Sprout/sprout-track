// Starts a Stripe checkout for a gift lifetime license. On success the
// browser navigates away; on failure the returned string is a
// translation-key error message for the caller to display.
export async function startGiftCheckout(email?: string): Promise<string | null> {
  try {
    const response = await fetch('/api/gift-codes/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(email ? { email } : {}),
    });
    const data = await response.json();
    if (data.success && data.data?.url) {
      window.location.href = data.data.url;
      return null;
    }
    return data.error || 'Failed to start checkout. Please try again.';
  } catch {
    return 'Failed to start checkout. Please try again.';
  }
}
