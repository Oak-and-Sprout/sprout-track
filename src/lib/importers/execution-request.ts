import {
  ExternalImportChildDestination,
  ExternalImportExecutionConfiguration,
} from '@/src/types/external-import';

export interface ExternalImportExecuteConfiguration {
  readonly execution: ExternalImportExecutionConfiguration;
  readonly provider: unknown;
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseChildDestination(
  sourceChildId: string,
  value: unknown,
): ExternalImportChildDestination {
  if (!isObject(value)) {
    throw new Error(
      `Invalid destination for source child: ${sourceChildId}`,
    );
  }

  if (
    value.mode === 'existing' &&
    typeof value.targetBabyId === 'string' &&
    value.targetBabyId.trim()
  ) {
    return {
      mode: 'existing',
      targetBabyId: value.targetBabyId.trim(),
    };
  }

  if (
    value.mode === 'new' &&
    (value.gender === 'MALE' ||
      value.gender === 'FEMALE')
  ) {
    return {
      mode: 'new',
      gender: value.gender,
    };
  }

  throw new Error(
    `Invalid destination for source child: ${sourceChildId}`,
  );
}

export function parseExternalImportExecuteConfiguration(
  value: FormDataEntryValue | null,
): ExternalImportExecuteConfiguration {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(
      'Import execution configuration is required',
    );
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(
      'Import execution configuration is invalid JSON',
    );
  }

  if (!isObject(parsed)) {
    throw new Error(
      'Import execution configuration must be an object',
    );
  }

  const execution = parsed.execution;

  if (
    !isObject(execution) ||
    typeof execution.sourceTimezone !== 'string' ||
    !execution.sourceTimezone.trim() ||
    !isObject(execution.childDestinations)
  ) {
    throw new Error(
      'Import execution configuration is invalid',
    );
  }

  const childDestinations = Object.fromEntries(
    Object.entries(execution.childDestinations).map(
      ([sourceChildId, destination]) => [
        sourceChildId,
        parseChildDestination(
          sourceChildId,
          destination,
        ),
      ],
    ),
  );

  return {
    execution: {
      sourceTimezone:
        execution.sourceTimezone.trim(),
      childDestinations,
    },
    provider: parsed.provider ?? {},
  };
}
