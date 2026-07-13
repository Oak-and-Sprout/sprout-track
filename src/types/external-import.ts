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
