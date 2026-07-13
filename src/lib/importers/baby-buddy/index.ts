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

export { babyBuddyDetector, babyBuddyPreviewer };
export {
  parseBabyBuddyCsv,
  type BabyBuddyCsvRow,
  type BabyBuddyParsedCsv,
} from './parse';
