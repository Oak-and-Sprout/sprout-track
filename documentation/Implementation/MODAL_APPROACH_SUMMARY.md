# Modal-Based Upgrade Approach - Key Changes Summary

## Overview
Use existing `PaymentModal` component (`src/components/account-manager/PaymentModal.tsx`) instead of creating new components or routing to billing pages.

## Key Changes to Implementation Plan

### ✅ Phase 1.3 - Write Protection Middleware
**CHANGE**: Remove `upgradeUrl` from API response
```typescript
// Return this:
expirationInfo: {
  type: expirationInfo.type,
  date: expirationInfo.date,
  familySlug: expirationInfo.familySlug  // NO upgradeUrl
}
```

### ✅ Phase 1.7 - API Response Types
**CHANGE**: Remove `upgradeUrl` from type definition
```typescript
expirationInfo?: {
  type: 'TRIAL_EXPIRED' | 'PLAN_EXPIRED' | 'NO_PLAN' | 'CLOSED';
  date?: string;
  familySlug?: string;  // NO upgradeUrl
};
```

### ✅ Phase 3.1E - NEW: Integrate PaymentModal in Layout
**ADD**: New section in layout.tsx
- Import `PaymentModal` component
- Add `showPaymentModal` state
- Auto-open on first load after login (if expired)
- Listen for `openPaymentModal` event
- Handle 403 errors by opening modal
- Add `<PaymentModal>` JSX before `</body>`

### ✅ Phase 3.2 - Account Expiration Banner
**CHANGE**: Use callback instead of routing
- Remove `familySlug` prop
- Remove `useRouter` import
- Add `onUpgradeClick: () => void` callback prop
- Call `onUpgradeClick()` instead of `router.push()`

### ✅ Phase 3.3 - Add Banner to Layout
**CHANGE**: Pass callback to open modal
```typescript
<AccountExpirationBanner
  type={accountExpirationStatus.type || 'NO_PLAN'}
  expirationDate={accountExpirationStatus.expirationDate}
  onUpgradeClick={() => setShowPaymentModal(true)}  // Open modal
/>
```

### ✅ Phase 4.1 - DO NOT CREATE UpgradePromptModal
**SKIP**: Do not create separate `UpgradePromptModal` component
**USE**: Existing `PaymentModal` via events

### ✅ Phase 4.3 - Form Components
**CHANGE**: Dispatch event instead of managing modal state
```typescript
// When expired user tries to submit:
if (isExpired) {
  window.dispatchEvent(new CustomEvent('openPaymentModal'));
  return;
}
```

## Event-Based Architecture

### Events:
1. `openPaymentModal` - Opens payment modal from any component
2. `apiError` - Dispatched on 403 errors (also opens modal)
3. `authError` - Dispatched on 401 errors (triggers logout)

### Usage Pattern:
```typescript
// Any component can trigger modal:
window.dispatchEvent(new CustomEvent('openPaymentModal'));

// Layout listens and opens modal:
useEffect(() => {
  const handler = () => setShowPaymentModal(true);
  window.addEventListener('openPaymentModal', handler);
  return () => window.removeEventListener('openPaymentModal', handler);
}, []);
```

## Components Summary

| Component | Action |
|-----------|--------|
| `PaymentModal` | ✅ **Already exists** - Use as-is |
| `AccountExpirationBanner` | ✅ **Create** - With callback prop |
| `ReadOnlyBadge` | ✅ **Create** - No changes from original plan |
| `UpgradePromptModal` | ❌ **DO NOT CREATE** - Use PaymentModal instead |

## Testing Updates

Remove assertions for:
- `upgradeUrl` in API responses
- Routing to billing page
- Separate modal state in forms

Add assertions for:
- `openPaymentModal` event dispatching
- Modal state in layout
- Event listeners working correctly

## Benefits

1. ✅ Simpler - Fewer components, less code
2. ✅ Faster - No page navigation
3. ✅ Reusable - One payment UI everywhere
4. ✅ Maintainable - Single source of truth
5. ✅ Better UX - Modal on same page

## Quick Reference for Implementation

When you see in docs: **"navigate to billing page"** or **"router.push(upgradeUrl)"**
→ Replace with: **"open PaymentModal"** via `setShowPaymentModal(true)` or dispatch `openPaymentModal` event

When you see: **"create UpgradePromptModal"**
→ Skip it, use existing `PaymentModal` instead
