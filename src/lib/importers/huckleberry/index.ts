import { ExternalImportProvider } from '@/src/types/external-import';

export const huckleberryImportProvider: ExternalImportProvider = {
  id: 'huckleberry',
  name: 'Huckleberry',
  description: 'Import a Huckleberry care log CSV export',
  acceptedExtensions: ['.csv'],
  supportsMultipleFiles: false,
};

export { huckleberryDetector } from './detect';
export { huckleberryPreviewer } from './preview';
export {
  analyseHuckleberryFiles,
  collectHuckleberryWarnings,
} from './analyse';
export { buildHuckleberryImportRecords } from './build-records';
export {
  fingerprintHuckleberryRow,
  mapHuckleberryRows,
} from './map';
export { parseHuckleberryCsv } from './parse';
export type {
  HuckleberryImportWarning,
  HuckleberryPreviewDetails,
} from './types';
