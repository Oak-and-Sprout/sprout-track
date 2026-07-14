import { ExternalImportProvider } from '@/src/types/external-import';
import { babyBuddyImportProvider } from './baby-buddy';

export const externalImportProviders: readonly ExternalImportProvider[] = [
  babyBuddyImportProvider,
];

export function getExternalImportProvider(
  providerId: string,
): ExternalImportProvider | undefined {
  return externalImportProviders.find(
    provider => provider.id === providerId,
  );
}
