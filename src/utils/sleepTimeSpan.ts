/**
 * Builds the "start - end" label for a sleep entry. The end omits the date only
 * when it falls on the same calendar day as the start; otherwise it keeps the
 * full formatted date so every date format (and 12h/24h) renders correctly.
 */
export function formatSleepTimeSpan(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  format: (iso: string, includeDate: boolean) => string,
  labels: { unknown: string; ongoing: string }
): string {
  const start = startTime ? format(startTime, true) : labels.unknown;
  if (!endTime) return `${start} - ${labels.ongoing}`;
  const sameDay = !!startTime && new Date(startTime).toDateString() === new Date(endTime).toDateString();
  return `${start} - ${format(endTime, !sameDay)}`;
}
