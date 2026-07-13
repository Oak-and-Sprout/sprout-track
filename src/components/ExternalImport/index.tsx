'use client';

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  FormPage,
  FormPageContent,
  FormPageFooter,
} from '@/src/components/ui/form-page';
import { useLocalization } from '@/src/context/localization';
import {
  ExternalImportProps,
  ExternalImportPreviewResponse,
} from './external-import.types';

export default function ExternalImport({
  isOpen,
  onClose,
}: ExternalImportProps) {
  const { t } = useLocalization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] =
    useState<ExternalImportPreviewResponse | null>(null);
  const [isPreviewing, setIsPreviewing] =
    useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setPreview(null);
      setError('');
      setIsPreviewing(false);
    }
  }, [isOpen]);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('authToken');

    return token
      ? { Authorization: `Bearer ${token}` }
      : {};
  };

  const handleFilesSelected = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFiles = Array.from(
      event.target.files || [],
    );

    setFiles(selectedFiles);
    setPreview(null);
    setError('');
  };

  const handlePreview = async () => {
    if (files.length === 0) {
      setError(t('Select at least one CSV file'));
      return;
    }

    try {
      setIsPreviewing(true);
      setError('');

      const formData = new FormData();
      formData.set('providerId', 'baby-buddy');

      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await fetch(
        '/api/import/external/preview',
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            t('Failed to preview import files'),
        );
      }

      setPreview(result.data);
    } catch (previewError) {
      setPreview(null);
      setError(
        previewError instanceof Error
          ? previewError.message
          : t('Failed to preview import files'),
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <FormPage
      isOpen={isOpen}
      onClose={onClose}
      title={t('Import from another platform')}
      description={t(
        'Import historical data without replacing existing Sprout Track data',
      )}
    >
      <FormPageContent>
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 p-4">
            <h3 className="font-medium text-gray-900">
              {t('Baby Buddy')}
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              {t(
                'Select the CSV files exported from Baby Buddy Database Admin',
              )}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={handleFilesSelected}
              className="sr-only"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="mt-4"
            >
              <Upload
                className="mr-2 h-4 w-4"
                aria-hidden="true"
              />
              {t('Select CSV files')}
            </Button>

            {files.length > 0 && (
              <ul className="mt-4 space-y-1 text-sm text-gray-700">
                {files.map(file => (
                  <li key={`${file.name}-${file.size}`}>
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {preview && (
            <section className="rounded-lg border border-gray-200 p-4">
              <h3 className="font-medium text-gray-900">
                {t('Import preview')}
              </h3>

              <p className="mt-1 text-sm text-gray-600">
                {preview.preview.totalRows}{' '}
                {t('records detected')}
              </p>

              <ul className="mt-4 divide-y divide-gray-200">
                {preview.preview.files.map(file => (
                  <li
                    key={file.fileName}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span>{file.fileName}</span>
                    <span>
                      {file.status === 'detected'
                        ? `${file.entityType}: ${file.rowCount}`
                        : file.error || file.status}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </FormPageContent>

      <FormPageFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPreviewing}
        >
          {t('Cancel')}
        </Button>

        <Button
          type="button"
          onClick={handlePreview}
          disabled={
            files.length === 0 || isPreviewing
          }
        >
          {isPreviewing
            ? t('Previewing...')
            : t('Preview import')}
        </Button>
      </FormPageFooter>
    </FormPage>
  );
}
