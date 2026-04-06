/**
 * Date and time formatting utilities driven by family settings.
 * Pure functions with no React dependencies — usable in both React and non-React contexts.
 */

export type DateFormatSetting = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type TimeFormatSetting = '12h' | '24h';

/**
 * Format a Date object as a time string according to the time format setting.
 * Returns e.g. "1:30 PM" (12h) or "13:30" (24h).
 */
export function formatTimeDisplay(
  date: Date,
  timeFormat: TimeFormatSetting,
  timezone?: string
): string {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: timeFormat === '12h',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

/**
 * Format a Date object as a full date string according to the date format setting.
 * Returns e.g. "04/06/2026" (MM/DD/YYYY), "06/04/2026" (DD/MM/YYYY), or "2026-04-06" (YYYY-MM-DD).
 */
export function formatDateDisplay(
  date: Date,
  dateFormat: DateFormatSetting,
  timezone?: string
): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    case 'MM/DD/YYYY':
    default:
      return `${month}/${day}/${year}`;
  }
}

/**
 * Format a Date object as a short date for display in timelines and chart labels.
 * Returns e.g. "Apr 6" (MM/DD), "6 Apr" (DD/MM), or "04-06" (YYYY-MM-DD).
 */
export function formatDateShort(
  date: Date,
  dateFormat: DateFormatSetting,
  timezone?: string
): string {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day} ${month}`;
    case 'YYYY-MM-DD': {
      // Include year for ISO-style display since the year prefix is core to the format
      const numOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        ...(timezone ? { timeZone: timezone } : {}),
      };
      const numParts = new Intl.DateTimeFormat('en-US', numOptions).formatToParts(date);
      const numYear = numParts.find(p => p.type === 'year')?.value || '';
      const numMonth = numParts.find(p => p.type === 'month')?.value || '';
      const numDay = numParts.find(p => p.type === 'day')?.value || '';
      return `${numYear}-${numMonth}-${numDay}`;
    }
    case 'MM/DD/YYYY':
    default:
      return `${month} ${day}`;
  }
}

/**
 * Format a Date object as a full date with year for display.
 * Returns e.g. "Apr 6, 2026" (MM/DD), "6 Apr 2026" (DD/MM), or "2026-04-06" (YYYY-MM-DD).
 */
export function formatDateLong(
  date: Date,
  dateFormat: DateFormatSetting,
  timezone?: string
): string {
  if (dateFormat === 'YYYY-MM-DD') {
    return formatDateDisplay(date, dateFormat, timezone);
  }

  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
  const month = parts.find(p => p.type === 'month')?.value || '';
  const day = parts.find(p => p.type === 'day')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';

  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${day} ${month} ${year}`;
    case 'MM/DD/YYYY':
    default:
      return `${month} ${day}, ${year}`;
  }
}

/**
 * Format a Date object as a combined date and time string.
 */
export function formatDateTimeDisplay(
  date: Date,
  dateFormat: DateFormatSetting,
  timeFormat: TimeFormatSetting,
  timezone?: string
): string {
  const datePart = formatDateLong(date, dateFormat, timezone);
  const timePart = formatTimeDisplay(date, timeFormat, timezone);
  return `${datePart} ${timePart}`;
}
