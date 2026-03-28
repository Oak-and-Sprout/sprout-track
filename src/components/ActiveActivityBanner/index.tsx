'use client';

import { useState, useEffect, useCallback } from 'react';
import { ActiveActivityResponse } from '@/app/api/types';
import { useLocalization } from '@/src/context/localization';
import { Pause, Play, Square } from 'lucide-react';
import './active-activity-banner.css';

interface ActiveActivityBannerProps {
  activeActivity: ActiveActivityResponse | null;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  onOpenForm: () => void;
}

const PLAY_TYPE_LABELS: Record<string, string> = {
  TUMMY_TIME: 'Tummy Time',
  INDOOR_PLAY: 'Indoor Play',
  OUTDOOR_PLAY: 'Outdoor Play',
  WALK: 'Walk',
  CUSTOM: 'Activity',
};

const formatDuration = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function ActiveActivityBanner({
  activeActivity,
  onPause,
  onResume,
  onEnd,
  onOpenForm,
}: ActiveActivityBannerProps) {
  const { t } = useLocalization();
  const [currentElapsed, setCurrentElapsed] = useState(0);

  const calculateElapsed = useCallback(() => {
    if (!activeActivity || activeActivity.isPaused || !activeActivity.currentStartTime) {
      return 0;
    }
    return Math.floor((Date.now() - new Date(activeActivity.currentStartTime).getTime()) / 1000);
  }, [activeActivity]);

  useEffect(() => {
    if (!activeActivity || activeActivity.isPaused) {
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
  }, [activeActivity, calculateElapsed]);

  if (!activeActivity) return null;

  const totalDuration = activeActivity.duration + (activeActivity.isPaused ? 0 : currentElapsed);
  const playTypeLabel = t(PLAY_TYPE_LABELS[activeActivity.playType] || 'Activity');
  const meta = [activeActivity.subCategory, activeActivity.notes].filter(Boolean).join(' - ');

  return (
    <div
      className="active-activity-banner p-2 cursor-pointer transition-all"
      onClick={onOpenForm}
    >
      <div className={`activity-banner-inner-card rounded-xl p-4 mx-3 shadow-md ${
        activeActivity.isPaused ? 'activity-banner-inner-paused' : 'activity-banner-inner-active'
      }`}>
        {/* Active state */}
        {!activeActivity.isPaused && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium activity-banner-label">
                {playTypeLabel}
              </span>
              <span className="text-2xl font-mono font-bold activity-banner-timer">
                {formatDuration(totalDuration)}
              </span>
              {meta && (
                <span className="text-xs activity-banner-meta mt-0.5 truncate">
                  {meta}
                </span>
              )}
            </div>
            <div className="flex gap-2.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onPause}
                className="banner-btn activity-banner-btn-pause"
                title={t('Pause Activity')}
              >
                <Pause className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="banner-btn activity-banner-btn-stop"
                title={t('End Activity')}
              >
                <Square className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Paused state */}
        {activeActivity.isPaused && (
          <div className="flex items-center justify-between">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium activity-banner-paused-label">
                {playTypeLabel} - {t('Paused')}
              </span>
              <span className="text-lg font-mono font-semibold activity-banner-paused-timer mt-0.5">
                {formatDuration(totalDuration)}
              </span>
              {meta && (
                <span className="text-xs activity-banner-meta mt-0.5 truncate">
                  {meta}
                </span>
              )}
            </div>
            <div className="flex gap-2.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={onResume}
                className="banner-btn activity-banner-btn-resume"
                title={t('Resume Activity')}
              >
                <Play className="h-5 w-5 mr-0.5" />
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="banner-btn activity-banner-btn-stop"
                title={t('End Activity')}
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
