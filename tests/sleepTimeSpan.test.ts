import { describe, it, expect } from 'vitest';
import { formatSleepTimeSpan } from '@/src/utils/sleepTimeSpan';
import {
  formatDateShort,
  formatTimeDisplay,
  DateFormatSetting,
  TimeFormatSetting,
} from '@/src/utils/dateFormat';

// Mirrors Timeline formatTime(…, includeDate) for non-today/yesterday dates.
const makeFormat = (df: DateFormatSetting, tf: TimeFormatSetting) => (iso: string, includeDate: boolean) => {
  const d = new Date(iso);
  const time = formatTimeDisplay(d, tf);
  return includeDate ? `${formatDateShort(d, df)}, ${time}` : time;
};
const labels = { unknown: 'unknown', ongoing: 'ongoing' };
const at = (day: number, h: number, m: number) => new Date(2020, 9, day, h, m).toISOString();

describe('formatSleepTimeSpan (issue #287)', () => {
  const cases: [DateFormatSetting, TimeFormatSetting, string, string][] = [
    ['MM/DD/YYYY', '24h', 'Oct 2, 19:18 - Oct 3, 06:01', 'Oct 2, 19:18 - 20:30'],
    ['DD/MM/YYYY', '24h', '2 Oct, 19:18 - 3 Oct, 06:01', '2 Oct, 19:18 - 20:30'],
    ['YYYY-MM-DD', '24h', '2020-10-02, 19:18 - 2020-10-03, 06:01', '2020-10-02, 19:18 - 20:30'],
    ['MM/DD/YYYY', '12h', 'Oct 2, 7:18 PM - Oct 3, 6:01 AM', 'Oct 2, 7:18 PM - 8:30 PM'],
    ['DD/MM/YYYY', '12h', '2 Oct, 7:18 PM - 3 Oct, 6:01 AM', '2 Oct, 7:18 PM - 8:30 PM'],
    ['YYYY-MM-DD', '12h', '2020-10-02, 7:18 PM - 2020-10-03, 6:01 AM', '2020-10-02, 7:18 PM - 8:30 PM'],
  ];

  it.each(cases)('%s %s', (df, tf, crossMidnight, sameDay) => {
    const fmt = makeFormat(df, tf);
    expect(formatSleepTimeSpan(at(2, 19, 18), at(3, 6, 1), fmt, labels)).toBe(crossMidnight);
    expect(formatSleepTimeSpan(at(2, 19, 18), at(2, 20, 30), fmt, labels)).toBe(sameDay);
  });

  it('shows ongoing when there is no end time', () => {
    const fmt = makeFormat('MM/DD/YYYY', '24h');
    expect(formatSleepTimeSpan(at(2, 19, 18), null, fmt, labels)).toBe('Oct 2, 19:18 - ongoing');
  });

  it('shows unknown when there is no start time', () => {
    const fmt = makeFormat('MM/DD/YYYY', '24h');
    expect(formatSleepTimeSpan(undefined, at(2, 20, 30), fmt, labels)).toBe('unknown - Oct 2, 20:30');
  });
});
