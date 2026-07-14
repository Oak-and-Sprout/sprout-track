'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocalization } from '@/src/context/localization';
import { ActiveBreastFeedResponse } from '@/app/api/types';
import { formatFeedNote, FeedNoteLabels } from '@/src/utils/nursery/activityDetail';
import { ActivityHookArgs, ActivityView, ActionButton, formatMMSS, undoDeleteLog } from './types';

type FeedPhase = 'idle' | 'feeding' | 'paused';

/**
 * Feed activity state machine — transplanted 1:1 from FeedTile.tsx.
 * Bottle instant log (avg amount) + breastfeed via /api/active-breastfeed
 * server session (POST start, PUT ?action=switch|pause|resume, DELETE finalize).
 */
export function useFeedActions({ babyId, toUTCString, onLog, onUndoable }: ActivityHookArgs): ActivityView {
  const { t } = useLocalization();
  const [avgBottleAmount, setAvgBottleAmount] = useState<number | null>(null);
  const [defaultUnit, setDefaultUnit] = useState('OZ');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<FeedPhase>('idle');
  const [activeFeed, setActiveFeed] = useState<ActiveBreastFeedResponse | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Fetch bottle defaults
  useEffect(() => {
    const fetchDefaults = async () => {
      const authToken = localStorage.getItem('authToken');
      const headers = { Authorization: authToken ? `Bearer ${authToken}` : '' };

      try {
        const settingsRes = await fetch('/api/settings', { headers });
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.data?.defaultBottleUnit) {
          setDefaultUnit(settingsData.data.defaultBottleUnit);
        }
      } catch { /* use default */ }

      try {
        const feedRes = await fetch(`/api/feed-log?babyId=${babyId}&type=BOTTLE`, { headers });
        const feedData = await feedRes.json();
        if (feedData.success && feedData.data?.length > 0) {
          const bottleFeeds = feedData.data
            .filter((f: any) => f.type === 'BOTTLE' && f.amount != null)
            .slice(0, 20);
          if (bottleFeeds.length > 0) {
            const total = bottleFeeds.reduce((sum: number, f: any) => sum + f.amount, 0);
            const avg = Math.round((total / bottleFeeds.length) * 10) / 10;
            setAvgBottleAmount(avg);
          }
        }
      } catch { /* no average available */ }
    };

    if (babyId) fetchDefaults();
  }, [babyId]);

  // Check for existing active breastfeed session on mount / baby change
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const authToken = localStorage.getItem('authToken');
        const res = await fetch(`/api/active-breastfeed?babyId=${babyId}`, {
          headers: { Authorization: authToken ? `Bearer ${authToken}` : '' },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setActiveFeed(data.data);
          setPhase(data.data.isPaused ? 'paused' : 'feeding');
        } else {
          setActiveFeed(null);
          setPhase('idle');
        }
      } catch { /* ignore */ }
    };

    if (babyId) checkActiveSession();
  }, [babyId]);

  // Timer for active breastfeed — same logic as ActiveFeedBanner
  useEffect(() => {
    if (phase !== 'feeding' || !activeFeed || activeFeed.isPaused || !activeFeed.currentSideStartTime) {
      setCurrentElapsed(0);
      return;
    }

    const calculateElapsed = () =>
      Math.floor((Date.now() - new Date(activeFeed.currentSideStartTime!).getTime()) / 1000);

    setCurrentElapsed(calculateElapsed());
    const interval = setInterval(() => setCurrentElapsed(calculateElapsed()), 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') setCurrentElapsed(calculateElapsed());
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [phase, activeFeed]);

  const feedNoteLabels: FeedNoteLabels = {
    breast: t('Breast'), bottle: t('Bottle'), formula: t('Formula'), pumpedBottle: t('Pumped Bottle'), food: t('Food'),
    left: t('Left'), right: t('Right'),
  };

  const getAuthHeaders = () => {
    const authToken = localStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: authToken ? `Bearer ${authToken}` : '',
    };
  };

  // Bottle instant log
  const submitBottle = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const now = toUTCString(new Date());
      const payload: any = { babyId, time: now, type: 'BOTTLE' };
      if (avgBottleAmount != null) {
        payload.amount = avgBottleAmount;
        payload.unitAbbr = defaultUnit;
      }
      const res = await fetch('/api/feed-log', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        const note = formatFeedNote({ type: 'BOTTLE', amount: avgBottleAmount, unitAbbr: defaultUnit }, feedNoteLabels);
        onLog('feed', note);
        if (data.data?.id) {
          const logId = data.data.id;
          onUndoable({
            tileId: 'feed',
            message: t('Bottle logged'),
            undo: () => undoDeleteLog('/api/feed-log', logId),
          });
        }
      }
    } catch (err) {
      console.error('Error logging bottle feed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, avgBottleAmount, defaultUnit, toUTCString, onLog, onUndoable, submitting, t]);

  // Start breastfeed session
  const startBreastFeed = useCallback(async (side: 'LEFT' | 'RIGHT') => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/active-breastfeed', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ babyId, side }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveFeed(data.data);
        setPhase('feeding');
      }
    } catch (err) {
      console.error('Error starting breastfeed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, submitting]);

  // Switch side
  const handleSwitch = useCallback(async () => {
    if (!activeFeed) return;
    try {
      const res = await fetch(`/api/active-breastfeed?id=${activeFeed.id}&action=switch`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveFeed(data.data);
        setPhase('feeding');
      }
    } catch (err) {
      console.error('Error switching side:', err);
    }
  }, [activeFeed]);

  // Pause
  const handlePause = useCallback(async () => {
    if (!activeFeed) return;
    try {
      const res = await fetch(`/api/active-breastfeed?id=${activeFeed.id}&action=pause`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveFeed(data.data);
        setPhase('paused');
      }
    } catch (err) {
      console.error('Error pausing feed:', err);
    }
  }, [activeFeed]);

  // Resume
  const handleResume = useCallback(async (side: 'LEFT' | 'RIGHT') => {
    if (!activeFeed) return;
    try {
      const res = await fetch(`/api/active-breastfeed?id=${activeFeed.id}&action=resume`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ side }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveFeed(data.data);
        setPhase('feeding');
      }
    } catch (err) {
      console.error('Error resuming feed:', err);
    }
  }, [activeFeed]);

  // Stop — ends session, server creates feed log entries
  const handleStop = useCallback(async () => {
    if (!activeFeed || submitting) return;
    setSubmitting(true);
    try {
      const leftTotalStop = activeFeed.leftDuration + (activeFeed.activeSide === 'LEFT' && !activeFeed.isPaused ? currentElapsed : 0);
      const rightTotalStop = activeFeed.rightDuration + (activeFeed.activeSide === 'RIGHT' && !activeFeed.isPaused ? currentElapsed : 0);

      const res = await fetch(`/api/active-breastfeed?id=${activeFeed.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leftDuration: leftTotalStop, rightDuration: rightTotalStop }),
      });
      const data = await res.json();
      if (data.success) {
        const note = formatFeedNote({
          type: 'BREAST',
          breastSides: [
            { side: 'LEFT', seconds: leftTotalStop },
            { side: 'RIGHT', seconds: rightTotalStop },
          ],
        }, feedNoteLabels);
        onLog('feed', note);
        // The server created the feed log entries; undo deletes them all.
        const createdIds: string[] = data.data?.feedLogIds || [];
        if (createdIds.length > 0) {
          onUndoable({
            tileId: 'feed',
            message: t('Feed logged'),
            undo: async () => {
              const results = await Promise.all(createdIds.map(id => undoDeleteLog('/api/feed-log', id)));
              return results.every(Boolean);
            },
          });
        }
      }
    } catch (err) {
      console.error('Error ending breastfeed:', err);
    } finally {
      setSubmitting(false);
      setActiveFeed(null);
      setPhase('idle');
      setCurrentElapsed(0);
    }
  }, [activeFeed, currentElapsed, onLog, onUndoable, submitting, t]);

  // Computed totals (same as ActiveFeedBanner)
  const leftTotal = activeFeed
    ? activeFeed.leftDuration + (activeFeed.activeSide === 'LEFT' && !activeFeed.isPaused ? currentElapsed : 0)
    : 0;
  const rightTotal = activeFeed
    ? activeFeed.rightDuration + (activeFeed.activeSide === 'RIGHT' && !activeFeed.isPaused ? currentElapsed : 0)
    : 0;

  let statusText: string | null = null;
  let buttons: ActionButton[];

  if (phase === 'paused' && activeFeed) {
    statusText = `${t('Paused')} · L: ${formatMMSS(leftTotal)} R: ${formatMMSS(rightTotal)}`;
    buttons = [
      { key: 'resumeLeft', label: t('Resume Left'), onClick: () => handleResume('LEFT'), disabled: submitting },
      { key: 'resumeRight', label: t('Resume Right'), onClick: () => handleResume('RIGHT'), disabled: submitting },
      { key: 'stop', label: t('Stop'), onClick: handleStop, emphasized: true, disabled: submitting },
    ];
  } else if (phase === 'feeding' && activeFeed) {
    const sideLabel = activeFeed.activeSide === 'LEFT' ? t('Left Side') : t('Right Side');
    const activeSideTotal = activeFeed.activeSide === 'LEFT' ? leftTotal : rightTotal;
    statusText = `${sideLabel}: ${formatMMSS(activeSideTotal)}`;
    buttons = [
      { key: 'switch', label: t('Switch'), onClick: handleSwitch, disabled: submitting },
      { key: 'pause', label: t('Pause'), onClick: handlePause, disabled: submitting },
      { key: 'stop', label: t('Stop'), onClick: handleStop, emphasized: true, disabled: submitting },
    ];
  } else {
    buttons = [
      { key: 'bottle', label: avgBottleAmount ? `${t('Bottle')} (${avgBottleAmount})` : t('Bottle'), onClick: submitBottle, disabled: submitting },
      { key: 'breastL', label: t('Left Breast'), onClick: () => startBreastFeed('LEFT'), disabled: submitting },
      { key: 'breastR', label: t('Right Breast'), onClick: () => startBreastFeed('RIGHT'), disabled: submitting },
    ];
  }

  return {
    id: 'feed',
    icon: 'bottle',
    label: t('Feed'),
    statusText,
    active: phase !== 'idle',
    question: false,
    buttons,
  };
}
