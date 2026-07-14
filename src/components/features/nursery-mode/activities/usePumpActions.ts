'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import { formatPumpNote, PumpNoteLabels } from '@/src/utils/nursery/activityDetail';
import { loadPumpSession, savePumpSession, clearPumpSession } from '@/src/utils/nursery/pumpSession';
import { ActivityHookArgs, ActivityView, ActionButton, AmountPrompt, formatMMSS, undoDeleteLog } from './types';

type PumpSide = 'left' | 'right' | 'both';
type PumpPhase = 'idle' | 'timing' | 'paused' | 'selecting_action';

/**
 * Pump activity state machine — transplanted 1:1 from PumpTile.tsx.
 * Local timer; enableBreastMilkTracking===false skips action selection;
 * POST /api/pump-log on submit.
 */
export function usePumpActions({ babyId, toUTCString, onLog, onUndoable, enableBreastMilkTracking = true }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<PumpPhase>('idle');
  const [activeSide, setActiveSide] = useState<PumpSide | null>(null);
  const [elapsed, setElapsed] = useState(0);
  // Seconds already banked for each side by a prior segment (folded in on switch) —
  // 'both' never switches, so these stay 0 and the whole session lives in `elapsed`.
  const [sideDuration, setSideDuration] = useState({ left: 0, right: 0 });
  const [pauseAccumulated, setPauseAccumulated] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [defaultUnit, setDefaultUnit] = useState('OZ');
  const [amountLeft, setAmountLeft] = useState('');
  const [amountRight, setAmountRight] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch bottle/pump amount unit default (same setting FeedTile uses).
  useEffect(() => {
    const fetchDefaultUnit = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const res = await fetch('/api/settings', { headers: { Authorization: authToken ? `Bearer ${authToken}` : '' } });
        const data = await res.json();
        if (data.success && data.data?.defaultBottleUnit) setDefaultUnit(data.data.defaultBottleUnit);
      } catch { /* use default */ }
    };
    fetchDefaultUnit();
  }, []);

  // Guards the persistence effect below against writing a stale ('idle') snapshot
  // in the same render pass this rehydration effect fires in — state updates from
  // this effect aren't visible to other effects until the next render, so without
  // this flag the persist effect would clear out the session we're about to restore.
  const skipNextPersistRef = useRef(true);

  // Pump sessions have no server-side "active session" record (unlike
  // breastfeeding/sleep), so on mount / baby switch, recall any in-progress local
  // timer from localStorage — otherwise a reload or switching babies loses it, and
  // Stop would either log nothing or log against the wrong baby.
  useEffect(() => {
    skipNextPersistRef.current = true;
    const snapshot = loadPumpSession(babyId);
    if (snapshot) {
      setPhase(snapshot.phase);
      setActiveSide(snapshot.activeSide);
      setStartTime(new Date(snapshot.startTime));
      setSideDuration(snapshot.sideDuration);
      setPauseAccumulated(snapshot.pauseAccumulated);
      setResumeTime(snapshot.resumeTime);
      setElapsed(snapshot.elapsed);
      setAmountLeft(snapshot.amountLeft);
      setAmountRight(snapshot.amountRight);
    } else {
      setPhase('idle');
      setActiveSide(null);
      setElapsed(0);
      setSideDuration({ left: 0, right: 0 });
      setPauseAccumulated(0);
      setStartTime(null);
      setResumeTime(null);
      setAmountLeft('');
      setAmountRight('');
    }
  }, [babyId]);

  // Mirror the in-progress session to localStorage (keyed per baby) on every change
  // so it survives a reload and can be recalled before the final POST /api/pump-log.
  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    if (!babyId) return;
    if (phase === 'idle' || !startTime || !activeSide) {
      clearPumpSession(babyId);
      return;
    }
    savePumpSession(babyId, {
      phase,
      activeSide,
      startTime: startTime.toISOString(),
      sideDuration,
      pauseAccumulated,
      resumeTime,
      elapsed,
      amountLeft,
      amountRight,
    });
  }, [babyId, phase, activeSide, startTime, sideDuration, pauseAccumulated, resumeTime, elapsed, amountLeft, amountRight]);

  useEffect(() => {
    if (phase === 'timing' && resumeTime != null) {
      const update = () => {
        const now = Date.now();
        setElapsed(pauseAccumulated + Math.floor((now - resumeTime) / 1000));
      };
      update();
      intervalRef.current = setInterval(update, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, resumeTime, pauseAccumulated]);

  const handleStart = (side: PumpSide) => {
    setActiveSide(side);
    setStartTime(new Date());
    setPauseAccumulated(0);
    setResumeTime(Date.now());
    setElapsed(0);
    setSideDuration({ left: 0, right: 0 });
    setAmountLeft('');
    setAmountRight('');
    setPhase('timing');
  };

  const handlePause = () => {
    setPauseAccumulated(elapsed);
    setResumeTime(null);
    setPhase('paused');
  };

  const handleResume = () => {
    setResumeTime(Date.now());
    setPhase('timing');
  };

  const handleSwitch = () => {
    if (!activeSide || activeSide === 'both') return;
    setSideDuration(prev => ({ ...prev, [activeSide]: prev[activeSide] + elapsed }));
    setActiveSide(activeSide === 'left' ? 'right' : 'left');
    setPauseAccumulated(0);
    setResumeTime(Date.now());
    setElapsed(0);
  };

  const submitPump = useCallback(async (pumpAction: string) => {
    if (submitting || !startTime || !activeSide) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const endTime = new Date();
      const totalElapsed = sideDuration.left + sideDuration.right + elapsed;
      const durationMinutes = Math.max(1, Math.round(totalElapsed / 60));
      const leftVal = amountLeft.trim() !== '' ? parseFloat(amountLeft) : undefined;
      const rightVal = amountRight.trim() !== '' ? parseFloat(amountRight) : undefined;
      const hasLeft = leftVal !== undefined && !isNaN(leftVal);
      const hasRight = rightVal !== undefined && !isNaN(rightVal);

      const payload: Record<string, unknown> = {
        babyId,
        startTime: toUTCString(startTime),
        endTime: toUTCString(endTime),
        duration: durationMinutes,
        pumpAction,
      };
      if (hasLeft) payload.leftAmount = leftVal;
      if (hasRight) payload.rightAmount = rightVal;
      if (hasLeft || hasRight) payload.unitAbbr = defaultUnit;

      const res = await fetch('/api/pump-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const pumpNoteLabels: PumpNoteLabels = {
          left: t('Left'), right: t('Right'), both: t('Both'),
          stored: t('Stored'), fed: t('Fed'), discarded: t('Discarded'),
        };
        const note = formatPumpNote({
          side: activeSide,
          leftAmount: hasLeft ? leftVal : null,
          rightAmount: hasRight ? rightVal : null,
          unitAbbr: defaultUnit,
          durationSeconds: totalElapsed,
          action: pumpAction,
        }, pumpNoteLabels);
        onLog('pump', note);
        if (data.data?.id) {
          const logId = data.data.id;
          onUndoable({
            tileId: 'pump',
            message: t('Pump logged'),
            undo: () => undoDeleteLog('/api/pump-log', logId),
          });
        }
      }
    } catch (err) {
      console.error('Error logging pump:', err);
    } finally {
      setSubmitting(false);
      setPhase('idle');
      setActiveSide(null);
      setStartTime(null);
      setResumeTime(null);
      setPauseAccumulated(0);
      setElapsed(0);
      setSideDuration({ left: 0, right: 0 });
      setAmountLeft('');
      setAmountRight('');
    }
  }, [babyId, startTime, activeSide, elapsed, sideDuration, amountLeft, amountRight, defaultUnit, toUTCString, onLog, onUndoable, submitting, t]);

  const handleStop = () => {
    if (enableBreastMilkTracking === false) {
      submitPump('STORED');
    } else {
      setPhase('selecting_action');
    }
  };

  const sideLabels: Record<PumpSide, string> = {
    left: t('Left Side'),
    right: t('Right Side'),
    both: t('Both'),
  };

  const canSwitch = activeSide === 'left' || activeSide === 'right';
  // Total across every segment/side so far — sideDuration holds completed segments
  // (folded in on switch), `elapsed` is whichever side is currently live.
  const totalElapsed = sideDuration.left + sideDuration.right + elapsed;

  let statusText: string | null = null;
  let buttons: ActionButton[] = [];
  let amountPrompt: AmountPrompt | null = null;

  if (phase === 'selecting_action') {
    statusText = `${formatMMSS(totalElapsed)} — ${t('Select Action')}`;
    const unit = defaultUnit.toLowerCase();
    // Show a field for every side that was actually pumped this session — not just
    // the side active at Stop — so switching left/right mid-session still lets you
    // enter an amount for both instead of silently dropping the finished side.
    const leftUsed = activeSide === 'both' || activeSide === 'left' || sideDuration.left > 0;
    const rightUsed = activeSide === 'both' || activeSide === 'right' || sideDuration.right > 0;
    const fields = [];
    if (leftUsed) fields.push({ key: 'left', label: t('Left'), value: amountLeft, onChange: setAmountLeft, unit });
    if (rightUsed) fields.push({ key: 'right', label: t('Right'), value: amountRight, onChange: setAmountRight, unit });
    amountPrompt = { fields };
    buttons = [
      { key: 'stored', label: t('Stored'), onClick: () => submitPump('STORED'), disabled: submitting },
      { key: 'fed', label: t('Fed'), onClick: () => submitPump('FED'), disabled: submitting },
      { key: 'discarded', label: t('Discarded'), onClick: () => submitPump('DISCARDED'), disabled: submitting },
    ];
  } else if ((phase === 'timing' || phase === 'paused') && activeSide) {
    const isPaused = phase === 'paused';
    let sideTimer: string;
    if (activeSide === 'both') {
      sideTimer = `${sideLabels.both}: ${formatMMSS(elapsed)}`;
    } else {
      const other = activeSide === 'left' ? 'right' : 'left';
      const activeTotal = sideDuration[activeSide] + elapsed;
      const otherTotal = sideDuration[other];
      const shortOtherLabel = other === 'left' ? t('Left') : t('Right');
      sideTimer = `${sideLabels[activeSide]}: ${formatMMSS(activeTotal)}`;
      if (otherTotal > 0) sideTimer += ` (${shortOtherLabel}: ${formatMMSS(otherTotal)})`;
    }
    statusText = isPaused ? `${t('Paused')} · ${sideTimer}` : sideTimer;
    if (canSwitch) {
      buttons.push({ key: 'switch', label: t('Switch'), onClick: handleSwitch });
    }
    if (isPaused) {
      buttons.push({ key: 'resume', label: t('Resume'), onClick: handleResume });
    } else {
      buttons.push({ key: 'pause', label: t('Pause'), onClick: handlePause });
    }
    buttons.push({ key: 'stop', label: t('Stop'), onClick: handleStop, emphasized: true, keepOpen: enableBreastMilkTracking !== false });
  } else {
    buttons = [
      { key: 'startLeft', label: t('Start Left'), onClick: () => handleStart('left') },
      { key: 'startRight', label: t('Start Right'), onClick: () => handleStart('right') },
      { key: 'startBoth', label: t('Start Both'), onClick: () => handleStart('both') },
    ];
  }

  return {
    id: 'pump',
    icon: 'pump',
    label: t('Pump'),
    statusText,
    active: phase === 'timing' || phase === 'paused',
    question: phase === 'selecting_action',
    amountPrompt,
    buttons,
  };
}
