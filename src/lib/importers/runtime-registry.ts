import {
  ExternalImportFile,
  ExternalImportPreview,
} from '@/src/types/external-import';
import {
  analyseBabyBuddyFiles,
  babyBuddyPreviewer,
  collectBabyBuddyWarnings,
  BabyBuddyImportWarning,
  BabyBuddyPreviewDetails,
} from './baby-buddy';

export interface ExternalImportProviderPreview {
  readonly preview: ExternalImportPreview;
  readonly details: unknown;
  readonly warnings: readonly unknown[];
}

export interface ExternalImportRuntimeProvider {
  readonly id: string;
  previewFiles(
    files: readonly ExternalImportFile[],
  ): ExternalImportProviderPreview;
}

const babyBuddyRuntimeProvider: ExternalImportRuntimeProvider = {
  id: 'baby-buddy',

  previewFiles(files) {
    return {
      preview: babyBuddyPreviewer.previewFiles(files),
      details: analyseBabyBuddyFiles(files),
      warnings: collectBabyBuddyWarnings(files),
    } satisfies {
      preview: ExternalImportPreview;
      details: BabyBuddyPreviewDetails;
      warnings: readonly BabyBuddyImportWarning[];
    };
  },
};

const runtimeProviders: readonly ExternalImportRuntimeProvider[] = [
  babyBuddyRuntimeProvider,
];

export function getExternalImportRuntimeProvider(
  providerId: string,
): ExternalImportRuntimeProvider | undefined {
  return runtimeProviders.find(
    provider => provider.id === providerId,
  );
}
