# PhotoQuotaMeter

A compact visual storage meter displaying family photo quota usage. Shows used and total storage in GB alongside a graphical progress bar with color indication (teal for normal, amber for >80%).

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `usedBytes` | `number` | Yes | Storage used in bytes |
| `totalBytes` | `number` | Yes | Total quota limit in bytes |
| `variant` | `'light' \| 'dark'` | No | Visual variant: 'light' (default) for standard UI, 'dark' for light-on-dark gallery hero header |
| `className` | `string` | No | Additional CSS classes |

## Features

- Displays usage as "2.4 GB of 5 GB used • 48%"
- Progress bar with gradient fill (teal to emerald normal, amber warning at >80%)
- Accessible `progressbar` role with `aria-valuenow/min/max`
- Dark mode support via `html.dark` CSS overrides for light variant
- Uses localized text for "GB of" and "GB used"

## Usage

```tsx
import { PhotoQuotaMeter } from '@/src/components/ui/photo-quota-meter';

export function GalleryHeader({ usedBytes, totalBytes }) {
  return (
    <PhotoQuotaMeter 
      usedBytes={usedBytes}
      totalBytes={totalBytes}
      variant="light"
    />
  );
}
```

Light variant with dark mode support (light variant applies `photo-quota-meter` class for dark-mode CSS selectors):

```tsx
<PhotoQuotaMeter 
  usedBytes={usedBytes}
  totalBytes={totalBytes}
  variant="light"
/>
```

Dark variant for gallery hero (light-on-dark, no CSS class applied):

```tsx
<PhotoQuotaMeter 
  usedBytes={usedBytes}
  totalBytes={totalBytes}
  variant="dark"
/>
```
