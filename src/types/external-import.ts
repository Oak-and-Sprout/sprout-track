export interface ExternalImportProvider {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly acceptedExtensions: readonly string[];
  readonly supportsMultipleFiles: boolean;
}
