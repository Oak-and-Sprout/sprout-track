/**
 * Column definition for the ChartDataTable component
 */
export interface ChartDataTableColumn {
  /**
   * Key used to look up the cell value in each row object
   */
  key: string;

  /**
   * Column header text (already localized by the caller)
   */
  label: string;
}

/**
 * Props for the ChartDataTable component
 */
export interface ChartDataTableProps {
  /**
   * Table caption describing the chart the table represents
   * (already localized by the caller)
   */
  caption: string;

  /**
   * Ordered column definitions
   */
  columns: ChartDataTableColumn[];

  /**
   * Row data — each row is a record keyed by column key.
   * Values are rendered via String(value ?? '').
   */
  rows: Array<Record<string, string | number | null | undefined>>;

  /**
   * Optional additional class name
   */
  className?: string;
}
