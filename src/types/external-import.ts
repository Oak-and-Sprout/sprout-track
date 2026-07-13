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
