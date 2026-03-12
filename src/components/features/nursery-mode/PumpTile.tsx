'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';
import { TileShell, TileLog } from './TileShell';
import { SubButton } from './SubButton';
import { useLocalization } from '@/src/context/localization';

interface PumpTileProps {
  colors: NurseryColors;
  log: TileLog | null;
  onLog: (tileId: string, note: string) => void;
  onActiveChange?: (tileId: string, isActive: boolean) => void;
  animating: boolean;
  babyId: string;
  toUTCString: (date: Date | null | undefined) => string | null;
  expanded?: boolean;
}

type PumpSide = 'left' | 'right' | 'both';
type PumpPhase = 'idle' | 'timing' | 'paused' | 'selecting_action';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PumpTile({ colors, log, onLog, onActiveChange, animating, babyId, toUTCString, expanded }: PumpTileProps) {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<PumpPhase>('idle');
  const [activeSide, setActiveSide] = useState<PumpSide | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [pauseAccumulated, setPauseAccumulated] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [resumeTime, setResumeTime] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Notify parent of active state changes
  useEffect(() => {
    const isActive = phase === 'timing' || phase === 'paused';
    onActiveChange?.('pump', isActive);
  }, [phase, onActiveChange]);

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

  const handleStop = () => {
    setPhase('selecting_action');
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
        onLog('pump', `${activeSide} — ${formatDuration(elapsed)} — ${actionLabels[pumpAction] || pumpAction}`);
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

  const sideLabels: Record<PumpSide, string> = {
    left: t('left side running'),
    right: t('right side running'),
    both: t('both sides running'),
  };

  const canSwitch = activeSide === 'left' || activeSide === 'right';

  if (phase === 'selecting_action') {
    return (
      <TileShell
        label={t('Pump')}
        colors={colors}
        log={log}
        animating={animating}
        expanded={expanded}
        statusText={`${formatDuration(elapsed)} — ${t('Select Action')}`}
      >
        <div className="flex gap-[clamp(0.375rem,1vw,0.75rem)] mt-auto pt-3">
          <SubButton label={t('Stored')} onClick={() => submitPump('STORED')} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Fed')} onClick={() => submitPump('FED')} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Discarded')} onClick={() => submitPump('DISCARDED')} colors={colors} disabled={submitting} expanded={expanded} />
        </div>
      </TileShell>
    );
  }

  // Shared button layout for timing and paused: [Switch?] [Pause/Resume] [Stop]
  if ((phase === 'timing' || phase === 'paused') && activeSide) {
    const isPaused = phase === 'paused';
    const sidePausedLabels: Record<PumpSide, string> = {
      left: `${t('Paused')} — ${t('Left Side')} — ${formatDuration(elapsed)}`,
      right: `${t('Paused')} — ${t('Right Side')} — ${formatDuration(elapsed)}`,
      both: `${t('Paused')} — ${formatDuration(elapsed)}`,
    };

    return (
      <TileShell
        label={t('Pump')}
        colors={colors}
        log={log}
        animating={animating}
        expanded={expanded}
        statusText={isPaused ? sidePausedLabels[activeSide] : sideLabels[activeSide]}
      >
        <div className="flex gap-[clamp(0.375rem,1vw,0.75rem)] mt-auto pt-3">
          {canSwitch && (
            <SubButton label={t('Switch')} onClick={handleSwitch} colors={colors} expanded={expanded} />
          )}
          {isPaused ? (
            <SubButton label={t('Resume')} onClick={handleResume} colors={colors} expanded={expanded} />
          ) : (
            <SubButton label={t('Pause')} onClick={handlePause} colors={colors} expanded={expanded} />
          )}
          <SubButton
            label={t('Stop')}
            onClick={handleStop}
            colors={colors}
            active
            expanded={expanded}
            timerText={isPaused ? undefined : formatDuration(elapsed)}
          />
        </div>
      </TileShell>
    );
  }

  return (
    <TileShell label={t('Pump')} colors={colors} log={log} animating={animating}>
      <div className="flex gap-1.5 mt-auto pt-2">
        <SubButton label={t('Start Left')} onClick={() => handleStart('left')} colors={colors} />
        <SubButton label={t('Start Right')} onClick={() => handleStart('right')} colors={colors} />
        <SubButton label={t('Start Both')} onClick={() => handleStart('both')} colors={colors} />
      </div>
    </TileShell>
  );
}
