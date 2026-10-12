import { ExternalImportProvider } from '@/src/types/external-import';
import { babyBuddyImportProvider } from './baby-buddy';
import { huckleberryImportProvider } from './huckleberry';

export const externalImportProviders: readonly ExternalImportProvider[] = [
  babyBuddyImportProvider,
  huckleberryImportProvider,
];

export function getExternalImportProvider(
  providerId: string,
): ExternalImportProvider | undefined {
  return externalImportProviders.find(
    provider => provider.id === providerId,
  );
}
