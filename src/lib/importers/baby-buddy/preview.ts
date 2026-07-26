import {
  ExternalImportFile,
  ExternalImportPreview,
  ExternalImportPreviewer,
} from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import { parseBabyBuddyCsv } from './parse';

function previewFiles(
  files: readonly ExternalImportFile[],
): ExternalImportPreview {
  const detections = babyBuddyDetector.detectFiles(files);

  const previewFiles = detections.map((detection, index) => {
    if (detection.status !== 'detected') {
      return {
        ...detection,
        rowCount: 0,
      };
    }

    try {
      const parsed = parseBabyBuddyCsv(files[index].content);

      return {
        ...detection,
        rowCount: parsed.rows.length,
      };
    } catch (error) {
      return {
        fileName: detection.fileName,
        status: 'invalid' as const,
        entityType: detection.entityType,
        rowCount: 0,
        headers: detection.headers,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to parse CSV file',
      };
    }
  });

  const detectedEntityTypes = previewFiles
    .filter(file => file.status === 'detected')
    .map(file => file.entityType)
    .filter((entityType): entityType is string =>
      Boolean(entityType),
    );

  const duplicateEntityTypes = detectedEntityTypes.filter(
    (entityType, index) =>
      detectedEntityTypes.indexOf(entityType) !== index,
  );

  const uniqueDuplicateEntityTypes = Array.from(
    new Set(duplicateEntityTypes),
  );

  const warnings = uniqueDuplicateEntityTypes.map(
    entityType =>
      `Multiple ${entityType} exports were uploaded`,
  );

  const totalRows = previewFiles.reduce(
    (total, file) =>
      file.status === 'detected'
        ? total + file.rowCount
        : total,
    0,
  );

  return {
    providerId: 'baby-buddy',
    files: previewFiles,
    totalRows,
    ready:
      previewFiles.length > 0 &&
      previewFiles.every(file => file.status === 'detected'),
    warnings,
  };
}

export const babyBuddyPreviewer: ExternalImportPreviewer = {
  previewFiles,
};
