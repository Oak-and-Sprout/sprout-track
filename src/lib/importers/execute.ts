import { Prisma } from '@prisma/client';
import {
  ExternalImportBabyRecord,
  ExternalImportExecutionConfiguration,
  ExternalImportExecutionResult,
  ExternalImportRecord,
  ExternalImportRecordResult,
} from '@/src/types/external-import';
import {
  externalImportDateToUtc,
  externalImportLocalTimeToUtc,
} from './timezone';
import {
  externalImportProvenanceKey,
  externalImportTargetEntityType,
} from './provenance';
import {
  createExternalImportExecutionPlan,
} from './plan';

export interface ExternalImportExecutionInput {
  readonly familyId: string;
  readonly caretakerId?: string | null;
  readonly records: readonly ExternalImportRecord[];
  readonly configuration: ExternalImportExecutionConfiguration;
}

function durationMinutes(
  startTime: Date,
  endTime: Date,
): number {
  const duration = Math.round(
    (endTime.getTime() - startTime.getTime()) / 60000,
  );

  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error(
      'External import end time must not be before start time',
    );
  }

  return duration;
}

async function findProvenance(
  tx: Prisma.TransactionClient,
  familyId: string,
  record: ExternalImportRecord,
) {
  const key = externalImportProvenanceKey(
    familyId,
    record.source,
  );

  return tx.externalImportRecord.findUnique({
    where: {
      familyId_providerId_sourceEntityType_sourceRecordId: key,
    },
  });
}

function recordResult(
  record: ExternalImportRecord,
  targetRecordId: string,
  status: 'created' | 'duplicate',
): ExternalImportRecordResult {
  return {
    providerId: record.source.providerId,
    sourceEntityType: record.source.entityType,
    sourceRecordId: record.source.recordId,
    targetEntityType:
      externalImportTargetEntityType(record),
    targetRecordId,
    status,
  };
}

async function createProvenance(
  tx: Prisma.TransactionClient,
  familyId: string,
  record: ExternalImportRecord,
  targetRecordId: string,
): Promise<void> {
  await tx.externalImportRecord.create({
    data: {
      familyId,
      providerId: record.source.providerId,
      sourceEntityType: record.source.entityType,
      sourceRecordId: record.source.recordId,
      sourceChildId: record.source.childId,
      targetEntityType:
        externalImportTargetEntityType(record),
      targetRecordId,
    },
  });
}

async function createActivityRecord(
  tx: Prisma.TransactionClient,
  familyId: string,
  caretakerId: string | null | undefined,
  babyId: string,
  record: Exclude<
    ExternalImportRecord,
    ExternalImportBabyRecord
  >,
  sourceTimezone: string,
): Promise<string> {
  switch (record.targetType) {
    case 'sleep': {
      const startTime = externalImportLocalTimeToUtc(
        record.startTime,
        sourceTimezone,
      );
      const endTime = externalImportLocalTimeToUtc(
        record.endTime,
        sourceTimezone,
      );

      const created = await tx.sleepLog.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          startTime,
          endTime,
          duration: durationMinutes(startTime, endTime),
          type: record.type,
        },
      });

      return created.id;
    }

    case 'feed': {
      const time = externalImportLocalTimeToUtc(
        record.time,
        sourceTimezone,
      );

      const startTime = record.startTime
        ? externalImportLocalTimeToUtc(
            record.startTime,
            sourceTimezone,
          )
        : undefined;

      const endTime = record.endTime
        ? externalImportLocalTimeToUtc(
            record.endTime,
            sourceTimezone,
          )
        : undefined;

      const created = await tx.feedLog.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          time,
          type: record.type,
          startTime,
          endTime,
          feedDuration: record.feedDuration,
          side: record.side,
          amount: record.amount,
          unitAbbr: record.unitAbbr,
          food: record.food,
          notes: record.notes,
          bottleType: record.bottleType,
        },
      });

      return created.id;
    }

    case 'diaper': {
      const created = await tx.diaperLog.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          time: externalImportLocalTimeToUtc(
            record.time,
            sourceTimezone,
          ),
          type: record.type,
          color: record.color,
          blowout: false,
          creamApplied: false,
        },
      });

      return created.id;
    }

    case 'note': {
      const created = await tx.note.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          time: externalImportLocalTimeToUtc(
            record.time,
            sourceTimezone,
          ),
          content: record.content,
        },
      });

      return created.id;
    }

    case 'measurement': {
      const date =
        record.type === 'TEMPERATURE'
          ? externalImportLocalTimeToUtc(
              record.date,
              sourceTimezone,
            )
          : externalImportDateToUtc(
              record.date.slice(0, 10),
            );

      const created = await tx.measurement.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          date,
          type: record.type,
          value: record.value,
          unit: record.unit,
          notes: record.notes,
        },
      });

      return created.id;
    }

    case 'pump': {
      const created = await tx.pumpLog.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          startTime: externalImportLocalTimeToUtc(
            record.startTime,
            sourceTimezone,
          ),
          endTime: externalImportLocalTimeToUtc(
            record.endTime,
            sourceTimezone,
          ),
          duration: record.duration,
          totalAmount: record.totalAmount,
          unitAbbr: record.unitAbbr,
          pumpAction: record.pumpAction,
          notes: record.notes,
        },
      });

      return created.id;
    }

    case 'play': {
      const startTime = externalImportLocalTimeToUtc(
        record.startTime,
        sourceTimezone,
      );

      const created = await tx.playLog.create({
        data: {
          familyId,
          caretakerId,
          babyId,
          startTime,
          endTime: new Date(
            startTime.getTime() +
              record.duration * 60 * 1000,
          ),
          duration: record.duration,
          type: record.type,
          notes: record.notes,
        },
      });

      return created.id;
    }
  }
}

