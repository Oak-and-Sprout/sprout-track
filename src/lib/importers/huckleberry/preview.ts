import {
  ExternalImportFile,
  ExternalImportPreview,
  ExternalImportPreviewer,
} from '@/src/types/external-import';
import { huckleberryDetector } from './detect';
import { mapHuckleberryRows } from './map';
import { parseHuckleberryCsv } from './parse';

// Count rows that will actually import, so "ready" matches what execute does.
// The record scope only affects IDs, which the preview does not use.
function supportedRowCount(content: string): number {
  return mapHuckleberryRows(parseHuckleberryCsv(content).rows, 'preview').records.length;
}

function previewFiles(
  files: readonly ExternalImportFile[],
): ExternalImportPreview {
  const detections = huckleberryDetector.detectFiles(files);
  const previewFiles = detections.map((detection, index) => {
    if (detection.status !== 'detected') {
      return { ...detection, rowCount: 0 };
    }

    try {
      return {
        ...detection,
        rowCount: supportedRowCount(files[index].content),
      };
    } catch (error) {
      return {
        fileName: detection.fileName,
        status: 'invalid' as const,
        entityType: detection.entityType,
        rowCount: 0,
        headers: detection.headers,
        error: error instanceof Error ? error.message : 'Unable to parse CSV file',
      };
    }
  });
  const totalRows = previewFiles.reduce(
    (total, file) => total + (file.status === 'detected' ? file.rowCount : 0),
    0,
  );

  return {
    providerId: 'huckleberry',
    files: previewFiles,
    totalRows,
    ready:
      files.length === 1 &&
      previewFiles.length === 1 &&
      previewFiles[0].status === 'detected' &&
      totalRows > 0,
    warnings: files.length > 1
      ? ['Huckleberry imports accept one care log export at a time']
      : [],
  };
}

export const huckleberryPreviewer: ExternalImportPreviewer = { previewFiles };
