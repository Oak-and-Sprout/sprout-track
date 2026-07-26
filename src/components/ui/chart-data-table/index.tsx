import * as React from "react";
import { cn } from "@/src/lib/utils";
import { chartDataTableStyles } from "./chart-data-table.styles";
import { ChartDataTableProps } from "./chart-data-table.types";
import "./chart-data-table.css";

/**
 * ChartDataTable component
 *
 * A screen-reader-only data table that provides an accessible text
 * alternative for charts. The table is wrapped in Tailwind's `sr-only`
 * class, so it is invisible and takes no layout space — rendering it
 * beside a chart causes zero visual change.
 *
 * All strings (caption, column labels, cell values) must be localized
 * by the caller before being passed in.
 *
 * @example
 * ```tsx
 * <ChartDataTable
 *   caption={t('Weight Over Time')}
 *   columns={[
 *     { key: 'date', label: t('Date') },
 *     { key: 'value', label: t('Weight') },
 *   ]}
 *   rows={data.map((point) => ({ date: point.label, value: point.value }))}
 * />
 * ```
 */
const ChartDataTable: React.FC<ChartDataTableProps> = ({
  caption,
  columns,
  rows,
  className,
}) => {
  return (
    <table className={cn(chartDataTableStyles.table, className)}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column.key}>{String(row[column.key] ?? "")}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

ChartDataTable.displayName = "ChartDataTable";

export { ChartDataTable };
export default ChartDataTable;
