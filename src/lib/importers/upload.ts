import {
  ExternalImportFile,
} from '@/src/types/external-import';

export interface ExternalImportUpload {
  readonly providerId: string;
  readonly files: readonly ExternalImportFile[];
}

export async function readExternalImportUpload(
  formData: FormData,
): Promise<ExternalImportUpload> {
  const providerValue = formData.get('providerId');

  if (
    typeof providerValue !== 'string' ||
    !providerValue.trim()
  ) {
    throw new Error('Import provider is required');
  }

  const uploadedFiles = formData
    .getAll('files')
    .filter((value): value is File =>
      value instanceof File,
    );

  if (uploadedFiles.length === 0) {
    throw new Error('At least one import file is required');
  }

  const files = await Promise.all(
    uploadedFiles.map(async file => ({
      name: file.name,
      content: await file.text(),
    })),
  );

  return {
    providerId: providerValue.trim(),
    files,
  };
}
