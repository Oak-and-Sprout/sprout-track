'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { ActivitySectionProps } from './monthly-report-card.types';

const ActivitySection: React.FC<ActivitySectionProps> = ({ activity }) => {
  const { t } = useLocalization();

  const tummyDelta = activity.tummyTimeDelta;
  const tummyDeltaText = tummyDelta
    ? `${tummyDelta.direction === 'up' ? '↑' : tummyDelta.direction === 'down' ? '↓' : '→'} ${Math.abs(tummyDelta.value)} min ${t('from last month')}`
    : null;
  const tummyDeltaClass = tummyDelta?.direction === 'up'
    ? s.metricSubPositive
    : tummyDelta?.direction === 'down'
      ? s.metricSubWarning
      : s.metricSubNeutral;

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Activity & play')}</p>

      <div className={cn(s.metricGrid3)}>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Tummy time/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{activity.avgTummyTimePerDay} min</p>
          {tummyDeltaText && (
            <p className={cn(s.metricSub, tummyDeltaClass, `report-card-metric-sub-${tummyDelta?.direction === 'up' ? 'positive' : tummyDelta?.direction === 'down' ? 'warning' : 'neutral'}`)}>
              {tummyDeltaText}
            </p>
          )}
        </div>

        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Outdoor time/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{activity.avgOutdoorTimePerDay} min</p>
          <p className={cn(s.metricSub, s.metricSubNeutral, 'report-card-metric-sub-neutral')}>{t('walks + outdoor play')}</p>
        </div>

        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Baths this month')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{activity.bathCount}</p>
          <p className={cn(s.metricSub, s.metricSubNeutral, 'report-card-metric-sub-neutral')}>
            {t('every ~')}{activity.avgBathInterval} {t('days')}
          </p>
        </div>
      </div>
    </>
  );
};

export default ActivitySection;
