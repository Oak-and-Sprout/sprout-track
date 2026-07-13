'use client';

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import {
  FormPage,
  FormPageContent,
  FormPageFooter,
} from '@/src/components/ui/form-page';
import { useLocalization } from '@/src/context/localization';
import ConfigureStep from './ConfigureStep';
import {
  ExistingBaby,
  ExternalImportProps,
  ExternalImportPreviewResponse,
  ExternalImportStep,
  ExternalImportUiConfiguration,
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
  const [step, setStep] =
    useState<ExternalImportStep>('select');
  const [babies, setBabies] =
    useState<ExistingBaby[]>([]);
  const [isLoadingBabies, setIsLoadingBabies] =
    useState(false);
  const [configuration, setConfiguration] =
    useState<ExternalImportUiConfiguration>({
      sourceTimezone: 'UTC',
      childDestinations: {},
      units: {},
    });

  useEffect(() => {
    if (isOpen) {
      const detectedTimezone =
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone || 'UTC';

      setConfiguration({
        sourceTimezone: detectedTimezone,
        childDestinations: {},
        units: {},
      });

      return;
    }

    setFiles([]);
    setPreview(null);
    setError('');
    setIsPreviewing(false);
    setStep('select');
    setBabies([]);
    setIsLoadingBabies(false);
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

  const loadExistingBabies = async () => {
    setIsLoadingBabies(true);

    try {
      const response = await fetch('/api/baby', {
        headers: getAuthHeaders(),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            t('Failed to load existing babies'),
        );
      }

      setBabies(
        (result.data as ExistingBaby[]).filter(
          baby => !baby.inactive,
        ),
      );
    } finally {
      setIsLoadingBabies(false);
    }
  };

  const initialiseConfiguration = (
    response: ExternalImportPreviewResponse,
  ) => {
    const childDestinations = Object.fromEntries(
      response.details.children.map(child => [
        child.sourceId,
        {
          mode: 'new' as const,
          gender: '' as const,
        },
      ]),
    );

    const units = Object.fromEntries(
      response.details.unitRequirements.map(
        requirement => [
          requirement.entityType,
          requirement.allowedUnits[0],
        ],
      ),
    );

    setConfiguration(current => ({
      ...current,
      childDestinations,
      units,
    }));
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

      const previewResult =
        result.data as ExternalImportPreviewResponse;

      setPreview(previewResult);
      initialiseConfiguration(previewResult);
      await loadExistingBabies();
      setStep('configure');
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
        {step === 'select' && (
          <div className="space-y-6">
          {isPreviewing && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 p-4 text-teal-900"
            >
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  {t('Analysing import files...')}
                </p>
                <p className="text-sm text-teal-700">
                  {t(
                    'Detecting file types, records, children, units and warnings',
                  )}
                </p>
              </div>
            </div>
          )}

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
        )}

        {step === 'configure' && preview && (
          <ConfigureStep
            preview={preview}
            babies={babies}
            isLoadingBabies={isLoadingBabies}
            configuration={configuration}
            onConfigurationChange={setConfiguration}
          />
        )}
      </FormPageContent>

      <FormPageFooter>
        {step === 'select' ? (
          <>
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
                files.length === 0 ||
                isPreviewing
              }
            >
              {isPreviewing
                ? t('Previewing...')
                : preview
                  ? t('Refresh preview')
                  : t('Preview import')}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setError('');
                setStep('select');
              }}
            >
              {t('Back')}
            </Button>

            <Button
              type="button"
              onClick={() => {
                setError('');
                setStep('review');
              }}
              disabled={
                !configuration.sourceTimezone.trim() ||
                Object.values(
                  configuration.childDestinations,
                ).some(
                  destination =>
                    (destination.mode ===
                      'existing' &&
                      !destination.targetBabyId) ||
                    (destination.mode === 'new' &&
                      !destination.gender),
                )
              }
            >
              {t('Continue')}
            </Button>
          </>
        )}
      </FormPageFooter>
    </FormPage>
  );
}
