import {
  ExternalImportExecutionConfiguration,
  ExternalImportFile,
  ExternalImportPreview,
  ExternalImportRecord,
} from '@/src/types/external-import';
import {
  analyseBabyBuddyFiles,
  babyBuddyPreviewer,
  buildBabyBuddyImportRecords,
  collectBabyBuddyWarnings,
  BabyBuddyExecutionConfiguration,
  BabyBuddyImportWarning,
  BabyBuddyPreviewDetails,
} from './baby-buddy';
import {
  analyseHuckleberryFiles,
  buildHuckleberryImportRecords,
  collectHuckleberryWarnings,
  huckleberryPreviewer,
  HUCKLEBERRY_SOURCE_CHILD_ID,
  HuckleberryImportWarning,
  HuckleberryPreviewDetails,
} from './huckleberry';

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

  buildRecords(
    files: readonly ExternalImportFile[],
    configuration: unknown,
    execution: ExternalImportExecutionConfiguration,
  ): readonly ExternalImportRecord[];
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseBabyBuddyConfiguration(
  value: unknown,
): BabyBuddyExecutionConfiguration {
  if (!isObject(value)) {
    throw new Error(
      'Baby Buddy import configuration must be an object',
    );
  }

  return {
    feedingUnit:
      value.feedingUnit === 'ML' ||
      value.feedingUnit === 'OZ' ||
      value.feedingUnit === 'SKIP'
        ? value.feedingUnit
        : undefined,

    pumpingUnit:
      value.pumpingUnit === 'ML' ||
      value.pumpingUnit === 'OZ'
        ? value.pumpingUnit
        : undefined,

    heightUnit:
      value.heightUnit === 'cm' ||
      value.heightUnit === 'in'
        ? value.heightUnit
        : undefined,

    weightUnit:
      value.weightUnit === 'kg' ||
      value.weightUnit === 'lb'
        ? value.weightUnit
        : undefined,

    headCircumferenceUnit:
      value.headCircumferenceUnit === 'cm' ||
      value.headCircumferenceUnit === 'in'
        ? value.headCircumferenceUnit
        : undefined,

    temperatureUnit:
      value.temperatureUnit === '°C' ||
      value.temperatureUnit === '°F'
        ? value.temperatureUnit
        : undefined,
  };
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

  buildRecords(files, configuration) {
    return buildBabyBuddyImportRecords(
      files,
      parseBabyBuddyConfiguration(configuration),
    );
  },
};

const huckleberryRuntimeProvider: ExternalImportRuntimeProvider = {
  id: 'huckleberry',

  previewFiles(files) {
    return {
      preview: huckleberryPreviewer.previewFiles(files),
      details: analyseHuckleberryFiles(files),
      warnings: collectHuckleberryWarnings(files),
    } satisfies {
      preview: ExternalImportPreview;
      details: HuckleberryPreviewDetails;
      warnings: readonly HuckleberryImportWarning[];
    };
  },

  buildRecords(files, _configuration, execution) {
    const destination = execution.childDestinations[HUCKLEBERRY_SOURCE_CHILD_ID];
    return buildHuckleberryImportRecords(
      files,
      destination?.mode === 'existing' ? destination.targetBabyId : '',
    );
  },
};

const runtimeProviders: readonly ExternalImportRuntimeProvider[] = [
  babyBuddyRuntimeProvider,
  huckleberryRuntimeProvider,
];

export function getExternalImportRuntimeProvider(
  providerId: string,
): ExternalImportRuntimeProvider | undefined {
  return runtimeProviders.find(
    provider => provider.id === providerId,
  );
}
