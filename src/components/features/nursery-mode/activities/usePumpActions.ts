'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import { ActivityHookArgs, ActivityView, ActionButton, formatMMSS } from './types';

type PumpSide = 'left' | 'right' | 'both';
type PumpPhase = 'idle' | 'timing' | 'paused' | 'selecting_action';

/**
 * Pump activity state machine — transplanted 1:1 from PumpTile.tsx.
 * Local timer; enableBreastMilkTracking===false skips action selection;
 * POST /api/pump-log on submit.
 */
export function usePumpActions({ babyId, toUTCString, onLog, enableBreastMilkTracking = true }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<PumpPhase>('idle');
  const [activeSide, setActiveSide] = useState<PumpSide | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pauseAccumulated, setPauseAccumulated] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
    setActiveSide(activeSide === 'left' ? 'right' : 'left');
  };

  const submitPump = useCallback(async (pumpAction: string) => {
    if (submitting || !startTime || !activeSide) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const endTime = new Date();
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));

      const res = await fetch('/api/pump-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({
          babyId,
          startTime: toUTCString(startTime),
          endTime: toUTCString(endTime),
          duration: durationMinutes,
          pumpAction,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const actionLabels: Record<string, string> = {
          STORED: t('Stored'),
          FED: t('Fed'),
          DISCARDED: t('Discarded'),
        };
        const sideLabelsMap: Record<PumpSide, string> = {
          both: t('Both'),
          left: t('Left'),
          right: t('Right'),
        };
        const action = actionLabels[pumpAction] || pumpAction;
        const side = sideLabelsMap[activeSide] || activeSide;
        onLog('pump', [side, formatMMSS(elapsed), action].join(' — '));
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
    }
  }, [babyId, startTime, activeSide, elapsed, toUTCString, onLog, submitting, t]);

  const handleStop = () => {
    if (enableBreastMilkTracking === false) {
      submitPump('STORED');
    } else {
      setPhase('selecting_action');
    }
  };

  const sideLabels: Record<PumpSide, string> = {
    left: t('left side running'),
    right: t('right side running'),
    both: t('both sides running'),
  };

  const canSwitch = activeSide === 'left' || activeSide === 'right';

  let statusText: string | null = null;
  let buttons: ActionButton[] = [];

  if (phase === 'selecting_action') {
    statusText = `${formatMMSS(elapsed)} — ${t('Select Action')}`;
    buttons = [
      { key: 'stored', label: t('Stored'), onClick: () => submitPump('STORED'), disabled: submitting },
      { key: 'fed', label: t('Fed'), onClick: () => submitPump('FED'), disabled: submitting },
      { key: 'discarded', label: t('Discarded'), onClick: () => submitPump('DISCARDED'), disabled: submitting },
    ];
  } else if ((phase === 'timing' || phase === 'paused') && activeSide) {
    const isPaused = phase === 'paused';
    const sidePausedLabels: Record<PumpSide, string> = {
      left: `${t('Paused')} — ${t('Left Side')} — ${formatMMSS(elapsed)}`,
      right: `${t('Paused')} — ${t('Right Side')} — ${formatMMSS(elapsed)}`,
      both: `${t('Paused')} — ${formatMMSS(elapsed)}`,
    };
    statusText = isPaused ? sidePausedLabels[activeSide] : sideLabels[activeSide];
    if (canSwitch) {
      buttons.push({ key: 'switch', label: t('Switch'), onClick: handleSwitch });
    }
    if (isPaused) {
      buttons.push({ key: 'resume', label: t('Resume'), onClick: handleResume });
    } else {
      buttons.push({ key: 'pause', label: t('Pause'), onClick: handlePause });
    }
    buttons.push({
      key: 'stop',
      label: t('Stop'),
      onClick: handleStop,
      emphasized: true,
      timerText: isPaused ? undefined : formatMMSS(elapsed),
    });
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
    buttons,
  };
}
