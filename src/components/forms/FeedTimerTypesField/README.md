# FeedTimerTypesField

Checkbox group used in baby forms to select which feed types reset the baby's
"time since last feed" timer (issue #225).

## File Structure

- `index.tsx` — component implementation
- `feed-timer-types-field.styles.ts` — light-mode Tailwind styles
- `feed-timer-types-field.css` — dark-mode overrides (`html.dark` selectors)
- `feed-timer-types-field.types.ts` — prop types

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `FeedTimerCategory[]` | Currently selected categories. All categories selected = every feed counts (stored as `null`). |
| `onChange` | `(value: FeedTimerCategory[]) => void` | Called with the updated selection. |
| `idPrefix` | `string` (optional) | Prefix for input ids/labels; defaults to a per-instance `useId`. |

## Behavior

- One checkbox per category: breast feeds, breast milk bottles, formula
  bottles, other bottles, solids.
- At least one category must remain selected — the last checked checkbox is
  disabled.
- Mixed `Formula/Breast` bottles count under both the breast-milk and formula
  categories (see `src/utils/feedTimerConfig.ts`).

## Usage

```tsx
import FeedTimerTypesField from '@/src/components/forms/FeedTimerTypesField';
import { FEED_TIMER_CATEGORIES, parseFeedTimerTypes } from '@/src/utils/feedTimerConfig';

// form state: FeedTimerCategory[] (default: [...FEED_TIMER_CATEGORIES])
<FeedTimerTypesField
  value={formData.feedTimerTypes}
  onChange={(feedTimerTypes) => setFormData({ ...formData, feedTimerTypes })}
/>
```

When submitting, send `null` when every category is selected, otherwise the
JSON-stringified array:

```ts
feedTimerTypes: formData.feedTimerTypes.length === FEED_TIMER_CATEGORIES.length
  ? null
  : JSON.stringify(formData.feedTimerTypes)
```
