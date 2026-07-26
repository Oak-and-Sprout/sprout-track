import {
  ExternalImportRecord,
  ExternalImportSource,
} from '@/src/types/external-import';

export interface ExternalImportProvenanceKey {
  readonly familyId: string;
  readonly providerId: string;
  readonly sourceEntityType: string;
  readonly sourceRecordId: string;
}

export function externalImportProvenanceKey(
  familyId: string,
  source: ExternalImportSource,
): ExternalImportProvenanceKey {
  if (!familyId.trim()) {
    throw new Error('Family ID is required');
  }

  return {
    familyId,
    providerId: source.providerId,
    sourceEntityType: source.entityType,
    sourceRecordId: source.recordId,
  };
}

export function externalImportTargetEntityType(
  record: ExternalImportRecord,
): string {
  switch (record.targetType) {
    case 'baby':
      return 'Baby';
    case 'sleep':
      return 'SleepLog';
    case 'feed':
      return 'FeedLog';
    case 'diaper':
      return 'DiaperLog';
    case 'note':
      return 'Note';
    case 'measurement':
      return 'Measurement';
    case 'pump':
      return 'PumpLog';
    case 'play':
      return 'PlayLog';
  }
}
