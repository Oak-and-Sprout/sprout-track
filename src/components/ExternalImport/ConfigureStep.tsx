'use client';

import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { useLocalization } from '@/src/context/localization';
import {
  ChildDestinationState,
  ExistingBaby,
  ExternalImportPreviewResponse,
  ExternalImportUiConfiguration,
} from './external-import.types';

interface ConfigureStepProps {
  readonly preview: ExternalImportPreviewResponse;
  readonly babies: readonly ExistingBaby[];
  readonly isLoadingBabies: boolean;
  readonly configuration: ExternalImportUiConfiguration;
  readonly onConfigurationChange: (
    configuration: ExternalImportUiConfiguration,
  ) => void;
}

const unitLabels: Record<string, string> = {
  feeding: 'Bottle feeding amount unit',
  pumping: 'Pumping amount unit',
  height: 'Height unit',
  weight: 'Weight unit',
  'head-circumference': 'Head circumference unit',
  temperature: 'Temperature unit',
};

const warningLabels: Record<string, string> = {
  'birth-time-unsupported':
    'Birth time is not imported',
  'tags-unsupported':
    'Tags are not supported and will be skipped',
  'bmi-unsupported':
    'BMI records are not imported',
  'both-breasts-without-side':
    'Breast feeds without an individual side use available session data',
  'wet-diaper-colour-unsupported':
    'Colours on wet-only nappies are not imported',
  'breast-feed-amount-unsupported':
    'Amounts on direct breast feeds are not imported',
  'sleep-notes-unsupported':
    'Sleep notes are not imported',
  'diaper-notes-unsupported':
    'Nappy notes are not imported',
  'diaper-amount-unsupported':
    'Nappy amounts are not imported',
  'pumping-defaults-to-stored':
    'Pumping records are imported as stored milk',
};

export default function ConfigureStep({
  preview,
  babies,
  isLoadingBabies,
  configuration,
  onConfigurationChange,
}: ConfigureStepProps) {
  const { t } = useLocalization();

  const updateChildDestination = (
    sourceId: string,
    destination: ChildDestinationState,
  ) => {
    onConfigurationChange({
      ...configuration,
      childDestinations: {
        ...configuration.childDestinations,
        [sourceId]: destination,
      },
    });
  };

  const updateUnit = (
    entityType: string,
    unit: string,
  ) => {
    onConfigurationChange({
      ...configuration,
      units: {
        ...configuration.units,
        [entityType]: unit,
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">
          {t('Child destination')}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Choose whether each exported child should be added or mapped to an existing baby',
          )}
        </p>

        <div className="mt-4 space-y-5">
          {preview.details.children.map(child => {
            const destination =
              configuration.childDestinations[
                child.sourceId
              ];

            return (
              <div
                key={child.sourceId}
                className="rounded-md border border-gray-200 p-3"
              >
                <div className="font-medium">
                  {child.firstName} {child.lastName}
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  {t('Birth date')}: {child.birthDate}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <Label>
                      {t('Destination')}
                    </Label>

                    <Select
                      value={destination?.mode || 'new'}
                      onValueChange={value => {
                        if (value === 'existing') {
                          updateChildDestination(
                            child.sourceId,
                            {
                              mode: 'existing',
                              targetBabyId:
                                babies[0]?.id || '',
                            },
                          );
                        } else {
                          updateChildDestination(
                            child.sourceId,
                            {
                              mode: 'new',
                              gender: '',
                            },
                          );
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">
                          {t('Add as a new baby')}
                        </SelectItem>
                        <SelectItem
                          value="existing"
                          disabled={
                            babies.length === 0
                          }
                        >
                          {t(
                            'Add records to an existing baby',
                          )}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {destination?.mode === 'new' && (
                    <div>
                      <Label>{t('Gender')}</Label>
                      <Select
                        value={destination.gender}
                        onValueChange={value =>
                          updateChildDestination(
                            child.sourceId,
                            {
                              mode: 'new',
                              gender:
                                value as
                                  | 'MALE'
                                  | 'FEMALE',
                            },
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('Select gender')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FEMALE">
                            {t('Female')}
                          </SelectItem>
                          <SelectItem value="MALE">
                            {t('Male')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {destination?.mode ===
                    'existing' && (
                    <div>
                      <Label>
                        {t('Existing baby')}
                      </Label>
                      <Select
                        value={
                          destination.targetBabyId
                        }
                        disabled={isLoadingBabies}
                        onValueChange={value =>
                          updateChildDestination(
                            child.sourceId,
                            {
                              mode: 'existing',
                              targetBabyId: value,
                            },
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t(
                              'Select a baby',
                            )}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {babies.map(baby => (
                            <SelectItem
                              key={baby.id}
                              value={baby.id}
                            >
                              {baby.firstName}{' '}
                              {baby.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4">
        <h3 className="font-medium text-gray-900">
          {t('Source timezone')}
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {t(
            'Baby Buddy timestamps will be interpreted in this timezone',
          )}
        </p>

        <Input
          className="mt-3"
          value={configuration.sourceTimezone}
          onChange={event =>
            onConfigurationChange({
              ...configuration,
              sourceTimezone: event.target.value,
            })
          }
        />
      </section>

      {preview.details.unitRequirements.length >
        0 && (
        <section className="rounded-lg border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900">
            {t('Units')}
          </h3>

          <div className="mt-4 space-y-4">
            {preview.details.unitRequirements.map(
              requirement => (
                <div key={requirement.entityType}>
                  <Label>
                    {t(
                      unitLabels[
                        requirement.entityType
                      ] ||
                        requirement.entityType,
                    )}
                  </Label>

                  <Select
                    value={
                      configuration.units[
                        requirement.entityType
                      ] || ''
                    }
                    onValueChange={value =>
                      updateUnit(
                        requirement.entityType,
                        value,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {requirement.allowedUnits.map(
                        unit => (
                          <SelectItem
                            key={unit}
                            value={unit}
                          >
                            {unit === 'SKIP'
                              ? t(
                                  'Do not import amounts',
                                )
                              : unit}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  <p className="mt-1 text-xs text-gray-500">
                    {requirement.populatedRows}{' '}
                    {t('records use this unit')}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      )}

      {preview.warnings.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-medium text-amber-900">
            {t('Import warnings')}
          </h3>

          <ul className="mt-3 space-y-2 text-sm text-amber-800">
            {preview.warnings.map(warning => (
              <li
                key={`${warning.code}-${warning.entityType}`}
              >
                {t(
                  warningLabels[warning.code] ||
                    warning.code,
                )}{' '}
                ({warning.affectedRows})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
