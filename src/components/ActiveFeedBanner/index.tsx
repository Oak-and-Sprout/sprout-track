'use client';

import { useState, useEffect, useCallback } from 'react';
import { ActiveBreastFeedResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';
import { ArrowLeftRight, Pause, Play, Square } from 'lucide-react';
import './active-feed-banner.css';

interface ActiveFeedBannerProps {
  activeFeed: ActiveBreastFeedResponse | null;
  onSwitch: () => void;
  onPause: () => void;
  onResume: (side: 'LEFT' | 'RIGHT') => void;
  onEnd: () => void;
  onOpenForm: () => void;
}

const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function ActiveFeedBanner({
  activeFeed,
  onSwitch,
  onPause,
  onResume,
  onEnd,
  onOpenForm,
}: ActiveFeedBannerProps) {
  const { t } = useLocalization();
  const [currentElapsed, setCurrentElapsed] = useState(0);

  const calculateElapsed = useCallback(() => {
    if (!activeFeed || activeFeed.isPaused || !activeFeed.currentSideStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - new Date(activeFeed.currentSideStartTime).getTime()) / 1000);
  }, [activeFeed]);

  useEffect(() => {
    if (!activeFeed || activeFeed.isPaused) {
      setCurrentElapsed(0);
      return;
    }

    // Update immediately
    setCurrentElapsed(calculateElapsed());

    // Update every second
    const interval = setInterval(() => {
      setCurrentElapsed(calculateElapsed());
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setCurrentElapsed(calculateElapsed());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeFeed, calculateElapsed]);

  if (!activeFeed) return null;

  const leftTotal = activeFeed.leftDuration + (activeFeed.activeSide === 'LEFT' && !activeFeed.isPaused ? currentElapsed : 0);
  const rightTotal = activeFeed.rightDuration + (activeFeed.activeSide === 'RIGHT' && !activeFeed.isPaused ? currentElapsed : 0);
  const activeSideTotal = activeFeed.activeSide === 'LEFT' ? leftTotal : rightTotal;

  return (
    <div
      className="active-feed-banner p-2 cursor-pointer transition-all"
      onClick={onOpenForm}
    >
      <div className={`banner-inner-card rounded-xl p-4 mx-3 shadow-md ${
        activeFeed.isPaused ? 'banner-inner-paused' : 'banner-inner-active'
      }`}>
      {/* Active state */}
      {!activeFeed.isPaused && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium banner-label">
              {activeFeed.activeSide === 'LEFT' ? t('Left Side') : t('Right Side')}
            </span>
            <span className="text-2xl font-mono font-bold banner-timer">
              {formatDuration(activeSideTotal)}
            </span>
            <div className="flex gap-3 text-xs banner-subtimes mt-0.5">
              <span>L: {formatDuration(leftTotal)}</span>
              <span>R: {formatDuration(rightTotal)}</span>
            </div>
          </div>
          <div className="flex gap-2.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={onSwitch}
              className="banner-btn banner-btn-switch"
              title={t('Switch Side')}
            >
              <ArrowLeftRight className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onPause}
              className="banner-btn banner-btn-pause"
              title={t('Pause Feed')}
            >
              <Pause className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="banner-btn banner-btn-stop"
              title={t('End Feed')}
            >
              <Square className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Paused state */}
      {activeFeed.isPaused && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium banner-paused-label">
              {t('Breastfeeding Paused')}
            </span>
            <div className="flex gap-3 text-sm font-mono font-semibold banner-subtimes mt-0.5">
              <span>L: {formatDuration(leftTotal)}</span>
              <span>R: {formatDuration(rightTotal)}</span>
            </div>
          </div>
          <div className="flex gap-2.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onResume('LEFT')}
              className="banner-btn banner-btn-resume"
              title={t('Resume Left')}
            >
              <Play className="h-5 w-5 mr-0.5" />
              <span className="text-xs font-semibold">L</span>
            </button>
            <button
              type="button"
              onClick={() => onResume('RIGHT')}
              className="banner-btn banner-btn-resume"
              title={t('Resume Right')}
            >
              <Play className="h-5 w-5 mr-0.5" />
              <span className="text-xs font-semibold">R</span>
            </button>
            <button
              type="button"
              onClick={onEnd}
              className="banner-btn banner-btn-stop"
              title={t('End Feed')}
            >
              <Square className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
