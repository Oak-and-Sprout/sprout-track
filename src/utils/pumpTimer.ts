interface PumpLikeActivity {
  readonly startTime?: unknown;
  readonly endTime?: unknown;
  readonly leftAmount?: unknown;
  readonly rightAmount?: unknown;
  readonly totalAmount?: unknown;
}

function isPumpActivity(value: unknown): value is PumpLikeActivity {
  if (typeof value !== 'object' || value === null) return false;

  const activity = value as Record<string, unknown>;
  return (
    typeof activity.startTime === 'string' &&
    ('leftAmount' in activity ||
      'rightAmount' in activity ||
      'totalAmount' in activity)
  );
}

/**
 * Returns the end of the latest pumping session. Older records without an
 * end time use their start time so they can still reset the reminder.
 */
export function findLatestPumpTime(
  activities: readonly unknown[],
): Date | undefined {
  let latestTimestamp: number | undefined;

  activities.forEach(activity => {
    if (!isPumpActivity(activity)) return;

    const candidate =
      typeof activity.endTime === 'string' && activity.endTime
        ? activity.endTime
        : activity.startTime;
    const timestamp = new Date(candidate as string).getTime();

    if (
      Number.isFinite(timestamp) &&
      (latestTimestamp === undefined || timestamp > latestTimestamp)
    ) {
      latestTimestamp = timestamp;
    }
  });

  return latestTimestamp === undefined
    ? undefined
    : new Date(latestTimestamp);
}
