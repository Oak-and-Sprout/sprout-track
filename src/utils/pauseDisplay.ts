/**
 * Formats a pause duration (seconds) with the short unit keys so whole
 * minutes never render as "1 minutes" and sub-minute pauses skip "0 min".
 * Returns '' when there is no pause to show.
 */
export function formatPauseDuration(seconds: number, t: (key: string) => string): string {
  if (!seconds || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs} ${t('sec')}`;
  if (secs === 0) return `${minutes} ${t('min')}`;
  return `${minutes} ${t('min')} ${secs} ${t('sec')}`;
}
