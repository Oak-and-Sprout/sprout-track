// Pure localStorage read/write/validate helpers for the in-progress pump timer.
// Pump has no server-side "active session" record (unlike breastfeeding/sleep), so a
// page reload or a baby switch-and-back would otherwise lose an in-progress session
// entirely — this mirrors that persistence locally, scoped per baby.

export type PumpSessionPhase = 'timing' | 'paused' | 'selecting_action';
export type PumpSessionSide = 'left' | 'right' | 'both';

export interface PumpSessionSnapshot {
  phase: PumpSessionPhase;
  activeSide: PumpSessionSide;
  startTime: string;
  sideDuration: { left: number; right: number };
  pauseAccumulated: number;
  resumeTime: number | null;
  elapsed: number;
  amountLeft: string;
  amountRight: string;
}

const STORAGE_PREFIX = 'nurseryPumpSessionV1:';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0;
}

export function pumpSessionKey(babyId: string): string {
  return `${STORAGE_PREFIX}${babyId}`;
}

export function parsePumpSessionSnapshot(raw: unknown): PumpSessionSnapshot | null {
  if (!isPlainObject(raw)) return null;

  const phase = raw.phase;
  if (phase !== 'timing' && phase !== 'paused' && phase !== 'selecting_action') return null;

  const activeSide = raw.activeSide;
  if (activeSide !== 'left' && activeSide !== 'right' && activeSide !== 'both') return null;

  if (typeof raw.startTime !== 'string' || isNaN(Date.parse(raw.startTime))) return null;

  const sideDuration = raw.sideDuration;
  if (!isPlainObject(sideDuration) || !isNonNegNumber(sideDuration.left) || !isNonNegNumber(sideDuration.right)) return null;

  if (!isNonNegNumber(raw.pauseAccumulated)) return null;
  if (raw.resumeTime !== null && !isNonNegNumber(raw.resumeTime)) return null;
  if (!isNonNegNumber(raw.elapsed)) return null;
  if (typeof raw.amountLeft !== 'string' || typeof raw.amountRight !== 'string') return null;

  return {
    phase,
    activeSide,
    startTime: raw.startTime,
    sideDuration: { left: sideDuration.left, right: sideDuration.right },
    pauseAccumulated: raw.pauseAccumulated,
    resumeTime: raw.resumeTime,
    elapsed: raw.elapsed,
    amountLeft: raw.amountLeft,
    amountRight: raw.amountRight,
  };
}

export function loadPumpSession(babyId: string): PumpSessionSnapshot | null {
  if (typeof window === 'undefined' || !babyId) return null;
  try {
    const raw = window.localStorage.getItem(pumpSessionKey(babyId));
    if (!raw) return null;
    return parsePumpSessionSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePumpSession(babyId: string, snapshot: PumpSessionSnapshot): void {
  if (typeof window === 'undefined' || !babyId) return;
  try {
    window.localStorage.setItem(pumpSessionKey(babyId), JSON.stringify(snapshot));
  } catch {
    // ignore quota/storage errors
  }
}

export function clearPumpSession(babyId: string): void {
  if (typeof window === 'undefined' || !babyId) return;
  try {
    window.localStorage.removeItem(pumpSessionKey(babyId));
  } catch {
    // ignore quota/storage errors
  }
}
