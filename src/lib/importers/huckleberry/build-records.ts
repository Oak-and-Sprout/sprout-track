import {
  ExternalImportFile,
  ExternalImportRecord,
} from '@/src/types/external-import';
import { huckleberryDetector } from './detect';
import { mapHuckleberryRows } from './map';
import { parseHuckleberryCsv } from './parse';

export function buildHuckleberryImportRecords(
  files: readonly ExternalImportFile[],
): readonly ExternalImportRecord[] {
  if (files.length !== 1) {
    throw new Error('Select one Huckleberry care log CSV file');
  }

  const [detection] = huckleberryDetector.detectFiles(files);
  if (detection.status !== 'detected') {
    throw new Error('The uploaded file does not match a Huckleberry care log export');
  }

  const records = mapHuckleberryRows(parseHuckleberryCsv(files[0].content).rows);
  if (records.length === 0) {
    throw new Error('The Huckleberry export contains no supported activities');
  }

  return records;
}
