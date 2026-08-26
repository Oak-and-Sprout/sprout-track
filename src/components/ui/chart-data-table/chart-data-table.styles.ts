/**
 * Styles for the ChartDataTable component
 *
 * The table is wrapped in a block-level element carrying Tailwind's
 * `sr-only` class. A block honors `sr-only`'s `height:1px`/`overflow:hidden`
 * and collapses to a 1px box, so it is visually hidden AND takes no layout
 * space, while remaining fully available to screen readers. (Applying
 * `sr-only` directly to a `<table>` fails: a table ignores `height:1px` and
 * sizes to its rows, so its absolutely-positioned box escapes and inflates
 * document height.)
 */
export const chartDataTableStyles = {
  wrapper: "sr-only",
} as const;
