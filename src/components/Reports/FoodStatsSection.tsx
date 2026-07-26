'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Apple, TriangleAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Card, CardContent } from '@/src/components/ui/card';
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/src/components/ui/accordion';
import { styles } from './reports.styles';
import { DateRange } from './reports.types';
import { useBaby } from '@/app/context/baby';
import { useLocalization } from '@/src/context/localization';
import { useTimezone } from '@/app/context/timezone';
import { FoodProgressResponse, FoodLogResponse } from '@/app/api/types';
import {
  countFirstTriesInRange,
  FOOD_ENJOYMENT_VALUES,
  FOOD_ENJOYMENT_DISPLAY_ORDER,
  FOOD_ENJOYMENT_LABELS,
  UNIQUE_FOOD_GOAL,
} from '@/src/utils/foodLogUtils';

interface FoodStatsSectionProps {
  dateRange: DateRange;
}

/**
 * FoodStatsSection Component
 *
 * Food tracker stats (issue #203): cumulative "100 foods before 1"
 * progress (all-time, regardless of the selected date range), new foods
 * and tries within the range, enjoyment breakdown, and the derived
 * allergen/reaction list. Fetches its own data from /api/food-log because
 * the unique-food counter must be cumulative.
 */
const FoodStatsSection: React.FC<FoodStatsSectionProps> = ({ dateRange }) => {
  const { t } = useLocalization();
  const { formatDate } = useTimezone();
  const { selectedBaby } = useBaby();
  const [progress, setProgress] = useState<FoodProgressResponse | null>(null);
  const [foodLogs, setFoodLogs] = useState<FoodLogResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!selectedBaby) {
      setProgress(null);
      setFoodLogs([]);
      return;
    }

    setIsLoading(true);
    try {
      const authToken = localStorage.getItem('authToken');
      const headers = {
        'Authorization': authToken ? `Bearer ${authToken}` : '',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      };

      // All-time data — the "100 foods" counter is cumulative by design
      const [progressResponse, logsResponse] = await Promise.all([
        fetch(`/api/food-log/progress?babyId=${selectedBaby.id}`, { cache: 'no-store', headers }),
        fetch(`/api/food-log?babyId=${selectedBaby.id}`, { cache: 'no-store', headers }),
      ]);

      if (progressResponse.ok) {
        const data = await progressResponse.json();
        setProgress(data.success ? data.data : null);
      } else {
        setProgress(null);
      }

      if (logsResponse.ok) {
        const data = await logsResponse.json();
        setFoodLogs(data.success && Array.isArray(data.data) ? data.data : []);
      } else {
        setFoodLogs([]);
      }
    } catch {
      setProgress(null);
      setFoodLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBaby]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Range-scoped stats computed from the all-time log list
  const { triesInRange, newFoodsInRange } = useMemo(() => {
    if (!dateRange.from || !dateRange.to) {
      return { triesInRange: 0, newFoodsInRange: 0 };
    }
    const startMs = dateRange.from.getTime();
    const endMs = dateRange.to.getTime();
    const tries = foodLogs.filter((log) => {
      const timeMs = new Date(log.time).getTime();
      return timeMs >= startMs && timeMs <= endMs;
    }).length;
    return {
      triesInRange: tries,
      newFoodsInRange: countFirstTriesInRange(foodLogs, dateRange.from, dateRange.to),
    };
  }, [foodLogs, dateRange]);

  const uniqueFoodCount = progress?.uniqueFoodCount ?? 0;
  const allergens = progress?.allergens ?? [];
  const progressPercent = Math.min(100, Math.round((uniqueFoodCount / UNIQUE_FOOD_GOAL) * 100));
  const hasEnjoymentData = progress && FOOD_ENJOYMENT_VALUES.some((value) => (progress.byEnjoyment?.[value] ?? 0) > 0);

  return (
    <AccordionItem value="foods">
      <AccordionTrigger className={cn(styles.accordionTrigger, "reports-accordion-trigger")}>
        <Apple aria-hidden="true" className={cn(styles.accordionTriggerIcon, "reports-accordion-trigger-icon reports-icon-food")} />
        <span>{t('Foods Tried')}</span>
      </AccordionTrigger>
      <AccordionContent className={styles.accordionContent}>
        {isLoading ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('Loading...')}
            </p>
          </div>
        ) : uniqueFoodCount === 0 ? (
          <div className={cn(styles.emptyContainer, "reports-empty-container")}>
            <p className={cn(styles.emptyText, "reports-empty-text")}>
              {t('No foods recorded.')}
            </p>
          </div>
        ) : (
          <>
            <div className={styles.statsGrid}>
              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {uniqueFoodCount} / {UNIQUE_FOOD_GOAL}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Unique foods tried')}</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {newFoodsInRange}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('New foods in range')}</div>
                </CardContent>
              </Card>

              <Card className={cn(styles.statCard, "reports-stat-card")}>
                <CardContent className="p-4">
                  <div className={cn(styles.statCardValue, "reports-stat-card-value")}>
                    {triesInRange}
                  </div>
                  <div className={cn(styles.statCardLabel, "reports-stat-card-label")}>{t('Tries in range')}</div>
                </CardContent>
              </Card>
            </div>

            {/* All-time progress bar toward the 100-food goal */}
            <div
              className="mt-4 h-3 w-full rounded-full bg-gray-100 overflow-hidden reports-food-progress-track"
              role="progressbar"
              aria-valuenow={uniqueFoodCount}
              aria-valuemin={0}
              aria-valuemax={UNIQUE_FOOD_GOAL}
              aria-label={t('Unique foods tried')}
            >
              <div
                className="h-full rounded-full bg-[#84CC16] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Enjoyment breakdown (all-time) */}
            {hasEnjoymentData && (
              <div className="mt-4 grid grid-cols-5 gap-1 text-center">
                {FOOD_ENJOYMENT_DISPLAY_ORDER.map((value) => (
                  <div key={value} className="rounded-md bg-gray-50 py-2 reports-food-enjoyment-cell">
                    <div className="text-sm font-semibold text-gray-800 reports-stat-card-value !text-sm">
                      {progress?.byEnjoyment?.[value] ?? 0}
                    </div>
                    <div className="text-[10px] text-gray-500 reports-stat-card-label !text-[10px]">
                      {t(FOOD_ENJOYMENT_LABELS[value])}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Allergens & Reactions (all-time, derived from reaction-flagged logs) */}
            {allergens.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2 reports-food-allergen-title">
                  <TriangleAlert aria-hidden="true" className="h-4 w-4 text-amber-500" />
                  {t('Allergens & Reactions')}
                </div>
                <div className="space-y-2">
                  {allergens.map((entry) => (
                    <div
                      key={entry.foodId}
                      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 reports-food-allergen-item"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-800">{entry.foodName}</span>
                        {entry.commonAllergen && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {t('Common allergen')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {entry.reactions.map((reaction, index) => (
                          <div key={index} className="text-xs text-gray-600">
                            {formatDate(reaction.time)}
                            {reaction.description ? ` — ${reaction.description}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default FoodStatsSection;
