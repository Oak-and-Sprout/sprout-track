# ChartDataTable

A screen-reader-only data table that provides an accessible text alternative for charts (e.g., Recharts line/bar charts, which are not meaningfully navigable by screen readers).

The entire table is wrapped in Tailwind's `sr-only` class, so it is visually hidden and occupies no layout space. Rendering it alongside a chart produces **zero visual change** while giving screen-reader users access to the underlying data.

## Usage

```tsx
import { ChartDataTable } from '@/src/components/ui/chart-data-table';
import { useLocalization } from '@/src/context/localization';

const { t } = useLocalization();

<ChartDataTable
  caption={t('Weight Over Time')}
  columns={[
    { key: 'date', label: t('Date') },
    { key: 'value', label: t('Weight') },
  ]}
  rows={data.map((point) => ({ date: point.label, value: formatValue(point.value) }))}
/>
```

Render it as a sibling of the chart (typically only when the data set is non-empty).

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `caption` | `string` | Yes | Table caption describing the chart. Must be localized by the caller. |
| `columns` | `Array<{ key: string; label: string }>` | Yes | Ordered column definitions. `key` looks up the cell value in each row; `label` is the column header (localized by the caller). Headers render as `<th scope="col">`. |
| `rows` | `Array<Record<string, string \| number \| null \| undefined>>` | Yes | Row data keyed by column key. Values render via `String(value ?? '')`, so `null`/`undefined` become empty cells. |
| `className` | `string` | No | Additional class name merged onto the `<table>`. |

## Implementation details

- Renders a semantic `<table>` with `<caption>`, `<thead>` (one `<th scope="col">` per column), and `<tbody>`.
- Hidden via Tailwind's `sr-only` utility (see `chart-data-table.styles.ts`) — not `display: none` or `aria-hidden`, so assistive technology can still read it.
- Pre-format values (units, durations, dates) before passing them in — the component does not format, it only stringifies.
- No dark mode CSS is needed because the component is never visible; `chart-data-table.css` exists only to follow the component folder convention.
- No interactive elements; the table is purely informational.

## Accessibility

- The `<caption>` gives screen readers context about what the data represents.
- `scope="col"` on header cells lets screen readers announce the column header with each cell value.
- Because the table is a real DOM table (not ARIA emulation), all table navigation commands work in screen readers.
