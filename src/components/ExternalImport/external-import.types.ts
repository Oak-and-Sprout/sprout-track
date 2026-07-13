import {
  ExternalImportPreview,
} from '@/src/types/external-import';

export interface ExternalImportProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

export interface ExternalImportPreviewResponse {
  readonly preview: ExternalImportPreview;
  readonly details: unknown;
  readonly warnings: readonly unknown[];
}
