'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ProgressTabProps } from './food-form.types';
import { FoodProgressResponse, FoodLogResponse } from '@/app/api/types';
import { Button } from '@/src/components/ui/button';
import { Loader2, AlertCircle, Apple, TriangleAlert } from 'lucide-react';
import { useTimezone } from '@/app/context/timezone';
import { useFamily } from '@/src/context/family';
import { useLocalization } from '@/src/context/localization';
import {
  buildFoodTryList,
  buildLogEntryLink,
  formatAmountsByUnit,
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_LABELS,
  UNIQUE_FOOD_GOAL,
} from '@/src/utils/foodLogUtils';

/**
 * ProgressTab Component
 *
 * Displays the baby's all-time "100 foods before 1" progress: unique-food
 * counter with a progress bar, enjoyment breakdown, per-food history
 * (try count, first try, latest enjoyment, allergen/reaction badges),
 * and the derived Allergens & Reactions list.
 */
const ProgressTab: React.FC<ProgressTabProps> = ({
  babyId,
  refreshTrigger,
  onNavigate,
}) => {
  const { t } = useLocalization();
  const { formatDate } = useTimezone();
  const { family } = useFamily();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FoodProgressResponse | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogResponse[]>([]);

  const fetchProgress = useCallback(async () => {
    if (!babyId) return;

    try {
      setIsLoading(true);
      setError(null);
      const authToken = localStorage.getItem('authToken');
      const headers = { 'Authorization': `Bearer ${authToken}` };

      const [progressResponse, logsResponse] = await Promise.all([
        fetch(`/api/food-log/progress?babyId=${babyId}`, { headers }),
        fetch(`/api/food-log?babyId=${babyId}`, { headers }),
      ]);

      if (!progressResponse.ok || !logsResponse.ok) {
        throw new Error(t('Failed to load food progress'));
      }

      const progressData = await progressResponse.json();
      const logsData = await logsResponse.json();

      setProgress(progressData.success ? progressData.data : null);
      setFoodLogs(logsData.success && Array.isArray(logsData.data) ? logsData.data : []);
    } catch (err) {
      console.error('Error fetching food progress:', err);
      setError(t('Failed to load food progress'));
    } finally {
      setIsLoading(false);
    }
  }, [babyId, t]);

  // Fetch on mount and whenever a food log is saved in the other tab
  useEffect(() => {
    fetchProgress();
  }, [fetchProgress, refreshTrigger]);

  const tryList = buildFoodTryList(foodLogs);
  const uniqueFoodCount = progress?.uniqueFoodCount ?? 0;
  const progressPercent = Math.min(100, Math.round((uniqueFoodCount / UNIQUE_FOOD_GOAL) * 100));
  const allergens = progress?.allergens ?? [];

  return (
    <div className="food-form-tab-content">
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-8 food-form-loading-container">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" aria-hidden="true" />
          <p className="mt-2 text-gray-600">{t('Loading food progress...')}</p>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-8 food-form-error-container">
          <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
          <p className="mt-2 text-red-500">{error}</p>
          <Button variant="outline" onClick={fetchProgress} className="mt-2">
            {t('Retry')}
          </Button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="space-y-6">
          {/* Hero counter — apple fills bottom-up with progress toward the 100-food goal */}
          <div className="flex items-center justify-center gap-4">
            <div
              className="relative h-16 w-16 flex-shrink-0"
              role="progressbar"
              aria-valuenow={uniqueFoodCount}
              aria-valuemin={0}
              aria-valuemax={UNIQUE_FOOD_GOAL}
              aria-label={t('Unique foods tried')}
            >
              <Apple className="h-16 w-16 text-gray-300 food-progress-apple-outline" aria-hidden="true" />
              <div
                className="absolute inset-0 overflow-hidden transition-all duration-500"
                style={{ clipPath: `inset(${100 - progressPercent}% 0 0 0)` }}
              >
                <Apple className="h-16 w-16 text-[#84CC16]" fill="#84CC16" aria-hidden="true" />
              </div>
            </div>
            <div className="text-left">
              <div className="text-4xl font-bold text-gray-800 food-progress-hero-count">
                {uniqueFoodCount}
                <span className="text-lg font-medium text-gray-500 food-progress-hero-goal"> / {UNIQUE_FOOD_GOAL}</span>
              </div>
              <p className="mt-1 text-sm text-gray-600 food-progress-hero-label">{t('Unique foods tried')}</p>
            </div>
          </div>

          {/* Enjoyment breakdown */}
          {progress && progress.totalTries > 0 && (
            <div className="grid grid-cols-5 gap-1 text-center">
              {FOOD_ENJOYMENT_DISPLAY_ORDER.map((value) => (
                <div key={value} className="rounded-md bg-gray-50 py-2 food-progress-enjoyment-cell">
                  <div className="text-sm font-semibold text-gray-800 food-progress-enjoyment-count">
                    {progress.byEnjoyment?.[value] ?? 0}
                  </div>
                  <div className="text-[10px] text-gray-500 food-progress-enjoyment-label">
                    {t(FOOD_ENJOYMENT_LABELS[value])}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Allergens & Reactions */}
          {allergens.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 food-progress-section-title flex items-center gap-1.5">
                <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
                {t('Allergens & Reactions')}
              </h3>
              <div className="space-y-2">
                {allergens.map((entry) => (
                  <div
                    key={entry.foodId}
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 food-allergen-item"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-800 food-allergen-item-name">{entry.foodName}</span>
                      {entry.commonAllergen && (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 food-allergen-badge">
                          {t('Common allergen')}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {entry.reactions.map((reaction, index) => (
                        <div key={index} className="text-xs text-gray-600 food-allergen-reaction-row">
                          {formatDate(reaction.time)}
                          {reaction.description ? ` — ${reaction.description}` : ''}
                        </div>
                      ))}
                      {family?.slug && entry.reactions.length > 0 && (
                        <div className="text-xs">
                          <Link
                            href={buildLogEntryLink(family.slug, entry.reactions[0].time, babyId)}
                            onClick={onNavigate}
                            className="text-teal-600 hover:text-teal-700 hover:underline food-allergen-link"
                          >
                            {t('View in log')}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-food history */}
          {tryList.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 food-progress-section-title">
                {t('Foods Tried')}
              </h3>
              <div className="space-y-2">
                {tryList.map((entry) => (
                  <div
                    key={entry.foodId}
                    className="food-history-item rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center min-w-0">
                        <div className="flex-shrink-0 food-form-icon-container rounded-full bg-lime-100 p-1.5">
                          <Apple className="h-3.5 w-3.5 text-lime-600" aria-hidden="true" />
                        </div>
                        <span className="ml-2 font-medium text-sm truncate food-history-item-name">
                          {entry.foodName || t('unknown')}
                        </span>
                        {entry.hadReaction && (
                          <TriangleAlert
                            className="ml-1.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500"
                            aria-label={t('Reaction')}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {entry.commonAllergen && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 food-allergen-badge">
                            {t('Common allergen')}
                          </span>
                        )}
                        {entry.latestEnjoyment && (
                          <span className="inline-flex items-center rounded-full bg-lime-100 px-2 py-0.5 text-xs font-medium text-lime-700 food-enjoyment-badge">
                            {t(FOOD_ENJOYMENT_LABELS[entry.latestEnjoyment])}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 food-history-item-meta">
                      {entry.tryCount} {entry.tryCount === 1 ? t('try') : t('tries')}
                      {formatAmountsByUnit(entry.totalAmounts) && (
                        <>{' • '}{formatAmountsByUnit(entry.totalAmounts)}</>
                      )}
                      {' • '}
                      {t('First try')}: {formatDate(entry.firstTryTime)}
                      {family?.slug && (
                        <>
                          {' • '}
                          <Link
                            href={buildLogEntryLink(family.slug, entry.firstTryTime, babyId)}
                            onClick={onNavigate}
                            className="text-teal-600 hover:text-teal-700 hover:underline food-history-item-link"
                          >
                            {t('View in log')}
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 food-form-empty-state">
              <Apple className="h-12 w-12 mx-auto mb-2 text-gray-400" aria-hidden="true" />
              <p className="text-gray-500">{t('No foods logged yet')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressTab;
