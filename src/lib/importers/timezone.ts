import { fromZonedTime } from 'date-fns-tz';

const DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export function externalImportLocalTimeToUtc(
  localDateTime: string,
  sourceTimezone: string,
): Date {
  if (!DATE_TIME_PATTERN.test(localDateTime)) {
    throw new Error(
      `Invalid external import date-time: ${localDateTime}`,
    );
  }

  if (!sourceTimezone.trim()) {
    throw new Error('Source timezone is required');
  }

  let result: Date;

  try {
    result = fromZonedTime(localDateTime, sourceTimezone);
  } catch {
    throw new Error(
      `Invalid source timezone: ${sourceTimezone}`,
    );
  }

  if (Number.isNaN(result.getTime())) {
    throw new Error(
      `Invalid source timezone: ${sourceTimezone}`,
    );
  }

  return result;
}

export function externalImportDateToUtc(
  date: string,
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid external import date: ${date}`);
  }

  return new Date(`${date}T00:00:00.000Z`);
}
