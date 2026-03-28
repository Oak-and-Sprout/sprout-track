'use client';

import React from 'react';
import { cn } from '@/src/lib/utils';
import { useLocalization } from '@/src/context/localization';
import { reportCardStyles as s } from './monthly-report-card.styles';
import type { DiapersSectionProps } from './monthly-report-card.types';

const DiapersSection: React.FC<DiapersSectionProps> = ({ diapers }) => {
  const { t } = useLocalization();

  return (
    <>
      <p className={cn(s.sectionHeading, 'report-card-section-heading')}>{t('Diapers')}</p>

      <div className={cn(s.metricGrid4)}>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Avg changes/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{diapers.avgChangesPerDay}</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Dirty diapers/day')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{diapers.avgDirtyPerDay}</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Blowouts')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{diapers.blowoutCount}</p>
        </div>
        <div className={cn(s.metricCard, 'report-card-metric')}>
          <p className={cn(s.metricLabel, 'report-card-metric-label')}>{t('Cream applied')}</p>
          <p className={cn(s.metricValue, 'report-card-metric-value')}>{diapers.creamApplicationRate}%</p>
        </div>
      </div>

      {/* Doctor callout for abnormal stool colors */}
      {diapers.colorFlags.length > 0 && (
        <div className={cn(s.doctorCallout, 'report-card-doctor-callout')}>
          <span className={s.doctorCalloutBold}>{t('Note for doctor:')}</span>{' '}
          {diapers.colorFlags.length} {t('instances of')}{' '}
          {Array.from(new Set(diapers.colorFlags.map(f => f.color.toLowerCase()))).join(', ')}-{t('colored stool logged')}{' '}
          ({diapers.colorFlags.map(f => new Date(f.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })).join(', ')}).
        </div>
      )}
    </>
  );
};

export default DiapersSection;
