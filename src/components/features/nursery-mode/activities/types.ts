import { IconName } from '../icons';

/** Latest logged activity summary shown in a card/tile meta line. */
export interface TileLog {
  last: string;
  note: string;
}

export interface ActionButton {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  emphasized?: boolean;
  wide?: boolean;
}

export interface ActivityView {
  id: 'feed' | 'pump' | 'diaper' | 'sleep';
  icon: IconName; // bottle | pump | diaper | moon
  label: string; // localized
  statusText: string | null; // active timer line, e.g. "Left Side — 4:12 · L: 4:12 R: 0:00"
  active: boolean; // a timer/session is running
  buttons: ActionButton[];
}

export interface UndoInfo {
  tileId: 'feed' | 'pump' | 'diaper' | 'sleep';
  message: string;
  /** Reverts the just-logged action (delete the entry, or resume a session); resolves true on success. */
  undo: () => Promise<boolean>;
}

/** Shared undo helper: hard-delete a just-created log entry via its route's DELETE ?id=. */
export async function undoDeleteLog(endpoint: string, id: string): Promise<boolean> {
  try {
    const authToken = localStorage.getItem('authToken');
    const res = await fetch(`${endpoint}?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
    });
    const data = await res.json();
    return !!data.success;
  } catch (err) {
    console.error('Undo failed:', err);
    return false;
  }
}

export interface ActivityHookArgs {
  babyId: string;
  toUTCString: (d: Date | null | undefined) => string | null;
  onLog: (tileId: string, note: string) => void;
  onUndoable: (u: UndoInfo) => void; // instant logs only (bottle, diaper)
  enableBreastMilkTracking?: boolean;
}

/** m:ss — replaces the FeedTile/PumpTile local formatDuration. */
export function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** h:mm:ss when >= 1h, else m:ss — replaces the SleepTile local formatDuration. */
export function formatHMMSS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
