'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';
import { TileShell, TileLog } from './TileShell';
import { SubButton } from './SubButton';
import { useLocalization } from '@/src/context/localization';

interface SleepTileProps {
  colors: NurseryColors;
  log: TileLog | null;
  onLog: (tileId: string, note: string) => void;
  onActiveChange?: (tileId: string, isActive: boolean) => void;
  animating: boolean;
  babyId: string;
  toUTCString: (date: Date | null | undefined) => string | null;
  expanded?: boolean;
}

const LOCATIONS = ['Crib', 'Contact'];

type SleepPhase = 'awake' | 'selecting_location' | 'sleeping';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SleepTile({ colors, log, onLog, onActiveChange, animating, babyId, toUTCString, expanded }: SleepTileProps) {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<SleepPhase>('awake');
  const [activeSleepId, setActiveSleepId] = useState<string | null>(null);
  const [sleepStart, setSleepStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Notify parent of active state changes
  useEffect(() => {
    onActiveChange?.('sleep', phase === 'sleeping');
  }, [phase, onActiveChange]);

  // Check for ongoing sleep on mount
  useEffect(() => {
    if (!babyId) return;
    const authToken = localStorage.getItem('authToken');
    const headers = { Authorization: authToken ? `Bearer ${authToken}` : '' };

    const checkOngoingSleep = async () => {
      try {
        const res = await fetch(`/api/sleep-log?babyId=${babyId}`, { headers });
        const data = await res.json();
        if (data.success && data.data) {
          const ongoing = data.data.find((s: any) => !s.endTime);
          if (ongoing) {
            setActiveSleepId(ongoing.id);
            setSleepStart(new Date(ongoing.startTime));
            setPhase('sleeping');
          }
        }
      } catch { /* ignore */ }
    };

    checkOngoingSleep();
  }, [babyId]);

  // Timer for sleeping phase
  useEffect(() => {
    if (phase === 'sleeping' && sleepStart) {
      const updateElapsed = () => {
        setElapsed(Math.floor((Date.now() - sleepStart.getTime()) / 1000));
      };
      updateElapsed();
      intervalRef.current = setInterval(updateElapsed, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [phase, sleepStart]);

  const startSleep = useCallback(async (location: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const now = new Date();
      const res = await fetch('/api/sleep-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({
          babyId,
          startTime: toUTCString(now),
          type: 'NAP',
          location,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveSleepId(data.data.id);
        setSleepStart(now);
        setPhase('sleeping');
        onLog('sleep', `${t('Start Sleep')} — ${location}`);
      }
    } catch (err) {
      console.error('Error starting sleep:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, toUTCString, onLog, submitting, t]);

  const endSleep = useCallback(async () => {
    if (submitting || !activeSleepId) return;
    setSubmitting(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const now = new Date();
      const res = await fetch(`/api/sleep-log?id=${activeSleepId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authToken ? `Bearer ${authToken}` : '',
        },
        body: JSON.stringify({ endTime: toUTCString(now) }),
      });
      const data = await res.json();
      if (data.success) {
        onLog('sleep', `${t('Wake Up')} — ${formatDuration(elapsed)}`);
        setPhase('awake');
        setActiveSleepId(null);
        setSleepStart(null);
        setElapsed(0);
      }
    } catch (err) {
      console.error('Error ending sleep:', err);
    } finally {
      setSubmitting(false);
    }
  }, [activeSleepId, elapsed, toUTCString, onLog, submitting, t]);

  if (phase === 'sleeping') {
    return (
      <TileShell
        label={t('Sleep')}
        colors={colors}
        log={log}
        animating={animating}
        sleeping
        expanded={expanded}
        statusText={`${t('Sleeping')} — ${formatDuration(elapsed)}`}
      >
        <div className="flex gap-[clamp(0.375rem,1vw,0.75rem)] mt-auto pt-3">
          <SubButton
            label={t('Wake Up')}
            onClick={endSleep}
            colors={colors}
            active
            expanded={expanded}
            timerText={formatDuration(elapsed)}
            disabled={submitting}
          />
        </div>
      </TileShell>
    );
  }

  if (phase === 'selecting_location') {
    return (
      <TileShell label={t('Sleep')} colors={colors} log={log} animating={animating} statusText={t('Select Location')}>
        <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
          {LOCATIONS.map(loc => (
            <SubButton
              key={loc}
              label={loc}
              onClick={() => startSleep(loc)}
              colors={colors}
              disabled={submitting}
            />
          ))}
        </div>
      </TileShell>
    );
  }

  return (
    <TileShell label={t('Sleep')} colors={colors} log={log} animating={animating}>
      <div className="flex gap-1.5 mt-auto pt-2">
        <SubButton label={t('Start Sleep')} onClick={() => setPhase('selecting_location')} colors={colors} />
      </div>
    </TileShell>
  );
}
