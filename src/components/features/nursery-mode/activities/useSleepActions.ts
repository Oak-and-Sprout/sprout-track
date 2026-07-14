'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import { ActivityHookArgs, ActivityView, ActionButton, formatHMMSS } from './types';

// Intentional nursery-mode subset of DEFAULT_SLEEP_LOCATIONS (src/constants/sleepLocations.ts)
const LOCATIONS = ['Crib', 'Contact'];

type SleepPhase = 'awake' | 'selecting_location' | 'sleeping';

/**
 * Sleep activity state machine — transplanted 1:1 from SleepTile.tsx.
 * POST start captures id; PUT ?id= endTime on wake; checks ongoing sleep on mount.
 */
export function useSleepActions({ babyId, toUTCString, onLog }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<SleepPhase>('awake');
  const [activeSleepId, setActiveSleepId] = useState<string | null>(null);
  const [sleepStart, setSleepStart] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

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
        onLog('sleep', `${t('Wake Up')} — ${formatHMMSS(elapsed)}`);
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

  let statusText: string | null = null;
  let buttons: ActionButton[];

  if (phase === 'sleeping') {
    statusText = `${t('Sleeping')} — ${formatHMMSS(elapsed)}`;
    buttons = [
      { key: 'wake', label: t('Wake Up'), onClick: endSleep, emphasized: true, timerText: formatHMMSS(elapsed), disabled: submitting, wide: true },
    ];
  } else if (phase === 'selecting_location') {
    statusText = t('Select Location');
    buttons = LOCATIONS.map(loc => ({
      key: loc,
      label: t(loc),
      onClick: () => startSleep(loc),
      disabled: submitting,
    }));
  } else {
    buttons = [
      { key: 'startSleep', label: t('Start Sleep'), onClick: () => setPhase('selecting_location'), wide: true },
    ];
  }

  return {
    id: 'sleep',
    icon: 'moon',
    label: t('Sleep'),
    statusText,
    active: phase === 'sleeping',
    buttons,
  };
}
