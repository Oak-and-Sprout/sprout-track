import { parse } from 'csv-parse/sync';
import {
  ExternalImportDetector,
  ExternalImportFile,
  ExternalImportFileDetection,
} from '@/src/types/external-import';

const entitySignatures = [
  {
    entityType: 'bmi',
    requiredHeaders: ['id', 'child_id', 'bmi', 'date'],
  },
  {
    entityType: 'child',
    requiredHeaders: ['id', 'first_name', 'last_name', 'birth_date'],
  },
  {
    entityType: 'diaper-change',
    requiredHeaders: ['id', 'child_id', 'time', 'wet', 'solid'],
  },
  {
    entityType: 'feeding',
    requiredHeaders: [
      'id',
      'child_id',
      'start',
      'end',
      'type',
      'method',
      'amount',
    ],
  },
  {
    entityType: 'head-circumference',
    requiredHeaders: [
      'id',
      'child_id',
      'head_circumference',
      'date',
    ],
  },
  {
    entityType: 'height',
    requiredHeaders: ['id', 'child_id', 'height', 'date'],
  },
  {
    entityType: 'note',
    requiredHeaders: ['id', 'child_id', 'note', 'time'],
  },
  {
    entityType: 'pumping',
    requiredHeaders: [
      'id',
      'child_id',
      'start',
      'end',
      'amount',
    ],
  },
  {
    entityType: 'sleep',
    requiredHeaders: [
      'id',
      'child_id',
      'start',
      'end',
      'nap',
    ],
  },
  {
    entityType: 'tag',
    requiredHeaders: ['id', 'name', 'color'],
  },
  {
    entityType: 'temperature',
    requiredHeaders: [
      'id',
      'child_id',
      'temperature',
      'time',
    ],
  },
  {
    entityType: 'tummy-time',
    requiredHeaders: [
      'id',
      'child_id',
      'start',
      'end',
      'milestone',
    ],
  },
  {
    entityType: 'weight',
    requiredHeaders: ['id', 'child_id', 'weight', 'date'],
  },
] as const;

function readHeaders(content: string): string[] {
  const records = parse(content, {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
    to_line: 1,
  }) as unknown[][];

  if (records.length === 0) {
    throw new Error('CSV file does not contain a header row');
  }

  return records[0].map(header =>
    String(header).trim().toLowerCase(),
  );
}

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
    const headers = readHeaders(file.content);
    const headerSet = new Set(headers);

    const signature = entitySignatures.find(candidate =>
      candidate.requiredHeaders.every(header =>
        headerSet.has(header),
      ),
    );

    if (!signature) {
      return {
        fileName: file.name,
        status: 'unsupported',
        headers,
        error: 'CSV headers do not match a supported Baby Buddy export',
      };
    }

    return {
      fileName: file.name,
      status: 'detected',
      entityType: signature.entityType,
      headers,
    };
  } catch (error) {
    return {
      fileName: file.name,
      status: 'invalid',
      headers: [],
      error:
        error instanceof Error
          ? error.message
          : 'Unable to parse CSV file',
    };
  }
}

export const babyBuddyDetector: ExternalImportDetector = {
  detectFiles(files) {
    return files.map(detectFile);
  },
};
