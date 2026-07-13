import { ExternalImportProvider } from '@/src/types/external-import';
import { babyBuddyDetector } from './detect';
import { babyBuddyPreviewer } from './preview';

export const babyBuddyImportProvider: ExternalImportProvider = {
  id: 'baby-buddy',
  name: 'Baby Buddy',
  description: 'Import children and activity history exported from Baby Buddy.',
  acceptedExtensions: ['.csv'],
  supportsMultipleFiles: true,
};

export {
  analyseBabyBuddyFiles,
} from './analyse';

export {
  babyBuddyDetector,
  babyBuddyPreviewer,
};

export {
  parseBabyBuddyCsv,
  type BabyBuddyCsvRow,
  type BabyBuddyParsedCsv,
} from './parse';

export type {
  BabyBuddyPreviewChild,
  BabyBuddyPreviewDetails,
  BabyBuddyUnitRequirement,
  BabyBuddyUnitRequirementType,
} from './types';
