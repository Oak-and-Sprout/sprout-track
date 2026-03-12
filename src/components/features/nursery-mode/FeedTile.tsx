'use client';

import { useState, useEffect, useCallback } from 'react';
import { NurseryColors } from '@/src/hooks/useNurseryColors';
import { TileShell, TileLog } from './TileShell';
import { SubButton } from './SubButton';
import { useLocalization } from '@/src/context/localization';
import { ActiveBreastFeedResponse } from '@/app/api/types';

interface FeedTileProps {
  colors: NurseryColors;
  log: TileLog | null;
  onLog: (tileId: string, note: string) => void;
  onActiveChange?: (tileId: string, isActive: boolean) => void;
  animating: boolean;
  babyId: string;
  toUTCString: (date: Date | null | undefined) => string | null;
  expanded?: boolean;
}

type FeedPhase = 'idle' | 'feeding' | 'paused';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function FeedTile({ colors, log, onLog, onActiveChange, animating, babyId, toUTCString, expanded }: FeedTileProps) {
  const { t } = useLocalization();
  const [avgBottleAmount, setAvgBottleAmount] = useState<number | null>(null);
  const [defaultUnit, setDefaultUnit] = useState('OZ');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<FeedPhase>('idle');
  const [activeFeed, setActiveFeed] = useState<ActiveBreastFeedResponse | null>(null);
  const [currentElapsed, setCurrentElapsed] = useState(0);

  // Notify parent of active state changes
  useEffect(() => {
    onActiveChange?.('feed', phase !== 'idle');
  }, [phase, onActiveChange]);

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
        onLog('feed', `${t('Bottle')}${avgBottleAmount ? ` ${avgBottleAmount} ${defaultUnit.toLowerCase()}` : ''}`);
      }
    } catch (err) {
      console.error('Error logging bottle feed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [babyId, avgBottleAmount, defaultUnit, toUTCString, onLog, submitting, t]);

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
      const leftTotal = activeFeed.leftDuration + (activeFeed.activeSide === 'LEFT' && !activeFeed.isPaused ? currentElapsed : 0);
      const rightTotal = activeFeed.rightDuration + (activeFeed.activeSide === 'RIGHT' && !activeFeed.isPaused ? currentElapsed : 0);

      const res = await fetch(`/api/active-breastfeed?id=${activeFeed.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ leftDuration: leftTotal, rightDuration: rightTotal }),
      });
      const data = await res.json();
      if (data.success) {
        const parts = [];
        if (leftTotal > 0) parts.push(`L: ${formatDuration(leftTotal)}`);
        if (rightTotal > 0) parts.push(`R: ${formatDuration(rightTotal)}`);
        onLog('feed', parts.join(' ') || t('Breast L'));
      }
    } catch (err) {
      console.error('Error ending breastfeed:', err);
    } finally {
      setSubmitting(false);
      setActiveFeed(null);
      setPhase('idle');
      setCurrentElapsed(0);
    }
  }, [activeFeed, currentElapsed, onLog, submitting, t]);

  // Computed totals (same as ActiveFeedBanner)
  const leftTotal = activeFeed
    ? activeFeed.leftDuration + (activeFeed.activeSide === 'LEFT' && !activeFeed.isPaused ? currentElapsed : 0)
    : 0;
  const rightTotal = activeFeed
    ? activeFeed.rightDuration + (activeFeed.activeSide === 'RIGHT' && !activeFeed.isPaused ? currentElapsed : 0)
    : 0;

  // Paused phase
  if (phase === 'paused' && activeFeed) {
    return (
      <TileShell
        label={t('Feed')}
        colors={colors}
        log={log}
        animating={animating}
        expanded={expanded}
        statusText={`${t('Paused')}  ·  L: ${formatDuration(leftTotal)}  R: ${formatDuration(rightTotal)}`}
      >
        <div className="flex gap-[clamp(0.375rem,1vw,0.75rem)] mt-auto pt-3">
          <SubButton label={t('Resume Left')} onClick={() => handleResume('LEFT')} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Resume Right')} onClick={() => handleResume('RIGHT')} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Stop')} onClick={handleStop} colors={colors} active disabled={submitting} expanded={expanded} />
        </div>
      </TileShell>
    );
  }

  // Feeding phase
  if (phase === 'feeding' && activeFeed) {
    const sideLabel = activeFeed.activeSide === 'LEFT' ? t('Left Side') : t('Right Side');
    const activeSideTotal = activeFeed.activeSide === 'LEFT' ? leftTotal : rightTotal;

    return (
      <TileShell
        label={t('Feed')}
        colors={colors}
        log={log}
        animating={animating}
        expanded={expanded}
        statusText={`${sideLabel} — ${formatDuration(activeSideTotal)}  ·  L: ${formatDuration(leftTotal)}  R: ${formatDuration(rightTotal)}`}
      >
        <div className="flex gap-[clamp(0.375rem,1vw,0.75rem)] mt-auto pt-3">
          <SubButton label={t('Switch')} onClick={handleSwitch} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Pause')} onClick={handlePause} colors={colors} disabled={submitting} expanded={expanded} />
          <SubButton label={t('Stop')} onClick={handleStop} colors={colors} active disabled={submitting} expanded={expanded} />
        </div>
      </TileShell>
    );
  }

  // Idle phase
  return (
    <TileShell label={t('Feed')} colors={colors} log={log} animating={animating}>
      <div className="flex gap-1.5 mt-auto pt-2">
        <SubButton
          label={avgBottleAmount ? `${t('Bottle')} (${avgBottleAmount})` : t('Bottle')}
          onClick={submitBottle}
          colors={colors}
          disabled={submitting}
        />
        <SubButton label={t('Breast L')} onClick={() => startBreastFeed('LEFT')} colors={colors} disabled={submitting} />
        <SubButton label={t('Breast R')} onClick={() => startBreastFeed('RIGHT')} colors={colors} disabled={submitting} />
      </div>
    </TileShell>
  );
}
