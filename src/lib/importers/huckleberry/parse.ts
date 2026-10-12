import { parse } from 'csv-parse/sync';
import {
  HuckleberryCsvRow,
  HuckleberryParsedCsv,
} from './types';

function normaliseHeader(value: unknown): string {
  return String(value).trim().toLowerCase();
}

function readHeaderOnly(content: string): string[] {
  const records = parse(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    to_line: 1,
  }) as unknown[][];

  if (records.length === 0) {
    throw new Error('CSV file does not contain a header row');
  }

  return records[0].map(normaliseHeader);
}

export function parseHuckleberryCsv(
  content: string,
): HuckleberryParsedCsv {
  const records = parse(content, {
    bom: true,
    columns: headers => headers.map(normaliseHeader),
    relax_column_count: false,
    skip_empty_lines: true,
    trim: false,
  }) as Record<string, unknown>[];

  const rows: HuckleberryCsvRow[] = records.map(record =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        value === null || value === undefined ? '' : String(value),
      ]),
    ),
  );

  return {
    headers: rows.length > 0 ? Object.keys(rows[0]) : readHeaderOnly(content),
    rows,
  };
}