async function executeWithinTransaction(
  tx: Prisma.TransactionClient,
  input: ExternalImportExecutionInput,
): Promise<ExternalImportExecutionResult> {
  const {
    familyId,
    caretakerId,
    records,
    configuration,
  } = input;

  if (!familyId.trim()) {
    throw new Error('Family ID is required');
  }

  const plan = createExternalImportExecutionPlan(
    records,
    configuration,
  );

  if (plan.existingBabyIds.length > 0) {
    const existingBabies = await tx.baby.findMany({
      where: {
        familyId,
        id: {
          in: [...plan.existingBabyIds],
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (
      existingBabies.length !==
      plan.existingBabyIds.length
    ) {
      throw new Error(
        'One or more target babies were not found in this family',
      );
    }
  }

  const babyMappings: Record<string, string> = {};
  const results: ExternalImportRecordResult[] = [];

  for (const [sourceChildId, destination] of Object.entries(
    configuration.childDestinations,
  )) {
    if (destination.mode === 'existing') {
      babyMappings[sourceChildId] =
        destination.targetBabyId;
    }
  }

  for (const plannedBaby of plan.newBabies) {
    const record = plannedBaby.sourceRecord;
    const duplicate = await findProvenance(
      tx,
      familyId,
      record,
    );

    if (duplicate) {
      babyMappings[record.source.recordId] =
        duplicate.targetRecordId;

      results.push(
        recordResult(
          record,
          duplicate.targetRecordId,
          'duplicate',
        ),
      );

      continue;
    }

    const created = await tx.baby.create({
      data: {
        familyId,
        firstName: record.firstName,
        lastName: record.lastName,
        birthDate: externalImportDateToUtc(
          record.birthDate,
        ),
        gender: plannedBaby.gender,
      },
    });

    babyMappings[record.source.recordId] =
      created.id;

    await createProvenance(
      tx,
      familyId,
      record,
      created.id,
    );

    results.push(
      recordResult(record, created.id, 'created'),
    );
  }

  for (const babyRecord of records.filter(
    (
      record,
    ): record is ExternalImportBabyRecord =>
      record.targetType === 'baby',
  )) {
    const destination =
      configuration.childDestinations[
        babyRecord.source.recordId
      ];

    if (!destination || destination.mode !== 'existing') {
      continue;
    }

    const duplicate = await findProvenance(
      tx,
      familyId,
      babyRecord,
    );

    if (duplicate) {
      if (
        duplicate.targetRecordId !==
        destination.targetBabyId
      ) {
        throw new Error(
          `Source child ${babyRecord.source.recordId} was previously mapped to another baby`,
        );
      }

      results.push(
        recordResult(
          babyRecord,
          duplicate.targetRecordId,
          'duplicate',
        ),
      );

      continue;
    }

    await createProvenance(
      tx,
      familyId,
      babyRecord,
      destination.targetBabyId,
    );

    results.push(
      recordResult(
        babyRecord,
        destination.targetBabyId,
        'created',
      ),
    );
  }

  for (const record of plan.activityRecords) {
    const babyId = babyMappings[record.sourceChildId];

    if (!babyId) {
      throw new Error(
        `No target baby resolved for source child: ${record.sourceChildId}`,
      );
    }

    const duplicate = await findProvenance(
      tx,
      familyId,
      record,
    );

    if (duplicate) {
      results.push(
        recordResult(
          record,
          duplicate.targetRecordId,
          'duplicate',
        ),
      );

      continue;
    }

    const targetRecordId = await createActivityRecord(
      tx,
      familyId,
      caretakerId,
      babyId,
      record,
      configuration.sourceTimezone,
    );

    await createProvenance(
      tx,
      familyId,
      record,
      targetRecordId,
    );

    results.push(
      recordResult(
        record,
        targetRecordId,
        'created',
      ),
    );
  }

  return {
    created: results.filter(
      result => result.status === 'created',
    ).length,
    duplicates: results.filter(
      result => result.status === 'duplicate',
    ).length,
    records: results,
    babyMappings,
  };
}

export async function executeExternalImport(
  prisma: Prisma.TransactionClient,
  input: ExternalImportExecutionInput,
): Promise<ExternalImportExecutionResult> {
  return executeWithinTransaction(prisma, input);
}
