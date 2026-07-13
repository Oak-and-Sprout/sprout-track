import {
  ExternalImportBabyRecord,
  ExternalImportExecutionConfiguration,
  ExternalImportExecutionPlan,
  ExternalImportRecord,
} from '@/src/types/external-import';

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}

export function createExternalImportExecutionPlan(
  records: readonly ExternalImportRecord[],
  configuration: ExternalImportExecutionConfiguration,
): ExternalImportExecutionPlan {
  if (!configuration.sourceTimezone.trim()) {
    throw new Error('Source timezone is required');
  }

  const babyRecords = records.filter(
    (record): record is ExternalImportBabyRecord =>
      record.targetType === 'baby',
  );

  const activityRecords = records.filter(
    (
      record,
    ): record is Exclude<
      ExternalImportRecord,
      ExternalImportBabyRecord
    > => record.targetType !== 'baby',
  );

  const sourceChildIds = unique([
    ...babyRecords.map(record => record.source.recordId),
    ...activityRecords.map(record => record.sourceChildId),
  ]);

  for (const sourceChildId of sourceChildIds) {
    if (!configuration.childDestinations[sourceChildId]) {
      throw new Error(
        `Missing destination for source child: ${sourceChildId}`,
      );
    }
  }

  const duplicateBabySourceIds = babyRecords
    .map(record => record.source.recordId)
    .filter(
      (sourceId, index, values) =>
        values.indexOf(sourceId) !== index,
    );

  if (duplicateBabySourceIds.length > 0) {
    throw new Error(
      `Duplicate source child record: ${duplicateBabySourceIds[0]}`,
    );
  }

  const newBabies = babyRecords.flatMap(record => {
    const destination =
      configuration.childDestinations[
        record.source.recordId
      ];

    if (!destination || destination.mode !== 'new') {
      return [];
    }

    return [
      {
        sourceRecord: record,
        gender: destination.gender,
      },
    ];
  });

  const existingBabyIds = unique(
    sourceChildIds.flatMap(sourceChildId => {
      const destination =
        configuration.childDestinations[sourceChildId];

      return destination?.mode === 'existing'
        ? [destination.targetBabyId]
        : [];
    }),
  );

  for (const sourceChildId of sourceChildIds) {
    const destination =
      configuration.childDestinations[sourceChildId];

    if (
      destination?.mode === 'new' &&
      !babyRecords.some(
        record =>
          record.source.recordId === sourceChildId,
      )
    ) {
      throw new Error(
        `Cannot create source child without a child export: ${sourceChildId}`,
      );
    }
  }

  return {
    newBabies,
    existingBabyIds,
    activityRecords,
  };
}
