/**
 * Default sleep locations shared by SleepForm, the sleep-log API, and the
 * sleep location manager. Values are persisted as-is on SleepLog.location,
 * so they must never be reworded (rendering localizes them via t()).
 */
export const DEFAULT_SLEEP_LOCATIONS = [
  'Bassinet',
  'Stroller',
  'Crib',
  'Car Seat',
  'Parents Room',
  'Contact',
  'Other',
] as const;
