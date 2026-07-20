/**
 * Client-side gating for the breastfeeding start timestamp.
 *
 * The feed form seeds its date/time state to the top of the current minute
 * (the picker carries no seconds). If that value were sent as the session
 * start whenever the user simply taps "start", the live timer would open
 * already showing the seconds elapsed since the top of the minute. So we only
 * send an explicit start time when the user actually touched the time picker
 * (i.e. deliberately backdated the session); otherwise we omit it and let the
 * server start the session at "now".
 */
export function resolveClientStartTime(
  touched: boolean,
  selectedDateTime: Date | null | undefined
): Date | undefined {
  if (!touched || !selectedDateTime) return undefined;
  return selectedDateTime;
}
