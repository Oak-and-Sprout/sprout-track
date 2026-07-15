'use client';

import React from 'react';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useTimezone } from '@/app/context/timezone';
import { useLocalization } from '@/src/context/localization';
import { formatDateShort } from '@/src/utils/dateFormat';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { FoodsSectionProps } from './monthly-report-card.types';
import {
  FOOD_ENJOYMENT_ICON_SRC,
  FOOD_ENJOYMENT_LABELS,
  UNIQUE_FOOD_GOAL,
} from '@/src/utils/foodLogUtils';

const FoodsSection: React.FC<FoodsSectionProps> = ({ foods }) => {
  const { t } = useLocalization();
  const { dateFormat } = useTimezone();

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Foods')}</p>

      <div className={cn(s.metricGrid2)}>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('New foods this month')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{foods.newFoodCount}</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Unique foods tried')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>
            {foods.uniqueFoodCount}
            <span className={cn(s.metricSub, s.metricSubNeutral, 'report-card-metric-sub-neutral')}> / {UNIQUE_FOOD_GOAL}</span>
          </p>
        </div>
      </div>

      {foods.newFoods.length === 0 ? (
        <p className={cn(s.noData, 'report-card-no-data')}>{t('No new foods this month')}</p>
      ) : (
        <div className={cn(s.foodsList)}>
          {foods.newFoods.map(food => (
            <div key={food.foodId} className={cn(s.foodRow, 'report-card-food-row')}>
              {food.enjoyment ? (
                <img
                  src={FOOD_ENJOYMENT_ICON_SRC[food.enjoyment]}
                  alt=""
                  aria-hidden="true"
                  title={t(FOOD_ENJOYMENT_LABELS[food.enjoyment])}
                  className={cn(s.foodEmoji)}
                />
              ) : (
                <span className={cn(s.foodEmojiPlaceholder, 'report-card-food-emoji-placeholder')} aria-hidden="true">?</span>
              )}
              <div className={cn(s.foodInfo)}>
                <p className={cn(s.foodName, 'report-card-food-name')}>
                  {food.foodName || t('unknown')}
                </p>
                <p className={cn(s.foodSub, 'report-card-food-sub')}>
                  {formatDateShort(new Date(food.firstTryTime), dateFormat)}
                  {food.enjoyment ? ` · ${t(FOOD_ENJOYMENT_LABELS[food.enjoyment])}` : ''}
                </p>
              </div>
              {food.hadReaction && (
                <TriangleAlert
                  className={cn(s.foodReactionIcon)}
                  aria-label={t('Reaction')}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

export default FoodsSection;
