'use client';

import { useLocalization } from '@/src/context/localization';
import {
  ExistingBaby,
  ExternalImportPreviewResponse,
  ExternalImportUiConfiguration,
} from './external-import.types';

interface ReviewStepProps {
  readonly preview: ExternalImportPreviewResponse;
  readonly babies: readonly ExistingBaby[];
  readonly configuration: ExternalImportUiConfiguration;
}

const unitLabels: Record<string, string> = {
  feeding: 'Bottle feeding amount unit',
  pumping: 'Pumping amount unit',
  height: 'Height unit',
  weight: 'Weight unit',
  'head-circumference': 'Head circumference unit',
  temperature: 'Temperature unit',
};

export default function ReviewStep({
  preview,
  babies,
  configuration,
}: ReviewStepProps) {
  const { t } = useLocalization();

  const detectedRows = preview.preview.totalRows;
  const warningRows = preview.warnings.reduce(
    (total, warning) => total + warning.affectedRows,
    0,
  );

  const findBabyName = (babyId: string) => {
    const baby = babies.find(
      candidate => candidate.id === babyId,
    );

    return baby
      ? `${baby.firstName} ${baby.lastName}`
      : babyId;
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">
          {t('Ready to import')}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {t(
            'This import will only add records. Existing Sprout Track records will not be modified or deleted.',
          )}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-gray-500">
              {t('Detected records')}
            </dt>
            <dd className="font-medium">
              {detectedRows}
            </dd>
          </div>

          <div>
            <dt className="text-gray-500">
              {t('Warnings')}
            </dt>
            <dd className="font-medium">
              {warningRows}
            </dd>
          </div>

          <div className="col-span-2">
            <dt className="text-gray-500">
              {t('Source timezone')}
            </dt>
            <dd className="font-medium">
              {configuration.sourceTimezone}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">
          {t('Child destination')}
        </h3>

        <div className="mt-3 space-y-3 text-sm">
          {preview.details.children.map(child => {
            const destination =
              configuration.childDestinations[
                child.sourceId
              ];

            return (
              <div
                key={child.sourceId}
                className="rounded-md bg-gray-50 p-3"
              >
                <div className="font-medium">
                  {child.firstName} {child.lastName}
                </div>

                {destination?.mode === 'existing' ? (
                  <div className="mt-1 text-gray-600">
                    {t('Add records to existing baby')}:{' '}
                    {findBabyName(
                      destination.targetBabyId,
                    )}
                  </div>
                ) : (
                  <div className="mt-1 text-gray-600">
                    {t('Add as a new baby')} —{' '}
                    {destination?.gender}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {preview.details.unitRequirements.length >
        0 && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900">
            {t('Units')}
          </h3>

          <dl className="mt-3 space-y-2 text-sm">
            {preview.details.unitRequirements.map(
              requirement => (
                <div
                  key={requirement.entityType}
                  className="flex justify-between gap-4"
                >
                  <dt className="text-gray-600">
                    {t(
                      unitLabels[
                        requirement.entityType
                      ] ||
                        requirement.entityType,
                    )}
                  </dt>
                  <dd className="font-medium">
                    {
                      configuration.units[
                        requirement.entityType
                      ]
                    }
                  </dd>
                </div>
              ),
            )}
          </dl>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-medium text-amber-900">
            {t('Warnings before import')}
          </h3>

          <ul className="mt-3 space-y-1 text-sm text-amber-800">
            {preview.warnings.map(warning => (
              <li
                key={`${warning.code}-${warning.entityType}`}
              >
                {warning.code} ({warning.affectedRows})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
