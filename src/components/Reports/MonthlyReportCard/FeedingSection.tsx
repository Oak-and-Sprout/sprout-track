'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s, chartColors } from './monthly-report-card.styles';
import type { FeedingSectionProps } from './monthly-report-card.types';

const FeedingSection: React.FC<FeedingSectionProps> = ({ feeding }) => {
  const { t } = useLocalization();

  const deltaText = feeding.dailyIntakeDelta
    ? `${feeding.dailyIntakeDelta.direction === 'up' ? '↑' : feeding.dailyIntakeDelta.direction === 'down' ? '↓' : '→'} ${Math.abs(feeding.dailyIntakeDelta.value)} ${feeding.avgDailyIntake.unit} ${t('from last month')}`
    : null;

  const deltaClass = feeding.dailyIntakeDelta?.direction === 'up'
    ? s.metricSubPositive
    : feeding.dailyIntakeDelta?.direction === 'down'
      ? s.metricSubWarning
      : s.metricSubNeutral;

  const { bottle, breast, solids } = feeding.breakdown;
  const hasBreakdown = bottle + breast + solids > 0;

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Feeding')}</p>

      <div className={cn(s.metricGrid3)}>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg bottles/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.avgBottlesPerDay}</p>
          <p className={cn(s.metricSub, s.metricSubNeutral, 'report-card-metric-sub-neutral')}>
            {t('avg')} {feeding.avgBottleSize.value} {feeding.avgBottleSize.unit} {t('each')}
          </p>
        </div>

        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Daily intake')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.avgDailyIntake.value} {feeding.avgDailyIntake.unit}</p>
          {deltaText && (
            <p className={cn(s.metricSub, deltaClass, `report-card-metric-sub-${feeding.dailyIntakeDelta?.direction === 'up' ? 'positive' : feeding.dailyIntakeDelta?.direction === 'down' ? 'warning' : 'neutral'}`)}>
              {deltaText}
            </p>
          )}
        </div>

        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Solids sessions')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.avgSolidsPerDay}/{t('day')}</p>
        </div>
      </div>

      {/* Breastfeeding stats (only shown when breast feed logs exist) */}
      {feeding.breastfeeding && (
        <>
        <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Breastfeeding')}</p>
        <div className={cn(s.metricGrid3)}>
          <div className={cn(s.metricCard, 'report-card-metric')}>
            <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg sessions/day')}</p>
            <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.breastfeeding.avgSessionsPerDay}</p>
          </div>
          <div className={cn(s.metricCard, 'report-card-metric')}>
            <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg left side')}</p>
            <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.breastfeeding.avgLeftDuration} {t('min')}</p>
          </div>
          <div className={cn(s.metricCard, 'report-card-metric')}>
            <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg right side')}</p>
            <p className={cn(s.metricValue, 'report-card-metric-value')}>{feeding.breastfeeding.avgRightDuration} {t('min')}</p>
          </div>
        </div>
        </>
      )}

      {/* Feeding breakdown bar */}
      {hasBreakdown && (
        <div className={cn(s.card, 'report-card-card')}>
          <p className={cn(s.cardTitle, 'report-card-card-title')}>{t('Feeding breakdown')}</p>
          <div className={cn(s.breakdownBar)}>
            {bottle > 0 && <div style={{ width: `${bottle}%`, background: chartColors.bottle }} />}
            {breast > 0 && <div style={{ width: `${breast}%`, background: chartColors.breast }} />}
            {solids > 0 && <div style={{ width: `${solids}%`, background: chartColors.solids }} />}
          </div>
          <div className={cn(s.breakdownLegend, 'report-card-breakdown-legend')}>
            {bottle > 0 && (
              <span className={s.breakdownLegendItem}>
                <span className={s.breakdownDot} style={{ background: chartColors.bottle }} />
                {t('Bottle')} {bottle}%
              </span>
            )}
            {breast > 0 && (
              <span className={s.breakdownLegendItem}>
                <span className={s.breakdownDot} style={{ background: chartColors.breast }} />
                {t('Breast')} {breast}%
              </span>
            )}
            {solids > 0 && (
              <span className={s.breakdownLegendItem}>
                <span className={s.breakdownDot} style={{ background: chartColors.solids }} />
                {t('Solids')} {solids}%
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedingSection;
