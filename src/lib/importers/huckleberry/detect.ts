import {
  ExternalImportDetector,
  ExternalImportFile,
  ExternalImportFileDetection,
} from '@/src/types/external-import';
import { parseHuckleberryCsv } from './parse';

const requiredHeaders = [
  'type',
  'start',
  'end',
  'duration',
  'start condition',
  'start location',
  'end condition',
  'notes',
  'logged by',
] as const;

function detectFile(
  file: ExternalImportFile,
): ExternalImportFileDetection {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return {
      fileName: file.name,
      status: 'unsupported',
      headers: [],
      error: 'Only CSV files are supported',
    };
  }

  try {
    const { headers } = parseHuckleberryCsv(file.content);
    const headerSet = new Set(headers);

    if (!requiredHeaders.every(header => headerSet.has(header))) {
      return {
        fileName: file.name,
        status: 'unsupported',
        headers,
        error: 'CSV headers do not match a Huckleberry care log export',
      };
    }

    return {
      fileName: file.name,
      status: 'detected',
      entityType: 'care-log',
      headers,
    };
  } catch (error) {
    return {
      fileName: file.name,
      status: 'invalid',
      headers: [],
      error: error instanceof Error ? error.message : 'Unable to parse CSV file',
    };
  }
}

export const huckleberryDetector: ExternalImportDetector = {
  detectFiles(files) {
    return files.map(detectFile);
  },
};
