/**
 * The single answer to "is this session unlocked?", shared by the app's own
 * unlock state and by the native relock gate.
 *
 * `unlockTime` is a *last-activity* stamp: `updateUnlockTimer` in
 * `app/(app)/[slug]/client-layout.tsx` rewrites it on every click, keydown,
 * mousemove and touchstart, and logout removes it. So its **presence** means
 * unlocked and its **age** means nothing here — idle is not logged out. The
 * relock gate previously required it to be under 60 seconds old, which bounced
 * valid sessions back to the shell on any reload after a minute of idle.
 *
 * Account holders and system administrators never carry an `unlockTime`; the
 * PIN flow is the only one that sets it.
 *
 * Behaviour is deliberately identical to the inline computation it replaces,
 * down to treating an undecodable payload as "neither flag set" rather than
 * throwing — the gate and the app disagreeing is the defect being fixed.
 */
export function isSessionUnlocked(input: {
  authToken: string | null;
  unlockTime: string | null;
}): boolean {
  const { authToken, unlockTime } = input;
  if (!authToken) return false;

  let isAccountAuth = false;
  let isSysAdmin = false;
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    isAccountAuth = payload.isAccountAuth || false;
    isSysAdmin = payload.isSysAdmin || false;
  } catch {
    /* Undecodable payload: fall through to the unlockTime check below. */
  }

  return !!(isAccountAuth || isSysAdmin || unlockTime);
}
