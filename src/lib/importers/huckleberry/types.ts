export const HUCKLEBERRY_SOURCE_CHILD_ID = 'huckleberry-care-log';

export type HuckleberryCsvRow = Readonly<Record<string, string>>;

export interface HuckleberryParsedCsv {
  readonly headers: readonly string[];
  readonly rows: readonly HuckleberryCsvRow[];
}

export type HuckleberryWarningCode =
  | 'unsupported-activity-type'
  | 'both-breasts-without-side'
  | 'pumping-duration-unavailable'
  | 'bottle-amount-missing'
  | 'unmappable-row';

export interface HuckleberryImportWarning {
  readonly code: HuckleberryWarningCode;
  readonly entityType: string;
  readonly affectedRows: number;
}

export interface HuckleberryPreviewDetails {
  readonly children: readonly [{
    readonly sourceId: typeof HUCKLEBERRY_SOURCE_CHILD_ID;
    readonly firstName: string;
    readonly lastName: string;
    readonly activityOnly: true;
  }];
  readonly unitRequirements: readonly [];
}
