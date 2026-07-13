export interface ExternalImportProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly acceptedExtensions: readonly string[];
  readonly supportsMultipleFiles: boolean;
}

export interface ExternalImportFile {
  readonly name: string;
  readonly content: string;
}

export type ExternalImportDetectionStatus =
  | 'detected'
  | 'unsupported'
  | 'invalid';

export interface ExternalImportFileDetection {
  readonly fileName: string;
  readonly status: ExternalImportDetectionStatus;
  readonly entityType?: string;
  readonly headers: readonly string[];
  readonly error?: string;
}

export interface ExternalImportDetector {
  detectFiles(
    files: readonly ExternalImportFile[],
  ): readonly ExternalImportFileDetection[];
}

export interface ExternalImportPreviewFile {
  readonly fileName: string;
  readonly status: ExternalImportDetectionStatus;
  readonly entityType?: string;
  readonly rowCount: number;
  readonly headers: readonly string[];
  readonly error?: string;
}

export interface ExternalImportPreview {
  readonly providerId: string;
  readonly files: readonly ExternalImportPreviewFile[];
  readonly totalRows: number;
  readonly ready: boolean;
  readonly warnings: readonly string[];
}

export interface ExternalImportPreviewer {
  previewFiles(
    files: readonly ExternalImportFile[],
  ): ExternalImportPreview;
}

export interface ExternalImportSource {
  readonly providerId: string;
  readonly entityType: string;
  readonly recordId: string;
  readonly childId?: string;
}

export interface ExternalImportBabyRecord {
  readonly targetType: 'baby';
  readonly source: ExternalImportSource;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;
}

export interface ExternalImportSleepRecord {
  readonly targetType: 'sleep';
  readonly source: ExternalImportSource;
  readonly sourceChildId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly type: 'NAP' | 'NIGHT_SLEEP';
}

export interface ExternalImportNoteRecord {
  readonly targetType: 'note';
  readonly source: ExternalImportSource;
  readonly sourceChildId: string;
  readonly time: string;
  readonly content: string;
}

export type ExternalImportRecord =
  | ExternalImportBabyRecord
  | ExternalImportSleepRecord
  | ExternalImportNoteRecord
  | ExternalImportFeedRecord
  | ExternalImportDiaperRecord;

export interface ExternalImportFeedRecord {
  readonly targetType: 'feed';
  readonly source: ExternalImportSource;
  readonly sourceChildId: string;
  readonly time: string;
  readonly type: 'BREAST' | 'BOTTLE' | 'SOLIDS';
  readonly startTime?: string;
  readonly endTime?: string;
  readonly feedDuration?: number;
  readonly side?: 'LEFT' | 'RIGHT';
  readonly amount?: number;
  readonly unitAbbr?: 'ML' | 'OZ';
  readonly food?: string;
  readonly notes?: string;
  readonly bottleType?: 'Formula' | 'Breast Milk' | 'Other';
}

export interface ExternalImportDiaperRecord {
  readonly targetType: 'diaper';
  readonly source: ExternalImportSource;
  readonly sourceChildId: string;
  readonly time: string;
  readonly type: 'WET' | 'DIRTY' | 'BOTH';
  readonly color?: 'YELLOW' | 'BROWN' | 'GREEN' | 'BLACK';
}

export type ExternalImportFeedingAmountUnit =
  | 'ML'
  | 'OZ'
  | 'SKIP';
