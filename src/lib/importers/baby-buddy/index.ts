import { ExternalImportProvider } from '@/src/types/external-import';

export const babyBuddyImportProvider: ExternalImportProvider = {
  id: 'baby-buddy',
  name: 'Baby Buddy',
  description: 'Import children and activity history exported from Baby Buddy.',
  acceptedExtensions: ['.csv'],
  supportsMultipleFiles: true,
};
