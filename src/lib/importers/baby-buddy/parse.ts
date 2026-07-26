import { parse } from 'csv-parse/sync';

export type BabyBuddyCsvRow = Readonly<Record<string, string>>;

export interface BabyBuddyParsedCsv {
  readonly headers: readonly string[];
  readonly rows: readonly BabyBuddyCsvRow[];
}

export function parseBabyBuddyCsv(
  content: string,
): BabyBuddyParsedCsv {
  const records = parse(content, {
    bom: true,
    columns: header =>
      header.map((value: unknown) =>
        String(value).trim().toLowerCase(),
      ),
    relax_column_count: false,
    skip_empty_lines: true,
    trim: false,
  }) as Record<string, unknown>[];

  const rows = records.map(record =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        key,
        value === null || value === undefined
          ? ''
          : String(value),
      ]),
    ),
  );

  return {
    headers: rows.length > 0
      ? Object.keys(rows[0])
      : readHeaderOnly(content),
    rows,
  };
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

  return records[0].map(value =>
    String(value).trim().toLowerCase(),
  );
}
